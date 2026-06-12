import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { registrarLogAlteracao } from "@/hooks/useLogAlteracao";
import type { RoupariaTransito } from "@/types/database";

const ROUPARIA_KEY = ["rouparia-transito"];

/** Saldo em trânsito por categoria de rouparia, ordenado por categoria. */
export function useRouparia() {
  return useQuery({
    queryKey: ROUPARIA_KEY,
    queryFn: async (): Promise<RoupariaTransito[]> => {
      const { data, error } = await supabase
        .from("rouparia_transito")
        .select("*")
        .order("categoria");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Atualiza o saldo em trânsito e/ou o limite de uma categoria, gravando cada
 * mudança na trilha (log_alteracao, imutável): a movimentação não é mais uma
 * edição silenciosa — correção é um NOVO lançamento na trilha (estorno),
 * nunca reescrita do histórico.
 */
export function useAtualizarRouparia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; saldoAtual: number; limite: number }) => {
      const { data: atual } = await supabase
        .from("rouparia_transito")
        .select("saldo_atual, limite")
        .eq("id", args.id)
        .maybeSingle();
      const { error } = await supabase
        .from("rouparia_transito")
        .update({
          saldo_atual: args.saldoAtual,
          limite: args.limite,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", args.id);
      if (error) throw error;
      await registrarLogAlteracao([
        { tabelaOrigem: "rouparia_transito", registroId: args.id, campo: "saldo_atual", valorAnterior: atual?.saldo_atual ?? null, valorNovo: args.saldoAtual },
        { tabelaOrigem: "rouparia_transito", registroId: args.id, campo: "limite", valorAnterior: atual?.limite ?? null, valorNovo: args.limite },
      ]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROUPARIA_KEY });
    },
  });
}
