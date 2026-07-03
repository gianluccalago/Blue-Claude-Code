import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useResidentes, useFrequentadoresDayCare } from "@/hooks/usePlanos";
import { useResidentesInativos } from "@/hooks/useCicloVida";
import { useDemonstrativoMes } from "@/hooks/useDemonstrativo";
import { useCustosPessoalDoMes } from "@/hooks/usePagamentoPessoal";
import { useCustosMateriaisDoMes } from "@/hooks/useCustosMateriais";
import { useConfiguracao, CHAVE_TOTAL_SUITES } from "@/hooks/useConfiguracao";
import { deslocarMes, precoVigenteEm, hojeISO } from "@/lib/mensalidade";
import { valorParcelaDecimo } from "@/lib/decimoTerceiro";
import type { Residente } from "@/types/database";

// ===========================================================================
// FONTE ÚNICA dos indicadores financeiro-operacionais da gestão. Tanto o Painel
// da Administração quanto o cockpit do Master consomem este resumo — assim o
// MESMO número nunca é recalculado de formas diferentes em telas diferentes.
//
// Definições canônicas:
//   faturamento = mensalidades (longa) + upselling + 13º (nov/dez) + cobranças
//                 temporárias (curta permanência + day care)
//   recebido    = mensalidades de hóspedes com pagamento "paga"
//   resultado   = faturamento − (custo de pessoal + custo de materiais)
//   materiais   = null enquanto não existe módulo de materiais (limpeza/manut.)
// ===========================================================================

export interface ResumoMes {
  mes: string;
  // Ocupação (de LEITOS = longa + curta; day care é contado à parte)
  ativos: number;
  capacidade: number | null;
  taxaOcupacao: number | null; // %
  dayCareAtivos: number;
  entradas: number;
  saidas: number;
  // Financeiro
  mensalidades: number;
  upselling: number;
  decimoTerceiro: number; // parcela do 13º no mês (nov/dez)
  cobrancaTemporaria: number; // diárias/pacotes de curta permanência + day care
  faturamento: number;
  recebido: number;
  pendente: number;
  pctRecebido: number | null;
  inadimplentesCount: number;
  inadimplenteValor: number;
  // Custos e resultado
  custoPessoal: number;
  custoMateriais: number; // soma limpeza + manutenção do mês
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
  const materiais = useCustosMateriaisDoMes(mes);
  const ativosQ = useResidentes();
  const dayCareQ = useFrequentadoresDayCare();
  const inativosQ = useResidentesInativos();
  const capacidadeQ = useConfiguracao(CHAVE_TOTAL_SUITES);

  const isLoading = demo.isLoading || custos.isLoading || materiais.isLoading || ativosQ.isLoading || dayCareQ.isLoading || inativosQ.isLoading || capacidadeQ.isLoading;
  const isError = demo.isError || custos.isError || materiais.isError || ativosQ.isError || inativosQ.isError;
  const error = demo.error ?? custos.error ?? materiais.error ?? ativosQ.error ?? inativosQ.error;

  const mensalidades = demo.linhas.reduce((s, l) => s + l.mensalidade, 0);
  // Upselling e cobranças temporárias somam TODAS as linhas do mês (inclui day
  // care, que não está em demo.linhas por não ocupar leito) — fonte única.
  const upselling = demo.upsellingTodos.reduce((s, u) => s + (u.valor ?? 0), 0);
  const decimoTerceiro = demo.linhas.reduce((s, l) => s + l.decimoTerceiro, 0);
  const cobrancaTemporaria = demo.cobrancasTemporariasTodas.reduce((s, c) => s + (c.valor ?? 0), 0);
  const faturamento = mensalidades + upselling + decimoTerceiro + cobrancaTemporaria;

  const inadimplentesLinhas = demo.linhas.filter((l) => !l.pago && l.mensalidade > 0);
  const inadimplenteValor = inadimplentesLinhas.reduce((s, l) => s + l.mensalidade, 0);
  const recebido = mensalidades - inadimplenteValor;
  const pctRecebido = mensalidades > 0 ? Math.round((recebido / mensalidades) * 100) : null;

  const custoPessoal = custos.linhas.reduce((s, l) => s + l.valorFinal, 0);
  // Módulo de materiais (limpeza + manutenção) já alimenta o resultado.
  const custoMateriais = (materiais.data ?? []).reduce((s, m) => s + m.valor, 0);
  const resultado = faturamento - (custoPessoal + custoMateriais);

