import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
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

/** Atualiza o saldo em trânsito e/ou o limite de uma categoria. */
export function useAtualizarRouparia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; saldoAtual: number; limite: number }) => {
      const { error } = await supabase
        .from("rouparia_transito")
        .update({
          saldo_atual: args.saldoAtual,
          limite: args.limite,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ROUPARIA_KEY });
    },
  });
}
