import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useResidentes } from "@/hooks/usePlanos";
import { useResidentesInativos } from "@/hooks/useCicloVida";
import { useDemonstrativoMes } from "@/hooks/useDemonstrativo";
import { useCustosPessoalDoMes } from "@/hooks/usePagamentoPessoal";
import { useConfiguracao, CHAVE_TOTAL_SUITES } from "@/hooks/useConfiguracao";
import { deslocarMes, chavePreco } from "@/lib/mensalidade";
import type { Residente } from "@/types/database";

// ===========================================================================
// FONTE ÚNICA dos indicadores financeiro-operacionais da gestão. Tanto o Painel
// da Administração quanto o cockpit do Master consomem este resumo — assim o
// MESMO número nunca é recalculado de formas diferentes em telas diferentes.
//
// Definições canônicas:
//   faturamento = mensalidades (previstas) + upselling (do mês)
//   recebido    = mensalidades de hóspedes com pagamento "paga"
//   resultado   = faturamento − (custo de pessoal + custo de materiais)
//   materiais   = null enquanto não existe módulo de materiais (limpeza/manut.)
// ===========================================================================

export interface ResumoMes {
  mes: string;
  // Ocupação
  ativos: number;
  capacidade: number | null;
  taxaOcupacao: number | null; // %
  entradas: number;
  saidas: number;
  // Financeiro
  mensalidades: number;
  upselling: number;
  faturamento: number;
  recebido: number;
  pendente: number;
  pctRecebido: number | null;
  inadimplentesCount: number;
  inadimplenteValor: number;
  // Custos e resultado
  custoPessoal: number;
  custoMateriais: number | null;
  resultado: number;
  // Estado
  isLoading: boolean;
  isError: boolean;
  error: unknown;
}

function noMes(dataISO: string | null | undefined, mes: string): boolean {
  return !!dataISO && dataISO.slice(0, 7) === mes;
}

export function useResumoMes(mes: string): ResumoMes {
  const demo = useDemonstrativoMes(mes);
  const custos = useCustosPessoalDoMes(mes);
  const ativosQ = useResidentes();
  const inativosQ = useResidentesInativos();
  const capacidadeQ = useConfiguracao(CHAVE_TOTAL_SUITES);

  const isLoading = demo.isLoading || custos.isLoading || ativosQ.isLoading || inativosQ.isLoading || capacidadeQ.isLoading;
  const isError = demo.isError || custos.isError || ativosQ.isError || inativosQ.isError;
  const error = demo.error ?? custos.error ?? ativosQ.error ?? inativosQ.error;

  const mensalidades = demo.linhas.reduce((s, l) => s + l.mensalidade, 0);
  const upselling = demo.linhas.reduce((s, l) => s + l.upselling, 0);
  const faturamento = mensalidades + upselling;

  const inadimplentesLinhas = demo.linhas.filter((l) => !l.pago && l.mensalidade > 0);
  const inadimplenteValor = inadimplentesLinhas.reduce((s, l) => s + l.mensalidade, 0);
  const recebido = mensalidades - inadimplenteValor;
  const pctRecebido = mensalidades > 0 ? Math.round((recebido / mensalidades) * 100) : null;

  const custoPessoal = custos.linhas.reduce((s, l) => s + l.valorFinal, 0);
  const custoMateriais: number | null = null; // sem módulo de materiais ainda
  const resultado = faturamento - (custoPessoal + (custoMateriais ?? 0));

  const ativos = demo.linhas.length;
  const capacidadeNum = capacidadeQ.data ? parseInt(capacidadeQ.data, 10) : NaN;
  const capacidade = Number.isFinite(capacidadeNum) && capacidadeNum > 0 ? capacidadeNum : null;
  const taxaOcupacao = capacidade ? Math.round((ativos / capacidade) * 100) : null;

  // Entradas no mês: admitidos no mês (ativos OU já inativados depois).
  const inativos = inativosQ.data ?? [];
  const entradas =
    (ativosQ.data ?? []).filter((r) => noMes(r.data_admissao, mes)).length +
    inativos.filter((r) => noMes(r.data_admissao, mes)).length;
  // Saídas no mês: inativados com data_saida no mês.
  const saidas = inativos.filter((r) => noMes(r.data_saida, mes)).length;

  return {
    mes,
    ativos,
    capacidade,
    taxaOcupacao,
    entradas,
    saidas,
    mensalidades,
    upselling,
    faturamento,
    recebido,
    pendente: inadimplenteValor,
    pctRecebido,
    inadimplentesCount: inadimplentesLinhas.length,
    inadimplenteValor,
    custoPessoal,
    custoMateriais,
    resultado,
    isLoading,
    isError,
    error,
  };
}