  const ativos = demo.linhas.length;
  const dayCareAtivos = (dayCareQ.data ?? []).length;
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
    dayCareAtivos,
    entradas,
    saidas,
    mensalidades,
    upselling,
    decimoTerceiro,
    cobrancaTemporaria,
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
  "mensalidade_valor" | "tipo_suite" | "grau_dependencia" | "ocupacao" | "data_admissao" | "data_saida" | "modalidade"
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
 * os lançamentos registrados (pagamento_pessoal) e materiais vêm de
 * custo_material por mes_referencia (mesma fonte do useResumoMes). O 13º (nov/
 * dez) é somado proporcionalmente por residente, como no demonstrativo.
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
      const [resR, tabR, upsR, pessoalR, cobR, matR] = await Promise.all([
        supabase
          .from("residentes")
          .select("mensalidade_valor, tipo_suite, grau_dependencia, ocupacao, data_admissao, data_saida, modalidade"),
        supabase.from("tabela_preco").select("tipo_suite, grau, ocupacao, valor, vigente_a_partir_de"),
        supabase.from("upselling").select("valor, mes_referencia"),
        supabase.from("pagamento_pessoal").select("valor_final, mes_referencia"),
        supabase.from("cobranca_temporaria").select("valor, periodo_referencia"),
        supabase.from("custo_material").select("valor, mes_referencia"),
      ]);
      if (resR.error) throw resR.error;
      if (tabR.error) throw tabR.error;
      if (upsR.error) throw upsR.error;
      if (pessoalR.error) throw pessoalR.error;
      if (cobR.error) throw cobR.error;
      if (matR.error) throw matR.error;

      const residentes = (resR.data ?? []) as ResidenteEvolucao[];
      const precos = (tabR.data ?? []) as {
        tipo_suite: string | null;
        grau: string | null;
        ocupacao: string | null;
        valor: number;
        vigente_a_partir_de: string;
      }[];
      // Só LONGA permanência tem mensalidade automática (igual ao demonstrativo).
      // Fallback = preço vigente na data de ENTRADA do hóspede (reajuste de preço
      // não reajusta quem já entrou — afeta só novos contratos).
      const mensalidadeDe = (r: ResidenteEvolucao): number =>
        r.modalidade === "longa_permanencia"
          ? r.mensalidade_valor ??
            precoVigenteEm(precos, r.tipo_suite, r.grau_dependencia, r.ocupacao, r.data_admissao ?? hojeISO()) ??
            0
          : 0;

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
      // Cobranças de temporários (curta/day care) por mês — entram no faturamento
      // (coerente com useResumoMes).
      const cobPorMes = new Map<string, number>();
      for (const c of cobR.data ?? []) {
        const m = c.periodo_referencia as string;
        cobPorMes.set(m, (cobPorMes.get(m) ?? 0) + ((c.valor as number) ?? 0));
      }
      // Custo de materiais (limpeza/manutenção) por mês — entra no RESULTADO
      // (coerente com useResumoMes: resultado = faturamento − pessoal − materiais).
      const matPorMes = new Map<string, number>();
      for (const m0 of matR.data ?? []) {
        const m = m0.mes_referencia as string;
        matPorMes.set(m, (matPorMes.get(m) ?? 0) + ((m0.valor as number) ?? 0));
      }

      return meses.map((mes) => {
        const presentes = residentes.filter((r) => presenteNoMes(r, mes));
        const mensalidades = presentes.reduce((s, r) => s + mensalidadeDe(r), 0);
        // 13º proporcional (nov/dez), por residente presente — mesma fonte do
        // useResumoMes/demonstrativo (valorParcelaDecimo já retorna 0 fora de nov/dez).
        const decimoTerceiro = presentes.reduce(
          (s, r) => s + valorParcelaDecimo(mensalidadeDe(r), r.data_admissao, mes),
          0,
        );
        const faturamento =
          mensalidades + (upsPorMes.get(mes) ?? 0) + (cobPorMes.get(mes) ?? 0) + decimoTerceiro;
        const resultado = faturamento - (pessoalPorMes.get(mes) ?? 0) - (matPorMes.get(mes) ?? 0);
        return { mes, faturamento, resultado };
      });
    },
  });
}
