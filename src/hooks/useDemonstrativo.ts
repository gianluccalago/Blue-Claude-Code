import { useMemo } from "react";
import { useResidentes } from "@/hooks/usePlanos";
import { useResidentesInativos } from "@/hooks/useCicloVida";
import { useFechamentoMensal, usePagamentosDoMes, useTabelaPreco } from "@/hooks/useMensalidades";
import { useUpsellingTodosDoMes } from "@/hooks/useUpselling";
import { useCobrancasTemporariasDoMes } from "@/hooks/useCobrancaTemporaria";
import { useConfiguracao } from "@/hooks/useConfiguracao";
import { precoVigenteEm, hojeISO } from "@/lib/mensalidade";
import {
  CHAVE_PRORATA_MENSALIDADE,
  ehPago,
  entraNoFaturamento,
  estaNoMes,
  mensalidadeDoMes,
  proRataLigada,
  saldoDevedor,
  statusEfetivoCobranca,
} from "@/lib/cobranca";
import { valorParcelaDecimo } from "@/lib/decimoTerceiro";
import type {
  CobrancaTemporaria,
  LinhaSnapshotFechamento,
  SnapshotFechamento,
  PagamentoMensalidade,
  Residente,
  StatusPagamentoMensalidade,
} from "@/types/database";

export interface LinhaDemonstrativo {
  residente: Residente;
  mensalidade: number;
  upselling: number;
  /** Parcela do 13º (nov/dez); 0 nos demais meses. Cobrança própria. */
  decimoTerceiro: number;
  /** Cobranças temporárias (diária/pacote) do mês — curta permanência. */
  cobrancaTemporaria: number;
  total: number;
  pago: boolean;
  pagamento: PagamentoMensalidade | undefined;
  /** Status efetivo (regra única de lib/cobranca — vencida calculada pelo vencimento efetivo). */
  statusEfetivo: StatusPagamentoMensalidade;
  /** false quando a cobrança está CANCELADA — fica fora dos totais/faturamento. */
  faturavel: boolean;
  /** total − valor pago (0 quando quitada/cancelada; total quando estornada). */
  saldoDevedor: number;
  /** true quando os valores vêm do snapshot de um mês FECHADO. */
  congelada: boolean;
}

/** Situação do fechamento do mês (FIN-01): fechado = snapshot vale; senão, cálculo vivo. */
export interface SituacaoFechamento {
  fechado: boolean;
  fechadoEm: string | null;
  fechadoPor: string | null;
  reabertoEm: string | null;
  reabertoPor: string | null;
  reabertoMotivo: string | null;
  /** A pró-rata estava ligada quando o mês foi fechado (só faz sentido se fechado). */
  proRataNoFechamento: boolean | null;
}

/**
 * Hóspedes que ESTIVERAM na casa no mês (regra única `estaNoMes`): ativos
 * admitidos até o fim do mês mais os inativos cuja saída foi dentro ou depois
 * do mês. Antes, a lista era "ativos de hoje": quem saiu em 15/09 sumia da
 * cobrança de setembro e de todos os meses anteriores, e quem entrou em 20/09
 * aparecia em julho. Readmissão: o cadastro volta a "ativo" — a data_saida
 * antiga (se ficar) é ignorada para quem está ativo.
 */
export function useResidentesDoMes(mes: string) {
  const ativos = useResidentes();
  const inativos = useResidentesInativos();
  const data = useMemo(() => {
    if (!ativos.data || !inativos.data) return undefined;
    const lista = [...ativos.data, ...inativos.data].filter((r) => estaNoMes(r, mes));
    lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return lista;
  }, [ativos.data, inativos.data, mes]);
  return {
    data,
    isLoading: ativos.isLoading || inativos.isLoading,
    isError: ativos.isError || inativos.isError,
    error: ativos.error ?? inativos.error,
    /** Todos (ativos + inativos), para localizar um hóspede do snapshot. */
    todos: ativos.data && inativos.data ? [...ativos.data, ...inativos.data] : undefined,
  };
}

