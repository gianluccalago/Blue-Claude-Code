import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ObraBaseline } from "@/types/database";

// ===========================================================================
// Módulo Obra — Fase 5: baseline orçamentário (financeiro consolidado).
// Os demais dados (medições, marcos, OCs, fases) vêm dos hooks das fases 2–4;
// a agregação é feita na tela. master/direção apenas (RLS).
// ===========================================================================

export function useBaseline() {
  return useQuery({
    queryKey: ["obra-baseline"],
    queryFn: async (): Promise<ObraBaseline[]> => {
      const { data, error } = await supabase.from("obra_baseline").select("*").order("grupo");
      if (error) return [];
      return data ?? [];
    },
  });
}

/** Ajusta o valor orçado de um pacote da baseline. */
export function useAtualizarBaseline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; valorOrcado: number; observacao?: string | null }) => {
      const { error } = await supabase
        .from("obra_baseline")
        .update({ valor_orcado: args.valorOrcado, observacao: args.observacao ?? null })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-baseline"] }),
  });
}
