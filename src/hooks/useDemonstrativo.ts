import { useMemo } from "react";
import { useResidentes } from "@/hooks/usePlanos";
import { usePagamentosDoMes, useTabelaPreco } from "@/hooks/useMensalidades";
import { useUpsellingTodosDoMes } from "@/hooks/useUpselling";
import { chavePreco } from "@/lib/mensalidade";
import { ehPago } from "@/lib/cobranca";
import type { PagamentoMensalidade, Residente } from "@/types/database";

export interface LinhaDemonstrativo {
  residente: Residente;
  mensalidade: number;
  upselling: number;
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

  const isLoading = residentes.isLoading || tabelaPreco.isLoading || pagamentos.isLoading || upselling.isLoading;
  const isError = residentes.isError || tabelaPreco.isError || pagamentos.isError || upselling.isError;
  const error = residentes.error ?? tabelaPreco.error ?? pagamentos.error ?? upselling.error;

  const linhas: LinhaDemonstrativo[] = useMemo(() => {
    if (!residentes.data) return [];

    const precoMap = new Map((tabelaPreco.data ?? []).map((p) => [chavePreco(p.tipo_suite, p.grau, p.ocupacao), p.valor]));
    const pagamentoMap = new Map((pagamentos.data ?? []).map((p) => [p.residente_id, p]));
    const upsellingPorResidente = new Map<string, number>();
    for (const item of upselling.data ?? []) {
      upsellingPorResidente.set(item.residente_id, (upsellingPorResidente.get(item.residente_id) ?? 0) + item.valor);
    }

    return residentes.data.map((r) => {
      const mensalidade =
        r.mensalidade_valor ?? precoMap.get(chavePreco(r.tipo_suite, r.grau_dependencia, r.ocupacao)) ?? 0;
      const pagamento = pagamentoMap.get(r.id);
      const upsellingTotal = upsellingPorResidente.get(r.id) ?? 0;
      return {
        residente: r,
        mensalidade,
        upselling: upsellingTotal,
        total: mensalidade + upsellingTotal,
        pago: ehPago(pagamento?.status),
        pagamento,
      };
    });
  }, [residentes.data, tabelaPreco.data, pagamentos.data, upselling.data]);

  return {
    isLoading,
    isError,
    error,
    linhas,
    upsellingTodos: upselling.data ?? [],
  };
}
