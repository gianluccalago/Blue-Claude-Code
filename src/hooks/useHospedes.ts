import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Residente } from "@/types/database";

/** Residentes designados a um cuidador (via cuidador_residente). */
export function useHospedesDesignados(cuidadorId: string) {
  return useQuery({
    queryKey: ["hospedes", cuidadorId],
    queryFn: async (): Promise<Residente[]> => {
      const { data: links, error: linkErr } = await supabase
        .from("cuidador_residente")
        .select("residente_id")
        .eq("cuidador_id", cuidadorId);
      if (linkErr) throw linkErr;

      const ids = (links ?? []).map((l) => l.residente_id);
      if (ids.length === 0) return [];

      const { data, error } = await supabase.from("residentes").select("*").in("id", ids);
      if (error) throw error;

      const residentes = data ?? [];
      residentes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return residentes;
    },
  });
}
