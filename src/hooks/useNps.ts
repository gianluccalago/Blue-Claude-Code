import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { DimensaoNps } from "@/lib/nps";
import type { NpsPesquisa, NpsResposta, RespondenteNps } from "@/types/database";

// ===========================================================================
// NPS — aplicação (equipe) e análise (Master/Administração).
//
// A APLICAÇÃO insere a pesquisa + as respostas; o id da pesquisa é gerado no
// cliente para NÃO depender de RETURNING — assim a RLS pode negar SELECT aos
// aplicadores sem quebrar a gravação. A ANÁLISE lê pesquisas + respostas (a RLS
// só libera SELECT para Master/Administração).
// ===========================================================================

export type RespostaNpsInput = {
  dimensao: DimensaoNps;
  nota: number;
  comentario?: string | null;
};

export type SalvarPesquisaNpsInput = {
  residenteId: string;
  respondente: RespondenteNps;
  observacaoGeral?: string | null;
  respostas: RespostaNpsInput[];
};

/** Grava a pesquisa + as respostas (8 dimensões). Registra quem aplicou/quando. */
export function useSalvarPesquisaNps() {
  return useMutation({
    mutationFn: async (args: SalvarPesquisaNpsInput) => {
      const pesquisaId = crypto.randomUUID();
      const { error: errP } = await supabase.from("nps_pesquisa").insert({
        id: pesquisaId,
        residente_id: args.residenteId,
        respondente: args.respondente,
        aplicada_por: usuarioAtual.nome,
        perfil_aplicador: usuarioAtual.perfil,
        observacao_geral: args.observacaoGeral?.trim() || null,
      });
      if (errP) throw errP;

      const linhas = args.respostas.map((r) => ({
        pesquisa_id: pesquisaId,
        dimensao: r.dimensao,
        nota: r.nota,
        comentario: r.comentario?.trim() || null,
      }));
      const { error: errR } = await supabase.from("nps_resposta").insert(linhas);
      if (errR) throw errR;
      return pesquisaId;
    },
  });
}

/** Todas as pesquisas (análise — RLS libera só Master/Administração). */
export function useNpsPesquisas() {
  return useQuery({
    queryKey: ["nps-pesquisas"],
    queryFn: async (): Promise<NpsPesquisa[]> => {
      const { data, error } = await supabase
        .from("nps_pesquisa")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Todas as respostas (análise). */
export function useNpsRespostas() {
  return useQuery({
    queryKey: ["nps-respostas"],
    queryFn: async (): Promise<NpsResposta[]> => {
      const { data, error } = await supabase.from("nps_resposta").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });
}
