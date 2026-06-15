import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadComprovanteMaterial } from "@/lib/storage";
import type { CategoriaMaterial, CustoMaterial } from "@/types/database";

// ===========================================================================
// Custos de materiais (limpeza e manutenção) — despesas da Administração.
// Alimenta useResumoMes.custoMateriais (fonte única; não cria indicador novo).
// RLS: gestão (Administração/Direção/Master).
// ===========================================================================

/** Lançamentos de material de um mês de referência ("YYYY-MM"). */
export function useCustosMateriaisDoMes(mes: string) {
  return useQuery({
    queryKey: ["custo-material", mes],
    queryFn: async (): Promise<CustoMaterial[]> => {
      const { data, error } = await supabase
        .from("custo_material")
        .select("*")
        .eq("mes_referencia", mes)
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SalvarMaterialInput {
  id?: string;
  categoria: CategoriaMaterial;
  descricao: string;
  valor: number;
  fornecedor: string | null;
  data: string;
  mesReferencia: string;
  comprovante: File | null;
}

/** Lança (novo) ou edita uma despesa de material. */
export function useSalvarCustoMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalvarMaterialInput) => {
      let comprovanteUrl: string | undefined;
      if (input.comprovante) {
        const url = await uploadComprovanteMaterial(input.comprovante, input.categoria, input.mesReferencia);
        if (url) comprovanteUrl = url;
      }
      if (input.id) {
        const { error } = await supabase
          .from("custo_material")
          .update({
            categoria: input.categoria,
            descricao: input.descricao,
            valor: input.valor,
            fornecedor: input.fornecedor,
            data: input.data,
            ...(comprovanteUrl ? { comprovante_url: comprovanteUrl } : {}),
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("custo_material").insert({
          categoria: input.categoria,
          descricao: input.descricao,
          valor: input.valor,
          fornecedor: input.fornecedor,
          data: input.data,
          mes_referencia: input.mesReferencia,
          comprovante_url: comprovanteUrl ?? null,
          registrado_por: usuarioAtual.nome,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_r, input) => {
      qc.invalidateQueries({ queryKey: ["custo-material", input.mesReferencia] });
    },
  });
}

/** Remove uma despesa de material. */
export function useRemoverCustoMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; mes: string }) => {
      const { error } = await supabase.from("custo_material").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, args) => qc.invalidateQueries({ queryKey: ["custo-material", args.mes] }),
  });
}
