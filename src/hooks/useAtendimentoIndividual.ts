import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type {
  AtendimentoIndividual,
  CategoriaUpselling,
  TipoAtendimentoIndividual,
} from "@/types/database";

// ===========================================================================
// Atendimento individual da Equipe Multidisciplinar (registro clínico) e a
// PRECIFICAÇÃO pela Administração (gera lançamento no upselling existente).
// ===========================================================================

const TODOS_KEY = ["atendimentos-individuais"];

/** Registra uma sessão individual (Multi). Sai no nome do profissional logado. */
export function useRegistrarAtendimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      tipo: TipoAtendimentoIndividual;
      data: string;
      evolucao: string | null;
    }) => {
      const { error } = await supabase.from("atendimento_individual").insert({
        residente_id: args.residenteId,
        tipo: args.tipo,
        data: args.data,
        evolucao: args.evolucao?.trim() || null,
        realizado_por: usuarioAtual.nome,
        perfil_realizador: usuarioAtual.perfil,
      });
      if (error) throw error;
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["atendimentos-residente", args.residenteId] });
      qc.invalidateQueries({ queryKey: TODOS_KEY });
    },
  });
}

/** Atendimentos de um residente (histórico clínico). A Multi filtra os seus na UI. */
export function useAtendimentosDoResidente(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["atendimentos-residente", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<AtendimentoIndividual[]> => {
      const { data, error } = await supabase
        .from("atendimento_individual")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Todos os atendimentos (Administração — precificação). */
export function useAtendimentosTodos() {
  return useQuery({
    queryKey: TODOS_KEY,
    queryFn: async (): Promise<AtendimentoIndividual[]> => {
      const { data, error } = await supabase
        .from("atendimento_individual")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Marca atendimentos como "não cobrar" (inclusos no pacote do hóspede). */
export function useNaoCobrarAtendimentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ids: string[] }) => {
      if (args.ids.length === 0) return;
      const { error } = await supabase
        .from("atendimento_individual")
        .update({ status_cobranca: "nao_cobrar", upselling_id: null })
        .in("id", args.ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: TODOS_KEY }),
  });
}

/**
 * Cobra um ou VÁRIOS atendimentos do MESMO hóspede/mês: cria UM lançamento de
 * upselling (id gerado no cliente para vincular sem RETURNING) e marca todos os
 * atendimentos como "cobrado" apontando para esse upselling_id.
 */
export function useCobrarAtendimentos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      ids: string[];
      residenteId: string;
      categoria: CategoriaUpselling;
      descricao: string;
      valor: number;
      data: string;
      mesReferencia: string;
    }) => {
      if (args.ids.length === 0) return;
      const upsellingId = crypto.randomUUID();
      const { error: errU } = await supabase.from("upselling").insert({
        id: upsellingId,
        residente_id: args.residenteId,
        categoria: args.categoria,
        descricao: args.descricao.trim() || null,
        valor: args.valor,
        data: args.data,
        mes_referencia: args.mesReferencia,
        lancado_por: usuarioAtual.nome,
      });
      if (errU) throw errU;

      const { error: errA } = await supabase
        .from("atendimento_individual")
        .update({ status_cobranca: "cobrado", upselling_id: upsellingId })
        .in("id", args.ids);
      if (errA) throw errA;
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: TODOS_KEY });
      qc.invalidateQueries({ queryKey: ["upselling-todos", args.mesReferencia] });
      qc.invalidateQueries({ queryKey: ["upselling", args.residenteId, args.mesReferencia] });
    },
  });
}