// ─── Evolução financeira (mês a mês) ─────────────────────────────────────────

export interface PontoEvolucao {
  mes: string;
  faturamento: number;
  resultado: number;
}

type ResidenteEvolucao = Pick<
  Residente,
  "mensalidade_valor" | "tipo_suite" | "grau_dependencia" | "ocupacao" | "data_admissao" | "data_saida"
>;

/** Residente "presente" no mês: admitido até o fim e não saído antes do início. */
function presenteNoMes(r: ResidenteEvolucao, mes: string): boolean {
  const admitido = !r.data_admissao || r.data_admissao.slice(0, 7) <= mes;
  const naoSaiu = !r.data_saida || r.data_saida.slice(0, 7) >= mes;
  return admitido && naoSaiu;
}

/**
 * Série de faturamento e resultado dos últimos `n` meses (real por mês de
 * referência). Mensalidade considera o ROSTER presente em cada mês (entradas/
 * saídas refletidas); upselling vem por mes_referencia; o custo de pessoal usa
 * os lançamentos registrados (pagamento_pessoal) e materiais = 0 (sem módulo).
 */
export function useEvolucaoFinanceira(mesBase: string, n = 12) {
  const meses = useMemo(() => {
    const out: string[] = [];
    for (let i = n - 1; i >= 0; i--) out.push(deslocarMes(mesBase, -i));
    return out;
  }, [mesBase, n]);

  return useQuery({
    queryKey: ["evolucao-financeira", mesBase, n],
    queryFn: async (): Promise<PontoEvolucao[]> => {
      const [resR, tabR, upsR, pessoalR] = await Promise.all([
        supabase
          .from("residentes")
          .select("mensalidade_valor, tipo_suite, grau_dependencia, ocupacao, data_admissao, data_saida"),
        supabase.from("tabela_preco").select("tipo_suite, grau, ocupacao, valor"),
        supabase.from("upselling").select("valor, mes_referencia"),
        supabase.from("pagamento_pessoal").select("valor_final, mes_referencia"),
      ]);
      if (resR.error) throw resR.error;
      if (tabR.error) throw tabR.error;
      if (upsR.error) throw upsR.error;
      if (pessoalR.error) throw pessoalR.error;

      const residentes = (resR.data ?? []) as ResidenteEvolucao[];
      const precoMap = new Map(
        (tabR.data ?? []).map((p) => [chavePreco(p.tipo_suite, p.grau, p.ocupacao), p.valor as number]),
      );
      const mensalidadeDe = (r: ResidenteEvolucao): number =>
        r.mensalidade_valor ?? precoMap.get(chavePreco(r.tipo_suite, r.grau_dependencia, r.ocupacao)) ?? 0;

      const upsPorMes = new Map<string, number>();
      for (const u of upsR.data ?? []) {
        const m = u.mes_referencia as string;
        upsPorMes.set(m, (upsPorMes.get(m) ?? 0) + (u.valor as number));
      }
      const pessoalPorMes = new Map<string, number>();
      for (const p of pessoalR.data ?? []) {
        const m = p.mes_referencia as string;
        pessoalPorMes.set(m, (pessoalPorMes.get(m) ?? 0) + ((p.valor_final as number) ?? 0));
      }

      return meses.map((mes) => {
        const mensalidades = residentes
          .filter((r) => presenteNoMes(r, mes))
          .reduce((s, r) => s + mensalidadeDe(r), 0);
        const faturamento = mensalidades + (upsPorMes.get(mes) ?? 0);
        const resultado = faturamento - (pessoalPorMes.get(mes) ?? 0);
        return { mes, faturamento, resultado };
      });
    },
  });
}
