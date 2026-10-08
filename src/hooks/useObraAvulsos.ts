import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadArquivoObra } from "@/lib/storage";
import { KEY_FC } from "@/hooks/useFluxoCaixa";
import type {
  FonteItemAvulso,
  OrcamentoAvulso,
  OrcamentoAvulsoAnexo,
  OrcamentoAvulsoEvento,
  OrcamentoAvulsoItem,
} from "@/types/database";

// ===========================================================================
// Orçamentos avulsos da obra (0151). Toda mudança de estado passa por função
// no servidor; anexos vão para a pasta orcamentos/ do bucket privado da obra.
// ===========================================================================

const KEY = ["obra-avulsos"] as const;

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: ["obra-notificacoes"] });
  qc.invalidateQueries({ queryKey: KEY_FC });
}

export interface OrcamentoAvulsoCompleto extends OrcamentoAvulso {
  itens: OrcamentoAvulsoItem[];
  anexos: OrcamentoAvulsoAnexo[];
  eventos: OrcamentoAvulsoEvento[];
}

export function useOrcamentosAvulsos() {
  return useQuery({
    queryKey: [...KEY, "lista"],
    queryFn: async (): Promise<OrcamentoAvulsoCompleto[]> => {
      const [o, i, a, e] = await Promise.all([
        supabase.from("obra_orcamentos_avulsos").select("*").order("numero", { ascending: false }),
        supabase.from("obra_orcamento_avulso_itens").select("*").order("ordem"),
        supabase.from("obra_orcamento_avulso_anexos").select("*").order("criado_em"),
        supabase.from("obra_orcamento_avulso_eventos").select("*").order("em"),
      ]);
      for (const r of [o, i, a, e]) if (r.error) throw r.error;
      const por = <T extends { orcamento_id: string }>(l: T[]) => {
        const m = new Map<string, T[]>();
        for (const x of l) m.set(x.orcamento_id, [...(m.get(x.orcamento_id) ?? []), x]);
        return m;
      };
      const itens = por((i.data ?? []) as OrcamentoAvulsoItem[]);
      const anexos = por((a.data ?? []) as OrcamentoAvulsoAnexo[]);
      const eventos = por((e.data ?? []) as OrcamentoAvulsoEvento[]);
      return ((o.data ?? []) as OrcamentoAvulso[]).map((x) => ({
        ...x,
        itens: itens.get(x.id) ?? [],
        anexos: anexos.get(x.id) ?? [],
        eventos: eventos.get(x.id) ?? [],
      }));
    },
  });
}

export interface ItemRascunho {
  fonte: FonteItemAvulso;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade_prevista: number;
  preco_unitario: number;
}

export interface RascunhoAvulso {
  id: string | null;
  titulo: string;
  descricao: string;
  justificativa: string;
  fase_id: string | null;
  referencia_precos: string;
  itens: ItemRascunho[];
}

function rpc<A>(fn: (a: A) => PromiseLike<{ error: unknown }>) {
  return function useRpc() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (a: A) => {
        const { error } = await fn(a);
        if (error) throw error;
      },
      onSuccess: () => invalidar(qc),
    });
  };
}

/** Salva (cria ou edita) e, se pedido, envia para aprovação. Devolve o id. */
export function useSalvarAvulso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { rascunho: RascunhoAvulso; enviar: boolean; comentario?: string }): Promise<string> => {
      const { data, error } = await supabase.rpc("obra_avulso_salvar", { p: { ...v.rascunho } });
      if (error) throw error;
      const id = (Array.isArray(data) ? data[0] : data) as string;
      if (v.enviar) {
        const r = await supabase.rpc("obra_avulso_enviar", { p_id: id, p_comentario: v.comentario ?? null });
        if (r.error) throw r.error;
      }
      return id;
    },
    onSuccess: () => invalidar(qc),
  });
}

export const useEnviarAvulso = rpc((a: { id: string; comentario?: string }) =>
  supabase.rpc("obra_avulso_enviar", { p_id: a.id, p_comentario: a.comentario ?? null }));
export const useDecidirAvulso = rpc((a: { id: string; decisao: "aprovado" | "ajustes" | "reprovado"; comentario: string }) =>
  supabase.rpc("obra_avulso_decidir", { p_id: a.id, p_decisao: a.decisao, p_comentario: a.comentario || null }));
export const useInformarExecucao = rpc((a: { id: string; itens: { id: string; quantidade_real: number }[]; comentario: string }) =>
  supabase.rpc("obra_avulso_informar_execucao", { p_id: a.id, p_itens: a.itens, p_comentario: a.comentario || null }));
export const useConferirAvulso = rpc((a: { id: string; valorReal: number | null; comentario: string }) =>
  supabase.rpc("obra_avulso_conferir", { p_id: a.id, p_valor_real: a.valorReal, p_comentario: a.comentario || null }));
export const useDesfazerPagamentoAvulso = rpc((a: { id: string; comentario: string }) =>
  supabase.rpc("obra_avulso_desfazer_pagamento", { p_id: a.id, p_comentario: a.comentario }));
export const useCancelarAvulso = rpc((a: { id: string; comentario: string }) =>
  supabase.rpc("obra_avulso_cancelar", { p_id: a.id, p_comentario: a.comentario }));
export const useComentarAvulso = rpc((a: { id: string; comentario: string }) =>
  supabase.rpc("obra_avulso_comentar", { p_id: a.id, p_comentario: a.comentario }));

export function usePagarAvulso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { id: string; data: string; nfNumero: string; nf: File | null; comprovante: File | null }) => {
      const nfUrl = a.nf ? await uploadArquivoObra(a.nf, `orcamentos/${a.id}/nf`) : null;
      const compUrl = a.comprovante ? await uploadArquivoObra(a.comprovante, `nf/comprovantes/avulsos/${a.id}`) : null;
      const { data, error } = await supabase.rpc("obra_avulso_pagar", {
        p_id: a.id, p_data: a.data, p_nf_numero: a.nfNumero || null, p_nf_url: nfUrl, p_comprovante_url: compUrl,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as { no_caixa: boolean; pela_planilha: boolean };
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Envia fotos/PDFs e registra os anexos do orçamento. */
export function useAnexarAvulso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { id: string; arquivos: File[] }) => {
      for (const f of a.arquivos) {
        const url = await uploadArquivoObra(f, `orcamentos/${a.id}`);
        if (!url) continue;
        const { error } = await supabase.from("obra_orcamento_avulso_anexos").insert({
          orcamento_id: a.id, arquivo_url: url, nome: f.name, tipo: f.type.startsWith("image/") ? "imagem" : "documento",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => invalidar(qc),
  });
}

export const useRemoverAnexoAvulso = rpc((id: string) => supabase.from("obra_orcamento_avulso_anexos").delete().eq("id", id));
