import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { dataISO, somarDias } from "@/lib/utils";
import { NUTRI_ATUAL } from "@/data/profiles";
import type { Dieta, EvolucaoNutricional, TarefaRegistro } from "@/types/database";

// ─── Dietas ───────────────────────────────────────────────────────────────────

/** Dieta ativa de um residente (ou null se nenhuma foi definida). */
export function useDietaAtiva(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["dieta-ativa", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<Dieta | null> => {
      const { data, error } = await supabase
        .from("dieta")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", true)
        .order("definida_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

/** Histórico de dietas anteriores de um residente, mais recente primeiro. */
export function useHistoricoDietas(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["dieta-historico", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<Dieta[]> => {
      const { data, error } = await supabase
        .from("dieta")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", false)
        .order("definida_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type DefinirDietaInput = {
  consistencia: string;
  restricoes: string[];
  observacoes: string | null;
};

/** Marca a dieta ativa atual como histórica e cria a nova dieta ativa. */
export function useDefinirDieta(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: DefinirDietaInput) => {
      const { error: errUpd } = await supabase
        .from("dieta")
        .update({ ativa: false })
        .eq("residente_id", residenteId)
        .eq("ativa", true);
      if (errUpd) throw errUpd;

      const { error } = await supabase.from("dieta").insert({
        residente_id: residenteId,
        consistencia: args.consistencia,
        restricoes: args.restricoes.length > 0 ? args.restricoes : null,
        observacoes: args.observacoes,
        ativa: true,
        definida_por: NUTRI_ATUAL.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dieta-ativa", residenteId] });
      qc.invalidateQueries({ queryKey: ["dieta-historico", residenteId] });
    },
  });
}

// ─── Evolução nutricional ───────────────────────────────────────────────────────

/** Histórico de evolução nutricional de um residente, mais recente primeiro. */
export function useEvolucaoNutricional(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["evolucao-nutricional", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<EvolucaoNutricional[]> => {
      const { data, error } = await supabase
        .from("evolucao_nutricional")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("registrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Registra um novo texto de evolução nutricional para o residente. */
export function useRegistrarEvolucaoNutricional(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (texto: string) => {
      const { error } = await supabase.from("evolucao_nutricional").insert({
        residente_id: residenteId,
        texto,
        registrado_por: NUTRI_ATUAL.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["evolucao-nutricional", residenteId] }),
  });
}

// ─── Acompanhamento — aceitação alimentar ────────────────────────────────────────

/** Registros de "Aceitação [refeição]: [nível]" de um residente nos últimos `dias` dias. */
export function useAceitacaoPeriodo(residenteId: string | undefined, dias = 7) {
  return useQuery({
    queryKey: ["aceitacao", residenteId, dias],
    enabled: !!residenteId,
    queryFn: async (): Promise<TarefaRegistro[]> => {
      const desde = dataISO(somarDias(new Date(), -(dias - 1)));
      const { data, error } = await supabase
        .from("tarefa_registro")
        .select("*")
        .eq("residente_id", residenteId!)
        .gte("data", desde)
        .like("tarefa", "Aceitação %")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Registros de aceitação alimentar de TODOS os residentes nos últimos `dias` dias (visão geral). */
export function useAceitacaoTodos(dias = 7) {
  return useQuery({
    queryKey: ["aceitacao-todos", dias],
    queryFn: async (): Promise<TarefaRegistro[]> => {
      const desde = dataISO(somarDias(new Date(), -(dias - 1)));
      const { data, error } = await supabase
        .from("tarefa_registro")
        .select("*")
        .gte("data", desde)
        .like("tarefa", "Aceitação %");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Último registro de peso de um residente (lido de tarefa_registro, tarefa
 * "Peso: <valor>"). Hoje o checklist não estrutura o peso mensal — quando
 * isso for feito, este hook deve passar a ler da nova estrutura.
 */
export function useUltimoPeso(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["peso", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<TarefaRegistro | null> => {
      const { data, error } = await supabase
        .from("tarefa_registro")
        .select("*")
        .eq("residente_id", residenteId!)
        .like("tarefa", "Peso:%")
        .order("data", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}
