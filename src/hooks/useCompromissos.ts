import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import type { CompromissoExterno } from "@/types/database";

export function useCompromissos(residenteIds: string[]) {
  return useQuery({
    queryKey: ["compromissos", residenteIds],
    enabled: residenteIds.length > 0,
    queryFn: async (): Promise<CompromissoExterno[]> => {
      const { data, error } = await supabase
        .from("compromisso_externo")
        .select("*")
        .in("residente_id", residenteIds)
        .order("data", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useDarCiencia(residenteIds: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (compromissoId: string) => {
      const { error } = await supabase
        .from("compromisso_externo")
        .update({ ciente_por: CUIDADOR_ATUAL.nome, ciente_em: new Date().toISOString() })
        .eq("id", compromissoId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["compromissos", residenteIds] }),
  });
}
