import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ADMIN_ATUAL } from "@/data/profiles";
import type { Ocupacao, PagamentoMensalidade, TabelaPreco, TipoSuite } from "@/types/database";

// ─── Tabela de preços ───────────────────────────────────────────────────────────

/** As 12 combinações de tipo de suíte × grau de dependência e seus valores. */
export function useTabelaPreco() {
  return useQuery({
    queryKey: ["tabela-preco"],
    queryFn: async (): Promise<TabelaPreco[]> => {
      const { data, error } = await supabase.from("tabela_preco").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Atualiza o valor de uma combinação tipo de suíte × grau. */
export function useAtualizarPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: number }) => {
      const { error } = await supabase.from("tabela_preco").update({ valor }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tabela-preco"] }),
  });
}

// ─── Dados de suíte/ocupação/mensalidade do residente ────────────────────────────

export type AjustarMensalidadeInput = {
  tipoSuite: TipoSuite | null;
  ocupacao: Ocupacao | null;
  valor: number | null;
  ajusteObs: string | null;
};

/** Atualiza tipo de suíte, ocupação e a mensalidade vigente de um residente. */
export function useAjustarMensalidade(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: AjustarMensalidadeInput) => {
      const { error } = await supabase
        .from("residentes")
        .update({
          tipo_suite: args.tipoSuite,
          ocupacao: args.ocupacao,
          mensalidade_valor: args.valor,
          mensalidade_ajuste_obs: args.ajusteObs,
        })
        .eq("id", residenteId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["residentes"] }),
  });
}

// ─── Pagamentos ─────────────────────────────────────────────────────────────────

/** Pagamentos registrados para um mês de referência ("YYYY-MM"). */
export function usePagamentosDoMes(mes: string) {
  return useQuery({
    queryKey: ["pagamentos-mensalidade", mes],
    queryFn: async (): Promise<PagamentoMensalidade[]> => {
      const { data, error } = await supabase
        .from("pagamento_mensalidade")
        .select("*")
        .eq("mes_referencia", mes);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type MarcarPagamentoInput = {
  residenteId: string;
  mes: string;
  valor: number;
  pago: boolean;
};

/** Marca a mensalidade de um residente/mês como paga (registra) ou pendente (remove o registro). */
export function useMarcarPagamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: MarcarPagamentoInput) => {
      if (args.pago) {
        const { error } = await supabase.from("pagamento_mensalidade").upsert(
          {
            residente_id: args.residenteId,
            mes_referencia: args.mes,
            valor: args.valor,
            status: "pago",
            pago_em: new Date().toISOString(),
            registrado_por: ADMIN_ATUAL.nome,
          },
          { onConflict: "residente_id,mes_referencia" },
        );
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pagamento_mensalidade")
          .delete()
          .eq("residente_id", args.residenteId)
          .eq("mes_referencia", args.mes);
        if (error) throw error;
      }
    },
    onSuccess: (_r, args) => qc.invalidateQueries({ queryKey: ["pagamentos-mensalidade", args.mes] }),
  });
}