/**
 * Hóspede de uma linha do snapshot: o cadastro atual quando existe; senão,
 * um registro mínimo com os dados congelados (o snapshot é a verdade do mês).
 */
function residenteDoSnapshot(l: LinhaSnapshotFechamento, todos: Residente[]): Residente {
  const atual = todos.find((r) => r.id === l.residente_id);
  if (atual) return atual;
  return {
    id: l.residente_id,
    nome: l.nome,
    quarto: l.quarto,
    tipo_suite: l.tipo_suite,
    grau_dependencia: l.grau_dependencia,
    modalidade: l.modalidade,
    data_admissao: l.data_admissao,
    data_saida: l.data_saida,
    status_hospede: l.data_saida ? "inativo" : "ativo",
    resp_fin_nome: l.resp_fin_nome,
    resp_fin_cpf: l.resp_fin_cpf,
    resp_fin_email: l.resp_fin_email,
    resp_fin_telefone: l.resp_fin_telefone,
    resp_fin_relacao: l.resp_fin_relacao,
    mensalidade_valor: l.mensalidade_base,
  } as Residente;
}

/**
 * Consolida, para um mês de referência, mensalidade + upselling + 13º +
 * cobrança temporária de cada hóspede — base do Demonstrativo mensal, do
 * Painel de Cobrança e do Painel da Administração.
 *   · Mês FECHADO (fechamento_mensal): os VALORES vêm do snapshot — editar a
 *     mensalidade ou a tabela de preços não mexe no histórico. O STATUS de
 *     pagamento continua vivo (um pagamento atrasado ainda pode ser marcado).
 *   · Mês aberto: cálculo vivo; pró-rata só com a chave `prorata_mensalidade`
 *     = 'on' (padrão off = mês cheio).
 */
