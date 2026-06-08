import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hojeISO } from "@/lib/utils";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import type { PlanoCuidadoItem, TarefaRegistro } from "@/types/database";

export function usePlanoCuidado(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["plano", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<PlanoCuidadoItem[]> => {
      const { data, error } = await supabase
        .from("plano_cuidado_item")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", true)
        .order("horario", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRegistrosHoje(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["registros", residenteId, hojeISO()],
    enabled: !!residenteId,
    queryFn: async (): Promise<TarefaRegistro[]> => {
      const { data, error } = await supabase
        .from("tarefa_registro")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("data", hojeISO());
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidarRegistros(qc: ReturnType<typeof useQueryClient>, residenteId: string) {
  qc.invalidateQueries({ queryKey: ["registros", residenteId, hojeISO()] });
}

/** Marca uma tarefa do plano como feita (grava em tarefa_registro). */
export function useMarcarTarefa(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { tarefa: string; horario?: string | null }) => {
      const { error } = await supabase.from("tarefa_registro").insert({
        residente_id: residenteId,
        tarefa: args.tarefa,
        horario: args.horario ?? null,
        status: "feito",
        feito_por: CUIDADOR_ATUAL.nome,
        data: hojeISO(),
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarRegistros(qc, residenteId),
  });
}

/** Remove um registro (desmarcar) pelo id. */
export function useRemoverRegistro(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (registroId: string) => {
      const { error } = await supabase.from("tarefa_registro").delete().eq("id", registroId);
      if (error) throw error;
    },
    onSuccess: () => invalidarRegistros(qc, residenteId),
  });
}
