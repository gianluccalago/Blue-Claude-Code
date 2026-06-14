import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type {
  Cardapio,
  CardapioItem,
  RefeicaoCardapio,
  TipoRestricaoCardapio,
} from "@/types/database";

// ===========================================================================
// Cardápios (N3): montagem por dia + restrição (composto por pratos do N2).
// ===========================================================================

export interface CardapioComItens {
  cardapio: Cardapio | null;
  itens: CardapioItem[];
}

/** Cardápio de um dia + restrição, com seus itens. */
export function useCardapioDoDia(data: string, restricao: TipoRestricaoCardapio) {
  return useQuery({
    queryKey: ["cardapio", data, restricao],
    queryFn: async (): Promise<CardapioComItens> => {
      const { data: card, error } = await supabase
        .from("cardapio")
        .select("*")
        .eq("data", data)
        .eq("tipo_restricao", restricao)
        .maybeSingle();
      if (error) throw error;
      if (!card) return { cardapio: null, itens: [] };

      const { data: itens, error: errI } = await supabase
        .from("cardapio_item")
        .select("*")
        .eq("cardapio_id", card.id);
      if (errI) throw errI;
      return { cardapio: card, itens: itens ?? [] };
    },
  });
}

/** Cardápios de uma SEMANA (intervalo de datas) de uma restrição, com itens. */
export function useCardapiosSemana(
  inicio: string,
  fim: string,
  restricao: TipoRestricaoCardapio,
) {
  return useQuery({
    queryKey: ["cardapios-semana", inicio, fim, restricao],
    queryFn: async (): Promise<{ cardapios: Cardapio[]; itens: CardapioItem[] }> => {
      const { data: cardapios, error } = await supabase
        .from("cardapio")
        .select("*")
        .eq("tipo_restricao", restricao)
        .gte("data", inicio)
        .lte("data", fim);
      if (error) throw error;
      const ids = (cardapios ?? []).map((c) => c.id);
      if (ids.length === 0) return { cardapios: cardapios ?? [], itens: [] };
      const { data: itens, error: errI } = await supabase
        .from("cardapio_item")
        .select("*")
        .in("cardapio_id", ids);
      if (errI) throw errI;
      return { cardapios: cardapios ?? [], itens: itens ?? [] };
    },
  });
}

/** Garante o cardápio do dia+restrição (cria se não existe) e retorna o id. */
async function garantirCardapio(data: string, restricao: TipoRestricaoCardapio): Promise<string> {
  const { data: card } = await supabase
    .from("cardapio")
    .select("id")
    .eq("data", data)
    .eq("tipo_restricao", restricao)
    .maybeSingle();
  if (card?.id) return card.id;
  const id = crypto.randomUUID();
  const { error } = await supabase.from("cardapio").insert({
    id,
    data,
    tipo_restricao: restricao,
    criado_por: usuarioAtual.nome,
  });
  if (error) throw error;
  return id;
}

/** Adiciona um prato a uma refeição do cardápio do dia+restrição. */
export function useAdicionarPratoCardapio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      data: string;
      restricao: TipoRestricaoCardapio;
      refeicao: RefeicaoCardapio;
      pratoId: string;
    }) => {
      const cardapioId = await garantirCardapio(args.data, args.restricao);
      const { error } = await supabase.from("cardapio_item").insert({
        cardapio_id: cardapioId,
        refeicao: args.refeicao,
        prato_id: args.pratoId,
      });
      if (error) throw error;
    },
    onSuccess: (_r, args) =>
      qc.invalidateQueries({ queryKey: ["cardapio", args.data, args.restricao] }),
  });
}

/** Remove um item do cardápio. */
export function useRemoverItemCardapio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; data: string; restricao: TipoRestricaoCardapio }) => {
      const { error } = await supabase.from("cardapio_item").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_r, args) =>
      qc.invalidateQueries({ queryKey: ["cardapio", args.data, args.restricao] }),
  });
}

/**
 * Copia o cardápio de (origemData, origemRestricao) para (destinoData,
 * destinoRestricao), SUBSTITUINDO os itens do destino. Agiliza a montagem
 * recorrente (copiar "Livre" e ajustar p/ "Diabético", ou o dia anterior).
 */
export function useCopiarCardapio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      origemData: string;
      origemRestricao: TipoRestricaoCardapio;
      destinoData: string;
      destinoRestricao: TipoRestricaoCardapio;
    }) => {
      const { data: origem } = await supabase
        .from("cardapio")
        .select("id")
        .eq("data", args.origemData)
        .eq("tipo_restricao", args.origemRestricao)
        .maybeSingle();
      if (!origem?.id) throw new Error("Não há cardápio de origem para copiar.");

      const { data: itensOrigem } = await supabase
        .from("cardapio_item")
        .select("refeicao, prato_id")
        .eq("cardapio_id", origem.id);

      const destinoId = await garantirCardapio(args.destinoData, args.destinoRestricao);
      // Substitui: limpa o destino e insere as cópias.
      const { error: errDel } = await supabase.from("cardapio_item").delete().eq("cardapio_id", destinoId);
      if (errDel) throw errDel;
      const linhas = (itensOrigem ?? []).map((i) => ({
        cardapio_id: destinoId,
        refeicao: i.refeicao,
        prato_id: i.prato_id,
      }));
      if (linhas.length > 0) {
        const { error } = await supabase.from("cardapio_item").insert(linhas);
        if (error) throw error;
      }
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["cardapio", args.destinoData, args.destinoRestricao] });
      qc.invalidateQueries({ queryKey: ["cardapios-semana"] });
    },
  });
}
