import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { ObraCustoIndireto } from "@/types/database";

// ===========================================================================
// Módulo Obra — custos indiretos (engenheiro, assinaturas, administrativo,
// taxas, gastos gerais) com competência mensal. Alimentam o painel e o
// financeiro consolidado. master/direção (RLS).
// ===========================================================================

export function useCustosIndiretos() {
  return useQuery({
    queryKey: ["obra-custos-indiretos"],
    queryFn: async (): Promise<ObraCustoIndireto[]> => {
      const { data, error } = await supabase
        .from("obra_custos_indiretos")
        .select("*")
        .order("competencia", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useCriarCustoIndireto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      competencia: string;
      categoria: string;
      descricao: string;
      valor: number;
      recorrente?: boolean;
      observacao?: string;
    }) => {
      const { error } = await supabase.from("obra_custos_indiretos").insert({
        competencia: args.competencia,
        categoria: args.categoria,
        descricao: args.descricao.trim(),
        valor: args.valor,
        recorrente: args.recorrente ?? false,
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-custos-indiretos"] }),
  });
}

export function useExcluirCustoIndireto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_custos_indiretos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-custos-indiretos"] }),
  });
}
