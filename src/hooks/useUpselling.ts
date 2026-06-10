import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ADMIN_ATUAL } from "@/data/profiles";
import { uploadComprovanteUpselling } from "@/lib/storage";
import type { CategoriaUpselling, Upselling } from "@/types/database";

/** Lançamentos de upselling de um hóspede em um mês de referência ("YYYY-MM"). */
export function useLancamentosDoMes(residenteId: string | undefined, mes: string) {
  return useQuery({
    queryKey: ["upselling", residenteId, mes],
    queryFn: async (): Promise<Upselling[]> => {
      const { data, error } = await supabase
        .from("upselling")
        .select("*")
        .eq("residente_id", residenteId as string)
        .eq("mes_referencia", mes)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!residenteId,
  });
}

/** Todos os lançamentos de upselling de um mês (todos os hóspedes), para a visão geral. */
export function useUpsellingTodosDoMes(mes: string) {
  return useQuery({
    queryKey: ["upselling-todos", mes],
    queryFn: async (): Promise<Upselling[]> => {
      const { data, error } = await supabase
        .from("upselling")
        .select("*")
        .eq("mes_referencia", mes);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type LancarUpsellingInput = {
  categoria: CategoriaUpselling;
  descricao: string | null;
  valor: number;
  data: string;
  mesReferencia: string;
  comprovante: File | null;
};

/**
 * Lança uma despesa extra (upselling) para um hóspede.
 * Lançamento manual por ora; a automação via módulo de compras da farmácia
 * poderá alimentar esta tabela no futuro.
 */
export function useLancarUpselling(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: LancarUpsellingInput) => {
      let comprovanteUrl: string | null = null;
      if (args.comprovante) {
        comprovanteUrl = await uploadComprovanteUpselling(args.comprovante, residenteId, args.mesReferencia);
      }
      const { error } = await supabase.from("upselling").insert({
        residente_id: residenteId,
        categoria: args.categoria,
        descricao: args.descricao,
        valor: args.valor,
        data: args.data,
        mes_referencia: args.mesReferencia,
        comprovante_url: comprovanteUrl,
        lancado_por: ADMIN_ATUAL.nome,
      });
      if (error) throw error;
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["upselling", residenteId, args.mesReferencia] });
      qc.invalidateQueries({ queryKey: ["upselling-todos", args.mesReferencia] });
    },
  });
}

export type EditarUpsellingInput = {
  id: string;
  mes: string;
  categoria: CategoriaUpselling;
  descricao: string | null;
  valor: number;
  data: string;
  comprovante: File | null;
};

/** Edita um lançamento de upselling existente. */
export function useEditarUpselling(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: EditarUpsellingInput) => {
      let comprovanteUrl: string | undefined;
      if (args.comprovante) {
        const url = await uploadComprovanteUpselling(args.comprovante, residenteId, args.mes);
        if (url) comprovanteUrl = url;
      }
      const { error } = await supabase
        .from("upselling")
        .update({
          categoria: args.categoria,
          descricao: args.descricao,
          valor: args.valor,
          data: args.data,
          ...(comprovanteUrl ? { comprovante_url: comprovanteUrl } : {}),
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["upselling", residenteId, args.mes] });
      qc.invalidateQueries({ queryKey: ["upselling-todos", args.mes] });
    },
  });
}

/** Remove um lançamento de upselling. */
export function useRemoverUpselling(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; mes: string }) => {
      const { error } = await supabase.from("upselling").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["upselling", residenteId, args.mes] });
      qc.invalidateQueries({ queryKey: ["upselling-todos", args.mes] });
    },
  });
}
