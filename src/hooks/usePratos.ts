import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { CategoriaPrato, Prato, PratoInsumo } from "@/types/database";

// ===========================================================================
// Pratos (fichas técnicas). O custo NÃO é guardado: é sempre recalculado na
// tela a partir das linhas (prato_insumo) × custo ATUAL do insumo. Assim, se o
// preço de um insumo muda no N1, o custo do prato reflete na hora.
// ===========================================================================

const PRATOS_KEY = ["pratos"];
const PRATO_INSUMOS_KEY = ["prato-insumos"];

export function usePratos() {
  return useQuery({
    queryKey: PRATOS_KEY,
    queryFn: async (): Promise<Prato[]> => {
      const { data, error } = await supabase
        .from("prato")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** TODAS as linhas de insumo dos pratos (para calcular custo de cada um). */
export function useTodosPratoInsumos() {
  return useQuery({
    queryKey: PRATO_INSUMOS_KEY,
    queryFn: async (): Promise<PratoInsumo[]> => {
      const { data, error } = await supabase.from("prato_insumo").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type LinhaPratoInput = { insumoId: string; quantidade: number };

export type SalvarPratoInput = {
  id?: string;
  nome: string;
  categoria: CategoriaPrato;
  rendimentoPorcoes: number;
  modoPreparo: string | null;
  observacao: string | null;
  linhas: LinhaPratoInput[];
};

/** Cria/edita um prato e SUBSTITUI suas linhas de insumo (replace completo). */
export function useSalvarPrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: SalvarPratoInput) => {
      const dados = {
        nome: args.nome.trim(),
        categoria: args.categoria,
        rendimento_porcoes: args.rendimentoPorcoes,
        modo_preparo: args.modoPreparo?.trim() || null,
        observacao: args.observacao?.trim() || null,
      };

      let pratoId = args.id;
      if (pratoId) {
        const { error } = await supabase
          .from("prato")
          .update({ ...dados, atualizado_em: new Date().toISOString() })
          .eq("id", pratoId);
        if (error) throw error;
      } else {
        pratoId = crypto.randomUUID();
        const { error } = await supabase.from("prato").insert({ id: pratoId, ...dados });
        if (error) throw error;
      }

      // Substitui as linhas: apaga as antigas e insere as novas.
      const { error: errDel } = await supabase.from("prato_insumo").delete().eq("prato_id", pratoId);
      if (errDel) throw errDel;

      const linhas = args.linhas
        .filter((l) => l.insumoId && l.quantidade > 0)
        .map((l) => ({ prato_id: pratoId!, insumo_id: l.insumoId, quantidade: l.quantidade }));
      if (linhas.length > 0) {
        const { error: errIns } = await supabase.from("prato_insumo").insert(linhas);
        if (errIns) throw errIns;
      }
      return pratoId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PRATOS_KEY });
      qc.invalidateQueries({ queryKey: PRATO_INSUMOS_KEY });
    },
  });
}

/** Inativa (não exclui) um prato. */
export function useInativarPrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("prato").update({ ativo: args.ativo }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: PRATOS_KEY }),
  });
}
