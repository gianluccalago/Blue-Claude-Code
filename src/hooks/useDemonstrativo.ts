import { useMemo } from "react";
import { useResidentes } from "@/hooks/usePlanos";
import { usePagamentosDoMes, useTabelaPreco } from "@/hooks/useMensalidades";
import { useUpsellingTodosDoMes } from "@/hooks/useUpselling";
import { useCobrancasTemporariasDoMes } from "@/hooks/useCobrancaTemporaria";
import { chavePreco } from "@/lib/mensalidade";
import { ehPago } from "@/lib/cobranca";
import { valorParcelaDecimo } from "@/lib/decimoTerceiro";
import type { CobrancaTemporaria, PagamentoMensalidade, Residente } from "@/types/database";

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
}

/**
 * Consolida, para um mês de referência, a mensalidade vigente + o total de
 * upselling de cada hóspede — base do Demonstrativo mensal e do Painel da
 * Administração.
 */
export function useDemonstrativoMes(mes: string) {
  const residentes = useResidentes();
  const tabelaPreco = useTabelaPreco();
  const pagamentos = usePagamentosDoMes(mes);
  const upselling = useUpsellingTodosDoMes(mes);
  const cobrancas = useCobrancasTemporariasDoMes(mes);

  const isLoading =
    residentes.isLoading || tabelaPreco.isLoading || pagamentos.isLoading || upselling.isLoading || cobrancas.isLoading;
  const isError =
    residentes.isError || tabelaPreco.isError || pagamentos.isError || upselling.isError || cobrancas.isError;
  const error = residentes.error ?? tabelaPreco.error ?? pagamentos.error ?? upselling.error ?? cobrancas.error;

  const linhas: LinhaDemonstrativo[] = useMemo(() => {
    if (!residentes.data) return [];

    const precoMap = new Map((tabelaPreco.data ?? []).map((p) => [chavePreco(p.tipo_suite, p.grau, p.ocupacao), p.valor]));
    const pagamentoMap = new Map((pagamentos.data ?? []).map((p) => [p.residente_id, p]));
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
      const mensalidade =
        r.modalidade === "longa_permanencia"
          ? r.mensalidade_valor ?? precoMap.get(chavePreco(r.tipo_suite, r.grau_dependencia, r.ocupacao)) ?? 0
          : 0;
      const pagamento = pagamentoMap.get(r.id);
      const upsellingTotal = upsellingPorResidente.get(r.id) ?? 0;
      const cobrancaTemporaria = cobrancaPorResidente.get(r.id) ?? 0;
      // 13º proporcional (cobrança própria) — só nov/dez, sem upselling.
      const decimoTerceiro = valorParcelaDecimo(mensalidade, r.data_admissao, mes);
      return {
        residente: r,
        mensalidade,
        upselling: upsellingTotal,
        decimoTerceiro,
        cobrancaTemporaria,
        total: mensalidade + upsellingTotal + decimoTerceiro + cobrancaTemporaria,
        pago: ehPago(pagamento?.status),
        pagamento,
      };
    });
  }, [residentes.data, tabelaPreco.data, pagamentos.data, upselling.data, cobrancas.data]);

  return {
    isLoading,
    isError,
    error,
    linhas,
    upsellingTodos: upselling.data ?? [],
    // TODAS as cobranças temporárias do mês (incl. day care, que não está em
    // `linhas` por não ocupar leito) — usadas no faturamento da fonte única.
    cobrancasTemporariasTodas: cobrancas.data ?? ([] as CobrancaTemporaria[]),
  };
}
