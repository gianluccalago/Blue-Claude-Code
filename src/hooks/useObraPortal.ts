import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadArquivoObra } from "@/lib/storage";
import type { ObraNotificacao } from "@/types/database";

// ===========================================================================
// Módulo Obra — Fase 6: portal do prestador (construtora). Escrita restrita:
// submeter BM (RPC), entregas de projeto (RPC), documentos mensais e feed de
// notificações. O cálculo do BM é feito no servidor (RPC SECURITY DEFINER).
// ===========================================================================

/** Submete o BM do mês com as etapas concluídas reivindicadas. */
export function useSubmeterBM() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { faseId: string; mes: string; etapaIds: string[] }): Promise<string> => {
      const { data, error } = await supabase.rpc("obra_submeter_bm", {
        p_fase_id: args.faseId,
        p_mes: args.mes,
        p_etapa_ids: args.etapaIds,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["obra-medicoes"] });
      qc.invalidateQueries({ queryKey: ["obra-etapas-medidas"] });
    },
  });
}

/** Sobe a entrega de um marco de projeto (upload + RPC → Em análise). */
export function useSubmeterEntrega() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { marcoId: string; arquivo: File }) => {
      const path = await uploadArquivoObra(args.arquivo, `entregas/${args.marcoId}`);
      if (!path) throw new Error("Falha no upload da entrega. Tente novamente.");
      const { error } = await supabase.rpc("obra_submeter_entrega", { p_marco_id: args.marcoId, p_arquivo_url: path });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-marcos"] }),
  });
}

/** Feed de notificações do prestador (BM reprovado etc.). */
export function useNotificacoesObra() {
  return useQuery({
    queryKey: ["obra-notificacoes"],
    queryFn: async (): Promise<ObraNotificacao[]> => {
      const { data, error } = await supabase
        .from("obra_notificacoes")
        .select("*")
        .order("criado_em", { ascending: false })
        .limit(30);
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useMarcarNotificacaoLida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_notificacoes").update({ lida: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["obra-notificacoes"] }),
  });
}
