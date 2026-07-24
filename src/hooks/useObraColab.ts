import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadArquivoObra } from "@/lib/storage";
import type { ObraFotoAndamento, ObraSolicitacaoObra } from "@/types/database";

// ===========================================================================
// Módulo Obra — canais COLABORATIVOS com a construtora:
//  · Fotos de andamento do canteiro (TRÍADE anexa; os dois lados veem);
//  · Solicitações gerais (medição antecipada, acordos, pedidos avulsos).
// ===========================================================================

const KEY_FOTOS = ["obra-fotos-andamento"];
const KEY_SOLIC = ["obra-solicitacoes"];

// ── Fotos de andamento ──────────────────────────────────────────────────────

export function useFotosAndamento() {
  return useQuery({
    queryKey: KEY_FOTOS,
    queryFn: async (): Promise<ObraFotoAndamento[]> => {
      const { data, error } = await supabase
        .from("obra_fotos_andamento")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

/** Sobe VÁRIAS fotos do canteiro (pasta andamento/ — prestador tem acesso). */
export function useEnviarFotosAndamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { fotos: File[]; faseId?: string | null; descricao?: string }) => {
      if (args.fotos.length === 0) throw new Error("Selecione ao menos uma foto.");
      for (const f of args.fotos) {
        const path = await uploadArquivoObra(f, `andamento/${args.faseId ?? "geral"}`);
        if (!path) throw new Error(`Falha no upload de "${f.name}". Tente novamente.`);
        const { error } = await supabase.from("obra_fotos_andamento").insert({
          fase_id: args.faseId ?? null,
          descricao: args.descricao?.trim() || null,
          foto_url: path,
          registrado_por: usuarioAtual.nome,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_FOTOS }),
  });
}

/** Exclui uma foto de andamento (master/direção — correção de engano). */
export function useExcluirFotoAndamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_fotos_andamento").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_FOTOS }),
  });
}

// ── Solicitações gerais ─────────────────────────────────────────────────────

export function useSolicitacoesObra() {
  return useQuery({
    queryKey: KEY_SOLIC,
    queryFn: async (): Promise<ObraSolicitacaoObra[]> => {
      const { data, error } = await supabase
        .from("obra_solicitacoes")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useCriarSolicitacaoObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tipo: ObraSolicitacaoObra["tipo"];
      titulo: string;
      descricao?: string;
      dataDesejada?: string | null;
    }) => {
      if (!args.titulo.trim()) throw new Error("Informe o título da solicitação.");
      const { error } = await supabase.from("obra_solicitacoes").insert({
        tipo: args.tipo,
        titulo: args.titulo.trim(),
        descricao: args.descricao?.trim() || null,
        data_desejada: args.dataDesejada ?? null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_SOLIC }),
  });
}

/** Responde/atualiza uma solicitação (master/direção). */
export function useResponderSolicitacaoObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      status: ObraSolicitacaoObra["status"];
      resposta?: string | null;
    }) => {
      const { error } = await supabase
        .from("obra_solicitacoes")
        .update({
          status: args.status,
          resposta: args.resposta?.trim() || null,
          respondido_por: usuarioAtual.nome,
          respondido_em: new Date().toISOString(),
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_SOLIC }),
  });
}
