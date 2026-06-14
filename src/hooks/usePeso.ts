import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { calcularIMC } from "@/lib/imc";
import type { RegistroPeso } from "@/types/database";

// ===========================================================================
// Peso e IMC (N6). O IMC é calculado e GRAVADO no registro (snapshot, com a
// altura usada). Quando a altura é informada, atualiza o cadastro do residente.
// ===========================================================================

const KEY = ["registros-peso"];

/** Todos os registros de peso (visão geral — último/anterior por hóspede). */
export function useTodosRegistrosPeso() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<RegistroPeso[]> => {
      const { data, error } = await supabase
        .from("registro_peso")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Histórico de peso de UM residente (para a evolução). */
export function useRegistrosPesoDoResidente(residenteId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<RegistroPeso[]> => {
      const { data, error } = await supabase
        .from("registro_peso")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("data", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type RegistrarPesoInput = {
  residenteId: string;
  pesoKg: number;
  alturaM: number | null;
  data: string;
  observacao: string | null;
  /** Se true e altura informada, atualiza altura_m do cadastro do residente. */
  atualizarAlturaCadastro?: boolean;
};

/** Registra uma pesagem (calcula e grava o IMC). */
export function useRegistrarPeso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RegistrarPesoInput) => {
      const imc = calcularIMC(args.pesoKg, args.alturaM);
      const { error } = await supabase.from("registro_peso").insert({
        residente_id: args.residenteId,
        peso_kg: args.pesoKg,
        altura_m: args.alturaM,
        imc,
        data: args.data,
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;

      if (args.atualizarAlturaCadastro && args.alturaM && args.alturaM > 0) {
        await supabase.from("residentes").update({ altura_m: args.alturaM }).eq("id", args.residenteId);
      }
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["residentes"] });
      qc.invalidateQueries({ queryKey: ["ultimo-peso", args.residenteId] });
    },
  });
}

/** Remove um registro de peso. */
export function useRemoverRegistroPeso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("registro_peso").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Últimos registros de peso de UM residente (para a leitura na ficha/360º). */
export function useUltimosPesos(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["ultimo-peso", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<RegistroPeso[]> => {
      const { data, error } = await supabase
        .from("registro_peso")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("data", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });
}
