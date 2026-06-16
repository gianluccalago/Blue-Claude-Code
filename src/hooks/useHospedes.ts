import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Residente } from "@/types/database";

/**
 * Residentes designados a um cuidador (via cuidador_residente). Só faz sentido
 * para perfis de ponta (cuidador/enfermagem); os demais (ex.: Nutricionista,
 * que coordena a casa inteira) NÃO têm designação e veem todos — por isso o
 * `enabled` evita até disparar a consulta de designação para eles.
 */
export function useHospedesDesignados(cuidadorId: string, enabled = true) {
  return useQuery({
    queryKey: ["hospedes", cuidadorId],
    enabled: enabled && !!cuidadorId,
    queryFn: async (): Promise<Residente[]> => {
      const { data: links, error: linkErr } = await supabase
        .from("cuidador_residente")
        .select("residente_id")
        .eq("cuidador_id", cuidadorId);
      if (linkErr) throw linkErr;

      const ids = (links ?? []).map((l) => l.residente_id);
      if (ids.length === 0) return [];

      // Só ATIVOS que ocupam leito: inativado some; day care não entra no
      // checklist de cuidado 24h (é atendido na tela própria de Day Care).
      const { data, error } = await supabase
        .from("residentes")
        .select("*")
        .in("id", ids)
        .eq("status_hospede", "ativo")
        .neq("modalidade", "day_care");
      if (error) throw error;

      const residentes = data ?? [];
      residentes.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return residentes;
    },
  });
}