export function useDemonstrativoMes(mes: string) {
  const residentes = useResidentesDoMes(mes);
  const tabelaPreco = useTabelaPreco();
  const pagamentos = usePagamentosDoMes(mes);
  const upselling = useUpsellingTodosDoMes(mes);
  const cobrancas = useCobrancasTemporariasDoMes(mes);
  const fechamento = useFechamentoMensal(mes);
  const configProRata = useConfiguracao(CHAVE_PRORATA_MENSALIDADE);

  const isLoading =
    residentes.isLoading ||
    tabelaPreco.isLoading ||
    pagamentos.isLoading ||
    upselling.isLoading ||
    cobrancas.isLoading ||
    fechamento.isLoading ||
    configProRata.isLoading;
  const isError =
    residentes.isError ||
    tabelaPreco.isError ||
    pagamentos.isError ||
    upselling.isError ||
    cobrancas.isError ||
    fechamento.isError ||
    configProRata.isError;
  const error =
    residentes.error ??
    tabelaPreco.error ??
    pagamentos.error ??
    upselling.error ??
    cobrancas.error ??
    fechamento.error ??
    configProRata.error;

  const proRata = proRataLigada(configProRata.data);
  const registro = fechamento.data ?? null;
  const fechado = !!registro && registro.reaberto_em === null;

  const situacao: SituacaoFechamento = useMemo(
    () => ({
      fechado,
      fechadoEm: registro?.fechado_em ?? null,
      fechadoPor: registro?.fechado_por ?? null,
      reabertoEm: registro?.reaberto_em ?? null,
      reabertoPor: registro?.reaberto_por ?? null,
      reabertoMotivo: registro?.reaberto_motivo ?? null,
      proRataNoFechamento: fechado ? registro.snapshot.prorata : null,
    }),
    [fechado, registro],
  );

  const linhas: LinhaDemonstrativo[] = useMemo(() => {
    if (!residentes.data) return [];
    const pagamentoMap = new Map((pagamentos.data ?? []).map((p) => [p.residente_id, p]));

    const montar = (
      residente: Residente,
      valores: { mensalidade: number; upselling: number; decimoTerceiro: number; cobrancaTemporaria: number },
      congelada: boolean,
    ): LinhaDemonstrativo => {
      const pagamento = pagamentoMap.get(residente.id);
      const total = valores.mensalidade + valores.upselling + valores.decimoTerceiro + valores.cobrancaTemporaria;
      return {
        residente,
        ...valores,
        total,
        pago: ehPago(pagamento?.status),
        pagamento,
        statusEfetivo: statusEfetivoCobranca(pagamento, mes),
        faturavel: entraNoFaturamento(pagamento),
        saldoDevedor: saldoDevedor(total, pagamento),
        congelada,
      };
    };

    // Mês FECHADO: o snapshot é a verdade dos valores.
    if (fechado) {
      const todos = residentes.todos ?? [];
      return (registro.snapshot as SnapshotFechamento).linhas.map((l: LinhaSnapshotFechamento) =>
        montar(
          residenteDoSnapshot(l, todos),
          {
            mensalidade: l.mensalidade,
            upselling: l.upselling,
            decimoTerceiro: l.decimo_terceiro,
            cobrancaTemporaria: l.cobranca_temporaria,
          },
          true,
        ),
      );
    }

    const precos = tabelaPreco.data ?? [];
    const upsellingPorResidente = new Map<string, number>();
    for (const item of upselling.data ?? []) {
      upsellingPorResidente.set(item.residente_id, (upsellingPorResidente.get(item.residente_id) ?? 0) + item.valor);
    }
    const cobrancaPorResidente = new Map<string, number>();
    for (const c of cobrancas.data ?? []) {
      cobrancaPorResidente.set(c.residente_id, (cobrancaPorResidente.get(c.residente_id) ?? 0) + c.valor);
    }

    return residentes.data.map((r) => {
      // Só LONGA permanência tem mensalidade automática. Temporários cobram por
      // diária/pacote (cobranca_temporaria), lançado pela Administração.
      // Fallback (sem mensalidade_valor manual) = preço VIGENTE na data de
      // ENTRADA do hóspede — reajuste de preço não mexe em quem já entrou.
      const mensalidadeBase =
        r.modalidade === "longa_permanencia"
          ? r.mensalidade_valor ??
            precoVigenteEm(precos, r.tipo_suite, r.grau_dependencia, r.ocupacao, r.data_admissao ?? hojeISO()) ??
            0
          : 0;
      // Pró-rata (entrada/saída) só com a chave ligada; padrão = mês cheio.
      const mensalidade = mensalidadeDoMes(mensalidadeBase, r, mes, proRata);
      return montar(
        r,
        {
          mensalidade,
          upselling: upsellingPorResidente.get(r.id) ?? 0,
          // 13º proporcional (cobrança própria) — só nov/dez, sobre a mensalidade
          // BASE (a pró-rata não reduz o 13º).
          decimoTerceiro: valorParcelaDecimo(mensalidadeBase, r.data_admissao, mes),
          cobrancaTemporaria: cobrancaPorResidente.get(r.id) ?? 0,
        },
        false,
      );
    });
  }, [
    residentes.data,
    residentes.todos,
    tabelaPreco.data,
    pagamentos.data,
    upselling.data,
    cobrancas.data,
    fechado,
    registro,
    proRata,
    mes,
  ]);

  return {
    isLoading,
    isError,
    error,
    linhas,
    /** Fechamento do mês (FIN-01): snapshot vale quando `fechado`. */
    fechamento: situacao,
    /** Pró-rata ligada na configuração (vale para os meses abertos). */
    proRata,
    upsellingTodos: upselling.data ?? [],
    // TODAS as cobranças temporárias do mês (incl. day care, que não está em
    // `linhas` por não ocupar leito) — usadas no faturamento da fonte única.
    cobrancasTemporariasTodas: cobrancas.data ?? ([] as CobrancaTemporaria[]),
  };
}
