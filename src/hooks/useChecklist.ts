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

/**
 * Registros de tarefas de UMA data (`tarefa_registro.data`). Por padrão o dia
 * civil de hoje; o Checklist passa a DATA DO PLANTÃO (lib/plantao): no noturno
 * de 24/09 a tarefa das 06h de 25/09 é gravada e lida em 24/09 — sem isto, à
 * meia-noite o checklist "virava o dia" e perdia o que já tinha sido feito.
 */
export function useRegistrosHoje(residenteId: string | undefined, data: string = hojeISO()) {
  return useQuery({
    queryKey: ["registros", residenteId, data],
    enabled: !!residenteId,
    queryFn: async (): Promise<TarefaRegistro[]> => {
      const { data: rows, error } = await supabase
        .from("tarefa_registro")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("data", data);
      if (error) throw error;
      return rows ?? [];
    },
  });
}

function invalidarRegistros(qc: ReturnType<typeof useQueryClient>, residenteId: string) {
  // Prefixo: invalida todas as datas carregadas (plantão atual e anterior).
  qc.invalidateQueries({ queryKey: ["registros", residenteId] });
}

/** Marca uma tarefa do plano como feita (grava em tarefa_registro na data do plantão). */
export function useMarcarTarefa(residenteId: string, data: string = hojeISO()) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { tarefa: string; horario?: string | null }) => {
      const { error } = await supabase.from("tarefa_registro").insert({
        residente_id: residenteId,
        tarefa: args.tarefa,
        horario: args.horario ?? null,
        status: "feito",
        feito_por: CUIDADOR_ATUAL.nome,
        data,
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

/**
 * Define o nível de aceitação de uma refeição em UMA operação:
 * - se já existe registro da refeição no plantão, faz UPDATE do campo `tarefa`;
 * - caso contrário, INSERT.
 * Evita o padrão frágil de remover-e-inserir (que pode deixar sem registro
 * ou duplicado se algo falhar no meio).
 */
export function useDefinirRefeicao(residenteId: string, data: string = hojeISO()) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { registroId?: string; tarefa: string }) => {
      if (args.registroId) {
        const { error } = await supabase
          .from("tarefa_registro")
          .update({ tarefa: args.tarefa, feito_por: CUIDADOR_ATUAL.nome, feito_em: new Date().toISOString() })
          .eq("id", args.registroId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tarefa_registro").insert({
          residente_id: residenteId,
          tarefa: args.tarefa,
          status: "feito",
          feito_por: CUIDADOR_ATUAL.nome,
          data,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidarRegistros(qc, residenteId),
  });
}
