import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import type { PeriodoMedicacao, Prescricao, StatusAdministracao } from "@/types/database";

export function usePrescricoes(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["prescricoes", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<Prescricao[]> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRegistrarAdministracao(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      periodo: PeriodoMedicacao;
      status: StatusAdministracao;
      itensFaltantes?: string | null;
    }) => {
      const { error } = await supabase.from("administracao").insert({
        residente_id: residenteId,
        periodo: args.periodo,
        status: args.status,
        itens_faltantes: args.itensFaltantes ?? null,
        administrado_por: CUIDADOR_ATUAL.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["administracao", residenteId] }),
  });
}
