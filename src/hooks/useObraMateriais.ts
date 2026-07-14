import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadArquivoObra } from "@/lib/storage";
import { arred } from "@/lib/obraCalc";
import type {
  Database,
  ObraCotacao,
  ObraConsumo,
  ObraEstoqueReposicao,
  ObraOcStatus,
  ObraOrdemCompra,
  ObraPlanejamentoMaterial,
  ObraRecebimento,
  ObraTolerancia,
} from "@/types/database";

// ===========================================================================
// Módulo Obra — Fase 4: materiais. Planejamento → cotações → OC → recebimento
// → consumo → perdas/glosa → estoque de reposição. Compra direta do
// Contratante: cotações/OCs/recebimentos/consumo são master/direção (RLS).
// ===========================================================================

export function useTolerancias() {
  return useQuery({
    queryKey: ["obra-tolerancias"],
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("obra_tolerancias_perdas").select("*");
      if (error) throw error;
      return Object.fromEntries((data as ObraTolerancia[] | null ?? []).map((t) => [t.categoria, t.percentual]));
    },
  });
}

export function usePlanejamento() {
  return useQuery({
    queryKey: ["obra-planejamento"],
    queryFn: async (): Promise<ObraPlanejamentoMaterial[]> => {
      const { data, error } = await supabase.from("obra_planejamento_materiais").select("*").order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCotacoes() {
  return useQuery({
    queryKey: ["obra-cotacoes"],
    queryFn: async (): Promise<ObraCotacao[]> => {
      const { data, error } = await supabase.from("obra_cotacoes").select("*").order("preco_unitario");
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useOrdensCompra() {
  return useQuery({
    queryKey: ["obra-ordens"],
    queryFn: async (): Promise<ObraOrdemCompra[]> => {
      const { data, error } = await supabase.from("obra_ordens_compra").select("*").order("criado_em", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useRecebimentos() {
  return useQuery({
    queryKey: ["obra-recebimentos-mat"],
    queryFn: async (): Promise<ObraRecebimento[]> => {
      const { data, error } = await supabase.from("obra_recebimentos").select("*").order("recebido_em", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useConsumo() {
  return useQuery({
    queryKey: ["obra-consumo"],
    queryFn: async (): Promise<ObraConsumo[]> => {
      const { data, error } = await supabase.from("obra_consumo").select("*").order("data_consumo", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useReposicao() {
  return useQuery({
    queryKey: ["obra-reposicao"],
    queryFn: async (): Promise<ObraEstoqueReposicao[]> => {
      const { data, error } = await supabase.from("obra_estoque_reposicao").select("*").order("criado_em", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

function inval(qc: ReturnType<typeof useQueryClient>, ...keys: string[]) {
  for (const k of keys) qc.invalidateQueries({ queryKey: [k] });
}

// ── Planejamento ────────────────────────────────────────────────────────────
export function useCriarPlanejamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: Database["public"]["Tables"]["obra_planejamento_materiais"]["Insert"]) => {
      const { error } = await supabase.from("obra_planejamento_materiais").insert({ ...args, registrado_por: usuarioAtual.nome });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-planejamento"),
  });
}

// ── Cotações ────────────────────────────────────────────────────────────────
export function useCriarCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { planejamentoId: string; fornecedor: string; precoUnitario: number; prazoDias?: number | null }) => {
      const { error } = await supabase.from("obra_cotacoes").insert({
        planejamento_id: args.planejamentoId,
        fornecedor: args.fornecedor.trim(),
        preco_unitario: args.precoUnitario,
        prazo_entrega_dias: args.prazoDias ?? null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-cotacoes"),
  });
}

/** Escolhe uma cotação (marca as demais do item como não escolhidas). */
export function useEscolherCotacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { cotacaoId: string; planejamentoId: string }) => {
      const { error: e1 } = await supabase.from("obra_cotacoes").update({ escolhida: false }).eq("planejamento_id", args.planejamentoId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("obra_cotacoes").update({ escolhida: true }).eq("id", args.cotacaoId);
      if (e2) throw e2;
    },
    onSuccess: () => inval(qc, "obra-cotacoes"),
  });
}

// ── Ordens de compra ────────────────────────────────────────────────────────
export function useCriarOC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      planejamento: ObraPlanejamentoMaterial;
      cotacaoId?: string | null;
      fornecedor: string;
      quantidade: number;
      precoUnitario: number;
      previsaoEntrega?: string | null;
    }) => {
      const valorTotal = arred(args.quantidade * args.precoUnitario);
      const { error } = await supabase.from("obra_ordens_compra").insert({
        planejamento_id: args.planejamento.id,
        cotacao_id: args.cotacaoId ?? null,
        fase_id: args.planejamento.fase_id,
        fornecedor: args.fornecedor.trim(),
        categoria: args.planejamento.categoria,
        item: args.planejamento.item,
        unidade: args.planejamento.unidade,
        quantidade: args.quantidade,
        preco_unitario: args.precoUnitario,
        valor_total: valorTotal,
        previsao_entrega: args.previsaoEntrega ?? null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-ordens"),
  });
}

export function useAtualizarOC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; status?: ObraOcStatus; previsaoEntrega?: string | null }) => {
      const patch: Database["public"]["Tables"]["obra_ordens_compra"]["Update"] = {};
      if (args.status) patch.status = args.status;
      if (args.previsaoEntrega !== undefined) patch.previsao_entrega = args.previsaoEntrega;
      const { error } = await supabase.from("obra_ordens_compra").update(patch).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-ordens"),
  });
}

// ── Recebimento (conferência + foto; divergência → NC) ──────────────────────
export function useRegistrarRecebimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { oc: ObraOrdemCompra; quantidadeRecebida: number; foto?: File | null; observacao?: string; geraNc?: boolean }) => {
      const divergencia = arred(args.quantidadeRecebida) !== arred(args.oc.quantidade);
      let fotoUrl: string | null = null;
      if (args.foto) {
        fotoUrl = await uploadArquivoObra(args.foto, `recebimentos/${args.oc.id}`);
        if (!fotoUrl) throw new Error("Falha no upload da foto de conferência.");
      }
      const { error } = await supabase.from("obra_recebimentos").insert({
        ordem_compra_id: args.oc.id,
        quantidade_recebida: args.quantidadeRecebida,
        foto_url: fotoUrl,
        divergencia,
        gera_nc: divergencia && (args.geraNc ?? true),
        observacao: args.observacao?.trim() || null,
        conferido_por: usuarioAtual.nome,
      });
      if (error) throw error;
      // Atualiza o status da OC conforme o total recebido.
      const status: ObraOcStatus = args.quantidadeRecebida >= args.oc.quantidade ? "Entregue" : "Entregue parcial";
      await supabase.from("obra_ordens_compra").update({ status }).eq("id", args.oc.id);
    },
    onSuccess: () => inval(qc, "obra-recebimentos-mat", "obra-ordens"),
  });
}

// ── Consumo ─────────────────────────────────────────────────────────────────
export function useRegistrarConsumo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: Database["public"]["Tables"]["obra_consumo"]["Insert"]) => {
      const { error } = await supabase.from("obra_consumo").insert({ ...args, registrado_por: usuarioAtual.nome });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-consumo"),
  });
}

// ── Estoque de reposição ────────────────────────────────────────────────────
export function useCriarReposicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: Database["public"]["Tables"]["obra_estoque_reposicao"]["Insert"]) => {
      const { error } = await supabase.from("obra_estoque_reposicao").insert({ ...args, registrado_por: usuarioAtual.nome });
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-reposicao"),
  });
}

export function useEntregarReposicao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; hoje: string }) => {
      const { error } = await supabase.from("obra_estoque_reposicao").update({ entregue: true, entregue_em: args.hoje }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => inval(qc, "obra-reposicao"),
  });
}
