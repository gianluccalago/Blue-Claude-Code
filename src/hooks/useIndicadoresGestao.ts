import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useResidentes, useFrequentadoresDayCare } from "@/hooks/usePlanos";
import { useResidentesInativos } from "@/hooks/useCicloVida";
import { useDemonstrativoMes } from "@/hooks/useDemonstrativo";
import { useCustosPessoalDoMes } from "@/hooks/usePagamentoPessoal";
import { useCustosMateriaisDoMes } from "@/hooks/useCustosMateriais";
import { useConfiguracao, CHAVE_TOTAL_SUITES } from "@/hooks/useConfiguracao";
import { deslocarMes, precoVigenteEm, hojeISO, intervaloDoMes } from "@/lib/mensalidade";
import { valorParcelaDecimo } from "@/lib/decimoTerceiro";
import { calcularOcupacaoLeitos, type OcupacaoLeitos } from "@/lib/ocupacao";
import { custoPessoalDoMes } from "@/lib/custoPessoal";
import type { PagamentoPessoal, Residente, Turno, Usuario } from "@/types/database";

/**
 * Total de LEITOS da casa (capacidade) — base da taxa de ocupação. Quando só
 * `total_suites` está cadastrado, os leitos são derivados da ocupação
 * cadastrada (ver lib/ocupacao).
 */
export const CHAVE_TOTAL_LEITOS = "total_leitos";

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
  /** Hóspedes que ocuparam leito no mês (= leitos ocupados; 1 leito por hóspede). */
  ativos: number;
  /** Capacidade em LEITOS (total_leitos, ou derivada de total_suites). */
  capacidade: number | null;
  taxaOcupacao: number | null; // % = leitos ocupados ÷ leitos totais
  dayCareAtivos: number;
  /** Detalhe leitos × suítes × Day Care (FIN-03). */
  ocupacao: OcupacaoLeitos;
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
  const leitosQ = useConfiguracao(CHAVE_TOTAL_LEITOS);

  const isLoading = demo.isLoading || custos.isLoading || materiais.isLoading || ativosQ.isLoading || dayCareQ.isLoading || inativosQ.isLoading || capacidadeQ.isLoading || leitosQ.isLoading;
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

  // Ocupação de LEITOS: hóspedes do mês (roster de quem esteve na casa, sem
  // Day Care) ÷ leitos totais. Suítes e Day Care ficam em `ocupacao`.
  const dayCareAtivos = (dayCareQ.data ?? []).length;
  const ocupacao = calcularOcupacaoLeitos(
    demo.linhas.map((l) => l.residente),
    dayCareAtivos,
    capacidadeQ.data,
    leitosQ.data,
  );
  const ativos = ocupacao.leitosOcupados;
  const capacidade = ocupacao.capacidadeLeitos;
  const taxaOcupacao = ocupacao.taxaOcupacao;

  // Entradas no mês: admitidos no mês (ativos OU já inativados depois).
  // Day Care não ocupa leito: fica fora de entradas/saídas (como de `ativos`).
  const inativos = (inativosQ.data ?? []).filter((r) => r.modalidade !== "day_care");
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
    ocupacao,
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
  | "mensalidade_valor"
  | "tipo_suite"
  | "grau_dependencia"
  | "grau_contratual"
  | "ocupacao"
  | "data_admissao"
  | "data_saida"
  | "modalidade"
>;

/**
 * Grau que define o PREÇO: o CONTRATUAL (o que foi negociado), não o clínico
 * (grau_dependencia muda com a evolução do hóspede e não reajusta o contrato).
 * Sem grau contratual cadastrado, cai no clínico para não zerar a receita.
 */
export function grauParaPreco(r: Pick<Residente, "grau_contratual" | "grau_dependencia">): string | null {
  return r.grau_contratual ?? r.grau_dependencia;
}

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
 * a MESMA regra do card (lib/custoPessoal: salvo com fallback para o calculado
 * — FIN-04) e materiais vêm de custo_material por mes_referencia (mesma fonte
 * do useResumoMes). O 13º (nov/dez) é somado proporcionalmente por residente,
 * como no demonstrativo.
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
      const { inicio: inicioJanela } = intervaloDoMes(meses[0]);
      const { fim: fimJanela } = intervaloDoMes(meses[meses.length - 1]);
      const [resR, tabR, upsR, pessoalR, cobR, matR, usuR, turR] = await Promise.all([
        supabase
          .from("residentes")
          .select(
            "mensalidade_valor, tipo_suite, grau_dependencia, grau_contratual, ocupacao, data_admissao, data_saida, modalidade",
          ),
        supabase.from("tabela_preco").select("tipo_suite, grau, ocupacao, valor, vigente_a_partir_de"),
        supabase.from("upselling").select("valor, mes_referencia"),
        supabase.from("pagamento_pessoal").select("*").gte("mes_referencia", meses[0]).lte("mes_referencia", meses[meses.length - 1]),
        supabase.from("cobranca_temporaria").select("valor, periodo_referencia"),
        supabase.from("custo_material").select("valor, mes_referencia"),
        supabase.from("usuarios").select("*"),
        supabase.from("turnos").select("*").gte("data", inicioJanela).lte("data", fimJanela),
      ]);
      if (resR.error) throw resR.error;
      if (tabR.error) throw tabR.error;
      if (upsR.error) throw upsR.error;
      if (pessoalR.error) throw pessoalR.error;
      if (cobR.error) throw cobR.error;
      if (matR.error) throw matR.error;
      if (usuR.error) throw usuR.error;
      if (turR.error) throw turR.error;
      const usuarios = (usuR.data ?? []) as Usuario[];
      const turnos = (turR.data ?? []) as Turno[];
      const pagamentosPessoal = (pessoalR.data ?? []) as PagamentoPessoal[];

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
      // não reajusta quem já entrou — afeta só novos contratos), pelo grau
      // CONTRATUAL (FIN-04: o clínico não define preço).
      const mensalidadeDe = (r: ResidenteEvolucao): number =>
        r.modalidade === "longa_permanencia"
          ? r.mensalidade_valor ??
            precoVigenteEm(precos, r.tipo_suite, grauParaPreco(r), r.ocupacao, r.data_admissao ?? hojeISO()) ??
            0
          : 0;

      const upsPorMes = new Map<string, number>();
      for (const u of upsR.data ?? []) {
        const m = u.mes_referencia as string;
        upsPorMes.set(m, (upsPorMes.get(m) ?? 0) + (u.valor as number));
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
        // Custo de pessoal: salvo com fallback para o calculado — a MESMA
        // regra do card (useCustosPessoalDoMes → lib/custoPessoal).
        const custoPessoal = custoPessoalDoMes(usuarios, turnos, pagamentosPessoal, mes);
        const resultado = faturamento - custoPessoal - (matPorMes.get(mes) ?? 0);
        return { mes, faturamento, resultado };
      });
    },
  });
}
