import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hojeISO } from "@/lib/utils";
import type {
  CategoriaInsumo,
  Fornecedor,
  Insumo,
  UnidadeInsumo,
} from "@/types/database";

// ===========================================================================
// Cadastro de FORNECEDORES e INSUMOS (Nutricionista). Ao alterar o custo de um
// insumo, o valor anterior vai para insumo_preco_historico (trilha de preço).
// ===========================================================================

// ─── Fornecedores ───────────────────────────────────────────────────────────

export function useFornecedores() {
  return useQuery({
    queryKey: ["fornecedores"],
    queryFn: async (): Promise<Fornecedor[]> => {
      const { data, error } = await supabase
        .from("fornecedor")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type FornecedorInput = {
  nome: string;
  categoriaPrincipal: string;
  contato: string | null;
};

export function useSalvarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id?: string } & FornecedorInput) => {
      const linha = {
        nome: args.nome.trim(),
        categoria_principal: args.categoriaPrincipal.trim(),
        contato: args.contato?.trim() || null,
      };
      if (args.id) {
        const { error } = await supabase.from("fornecedor").update(linha).eq("id", args.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedor").insert(linha);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fornecedores"] }),
  });
}

/** Inativa (não exclui) um fornecedor. */
export function useInativarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("fornecedor").update({ ativo: args.ativo }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fornecedores"] }),
  });
}

// ─── Insumos ────────────────────────────────────────────────────────────────

export function useInsumos() {
  return useQuery({
    queryKey: ["insumos"],
    queryFn: async (): Promise<Insumo[]> => {
      const { data, error } = await supabase
        .from("insumo")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type InsumoInput = {
  nome: string;
  categoria: CategoriaInsumo;
  unidade: UnidadeInsumo;
  custoUnitario: number;
  fornecedorId: string | null;
  observacao: string | null;
};

/** Cria um insumo novo. */
export function useCriarInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: InsumoInput) => {
      const { error } = await supabase.from("insumo").insert({
        nome: args.nome.trim(),
        categoria: args.categoria,
        unidade: args.unidade,
        custo_unitario: args.custoUnitario,
        fornecedor_id: args.fornecedorId,
        observacao: args.observacao?.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insumos"] }),
  });
}

/**
 * Edita um insumo. Se o CUSTO mudar, grava o valor ANTERIOR em
 * insumo_preco_historico (vigente desde a última atualização) antes de
 * sobrescrever — trilha do preço de contrato.
 */
export function useEditarInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string } & InsumoInput) => {
      const { data: atual } = await supabase
        .from("insumo")
        .select("custo_unitario, atualizado_em")
        .eq("id", args.id)
        .maybeSingle();

      const custoAnterior = atual?.custo_unitario ?? null;
      if (custoAnterior !== null && Number(custoAnterior) !== args.custoUnitario) {
        const vigenteDesde = (atual?.atualizado_em ?? hojeISO()).slice(0, 10);
        const { error: errH } = await supabase.from("insumo_preco_historico").insert({
          insumo_id: args.id,
          custo_unitario: custoAnterior,
          vigente_desde: vigenteDesde,
        });
        if (errH) throw errH;
      }

      const { error } = await supabase
        .from("insumo")
        .update({
          nome: args.nome.trim(),
          categoria: args.categoria,
          unidade: args.unidade,
          custo_unitario: args.custoUnitario,
          fornecedor_id: args.fornecedorId,
          observacao: args.observacao?.trim() || null,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insumos"] }),
  });
}

/** Inativa (não exclui) um insumo. */
export function useInativarInsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("insumo").update({ ativo: args.ativo }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insumos"] }),
  });
}
