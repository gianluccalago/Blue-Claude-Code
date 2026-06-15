import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { Enxoval, EnxovalCategoria, EnxovalMovimento, EnxovalMovimentoTipo } from "@/types/database";

// ===========================================================================
// Enxoval da casa (Lavanderia interna). Controla patrimônio (total), disponível
// limpo e reposição (mínimo). Movimentos: entrada (compra), baixa_perda (saiu
// do patrimônio) e ajuste (acerto da contagem de limpas). RLS: grava
// Lavanderia+Master; lê também Administração/Direção.
// ===========================================================================

const ENXOVAL_KEY = ["enxoval"];
const MOV_KEY = ["enxoval-movimentos"];

/** Itens de enxoval, por categoria e descrição. */
export function useEnxoval() {
  return useQuery({
    queryKey: ENXOVAL_KEY,
    queryFn: async (): Promise<Enxoval[]> => {
      const { data, error } = await supabase
        .from("enxoval")
        .select("*")
        .order("categoria")
        .order("descricao");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Movimentos recentes (para o resumo do mês e histórico). */
export function useMovimentosEnxoval() {
  return useQuery({
    queryKey: MOV_KEY,
    queryFn: async (): Promise<EnxovalMovimento[]> => {
      const { data, error } = await supabase
        .from("enxoval_movimento")
        .select("*")
        .order("registrado_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SalvarItemInput {
  id?: string;
  categoria: EnxovalCategoria;
  descricao: string;
  estoqueMinimo: number;
  observacao?: string | null;
  /** Apenas no cadastro (novo item): patrimônio inicial e disponível inicial. */
  quantidadeTotal?: number;
  quantidadeDisponivel?: number;
}

/** Cadastra (novo) ou edita metadados de um item. Quantidades mudam por movimento. */
export function useSalvarEnxovalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalvarItemInput) => {
      if (input.id) {
        // Edição: metadados (quantidades só por movimento).
        const { error } = await supabase
          .from("enxoval")
          .update({
            categoria: input.categoria,
            descricao: input.descricao,
            estoque_minimo: input.estoqueMinimo,
            observacao: input.observacao ?? null,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", input.id);
        if (error) throw error;
      } else {
        // Cadastro: define patrimônio inicial; disponível inicia igual ao total
        // (tudo limpo na rouparia) salvo se informado.
        const total = Math.max(0, input.quantidadeTotal ?? 0);
        const disp = Math.max(0, Math.min(total, input.quantidadeDisponivel ?? total));
        const { error } = await supabase.from("enxoval").insert({
          categoria: input.categoria,
          descricao: input.descricao,
          quantidade_total: total,
          quantidade_disponivel: disp,
          estoque_minimo: input.estoqueMinimo,
          observacao: input.observacao ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ENXOVAL_KEY }),
  });
}

/** Remove um item de enxoval (cadastro errado). Os movimentos caem em cascata. */
export function useRemoverEnxovalItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("enxoval").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENXOVAL_KEY });
      qc.invalidateQueries({ queryKey: MOV_KEY });
    },
  });
}

export interface MovimentoInput {
  enxovalId: string;
  tipo: EnxovalMovimentoTipo;
  /**
   * entrada/baixa_perda: peças movimentadas (positivo).
   * ajuste: NOVA contagem de disponível limpo (absoluto).
   */
  valor: number;
  motivo?: string | null;
}

/** Registra um movimento e ajusta as quantidades do item. */
export function useMovimentoEnxoval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: MovimentoInput) => {
      const { data: atual, error: errGet } = await supabase
        .from("enxoval")
        .select("quantidade_total, quantidade_disponivel")
        .eq("id", input.enxovalId)
        .single();
      if (errGet) throw errGet;

      const total0 = atual.quantidade_total as number;
      const disp0 = atual.quantidade_disponivel as number;
      let total = total0;
      let disp = disp0;
      let quantidadeMov = Math.max(0, Math.floor(input.valor));

      if (input.tipo === "entrada") {
        total = total0 + quantidadeMov;
        disp = disp0 + quantidadeMov;
      } else if (input.tipo === "baixa_perda") {
        // Peça saiu do patrimônio (danificada/extraviada): reduz total e disponível.
        total = Math.max(0, total0 - quantidadeMov);
        disp = Math.max(0, disp0 - quantidadeMov);
      } else {
        // ajuste: corrige a contagem de limpas (acerto de inventário). `valor` é a
        // NOVA contagem de disponível; o movimento registra o delta (pode ser <0).
        const novoDisp = Math.max(0, Math.min(total0, Math.floor(input.valor)));
        disp = novoDisp;
        quantidadeMov = novoDisp - disp0;
      }

      const { error: errUpd } = await supabase
        .from("enxoval")
        .update({
          quantidade_total: total,
          quantidade_disponivel: disp,
          atualizado_em: new Date().toISOString(),
        })
        .eq("id", input.enxovalId);
      if (errUpd) throw errUpd;

      const { error: errMov } = await supabase.from("enxoval_movimento").insert({
        enxoval_id: input.enxovalId,
        tipo: input.tipo,
        quantidade: quantidadeMov,
        motivo: input.motivo ?? null,
        registrado_por: usuarioAtual.nome,
      });
      if (errMov) throw errMov;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ENXOVAL_KEY });
      qc.invalidateQueries({ queryKey: MOV_KEY });
    },
  });
}
