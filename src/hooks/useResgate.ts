import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { BaixaResgate, EstoqueResgate } from "@/types/database";

export function useEstoqueResgate() {
  return useQuery({
    queryKey: ["estoque-resgate"],
    queryFn: async (): Promise<EstoqueResgate[]> => {
      const { data, error } = await supabase
        .from("estoque_resgate")
        .select("*")
        .order("medicamento");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useBaixasResgate() {
  return useQuery({
    queryKey: ["baixas-resgate"],
    queryFn: async (): Promise<BaixaResgate[]> => {
      const { data, error } = await supabase
        .from("baixa_resgate")
        .select("*")
        .order("registrado_em", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Cria um novo item de resgate (apenas Farmácia). */
export function useCriarItemResgate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { medicamento: string; quantidade: number; unidade: string }) => {
      const { error } = await supabase.from("estoque_resgate").insert({
        medicamento: args.medicamento,
        quantidade_atual: args.quantidade,
        unidade: args.unidade,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-resgate"] }),
  });
}

/** Repõe estoque de um item existente (apenas Farmácia). */
export function useReporItemResgate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      quantidadeAnterior: number;
      quantidadeRecebida: number;
    }) => {
      const { error } = await supabase
        .from("estoque_resgate")
        .update({ quantidade_atual: args.quantidadeAnterior + args.quantidadeRecebida })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["estoque-resgate"] }),
  });
}

/** Registra uso/baixa de um item de resgate (Farmácia, Coordenação ou Médico). */
export function useRegistrarBaixaResgate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      estoqueId: string;
      residenteId: string;
      quantidade: number;
      motivo: string;
      administradoPor: string;
      perfilResponsavel: "farmacia" | "coordenacao" | "medico";
      quantidadeAtualAntes: number;
    }) => {
      const { error: errB } = await supabase.from("baixa_resgate").insert({
        estoque_resgate_id: args.estoqueId,
        residente_id: args.residenteId,
        quantidade: args.quantidade,
        motivo: args.motivo,
        administrado_por: args.administradoPor,
        perfil_responsavel: args.perfilResponsavel,
      });
      if (errB) throw errB;
      // Decrementa — saldo pode ficar negativo; farmácia reconcilia
      const { error: errE } = await supabase
        .from("estoque_resgate")
        .update({ quantidade_atual: args.quantidadeAtualAntes - args.quantidade })
        .eq("id", args.estoqueId);
      if (errE) throw errE;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-resgate"] });
      qc.invalidateQueries({ queryKey: ["baixas-resgate"] });
    },
  });
}
