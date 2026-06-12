import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { FAMILIA_ATUAL } from "@/data/profiles";
import type { DestinoSolicitacao, SolicitacaoFamilia } from "@/types/database";

// FAMILIA_ATUAL é MUTÁVEL (sincronizada pelo login/Camaleão): a chave precisa
// ser calculada a cada render — congelada no escopo do módulo, ela capturaria
// o residenteId vazio da carga inicial e o cache nunca acompanharia o usuário.
const keyFamilia = () => ["solicitacoes-familia", FAMILIA_ATUAL.residenteId];
const KEY_DESTINO = ["solicitacoes-destino"];

export const DESTINOS_SOLICITACAO: { value: DestinoSolicitacao; label: string }[] = [
  { value: "coordenacao", label: "Coordenação Assistencial" },
  { value: "medico", label: "Médico" },
  { value: "administracao", label: "Administração" },
];

export function labelDestino(destino: string): string {
  return DESTINOS_SOLICITACAO.find((d) => d.value === destino)?.label ?? destino;
}

/** Solicitações abertas pela família atual, mais recente primeiro. */
export function useSolicitacoesFamilia() {
  return useQuery({
    queryKey: keyFamilia(),
    // Família sem residente vinculado não consulta (evita eq com uuid vazio).
    enabled: !!FAMILIA_ATUAL.residenteId,
    queryFn: async (): Promise<SolicitacaoFamilia[]> => {
      const { data, error } = await supabase
        .from("solicitacao_familia")
        .select("*")
        .eq("residente_id", FAMILIA_ATUAL.residenteId)
        .order("criada_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export type CriarSolicitacaoInput = {
  destino: DestinoSolicitacao;
  assunto: string;
  mensagem: string;
};

/** A família abre uma nova solicitação para Coordenação, Médico ou Administração. */
export function useCriarSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CriarSolicitacaoInput) => {
      const { error } = await supabase.from("solicitacao_familia").insert({
        residente_id: FAMILIA_ATUAL.residenteId,
        destino: args.destino,
        assunto: args.assunto,
        mensagem: args.mensagem,
        enviada_por: FAMILIA_ATUAL.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keyFamilia() });
      qc.invalidateQueries({ queryKey: KEY_DESTINO });
    },
  });
}

export type SolicitacaoComResidente = SolicitacaoFamilia & { residente_nome?: string };

/** Solicitações direcionadas a um setor (Coordenação/Médico/Administração), com o nome do hóspede. */
export function useSolicitacoesPorDestino(destino: DestinoSolicitacao | undefined) {
  return useQuery({
    queryKey: [...KEY_DESTINO, destino],
    enabled: !!destino,
    queryFn: async (): Promise<SolicitacaoComResidente[]> => {
      const { data, error } = await supabase
        .from("solicitacao_familia")
        .select("*, residente:residente_id(nome)")
        .eq("destino", destino!)
        .order("criada_em", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        ...(row as SolicitacaoFamilia),
        residente_nome: (row.residente as { nome?: string } | null)?.nome,
      }));
    },
  });
}

export type ResponderSolicitacaoInput = {
  id: string;
  resposta: string;
  respondidoPor: string;
};

/**
 * Espelho ao cuidador (5.4): solicitações RESPONDIDAS dos hóspedes designados
 * — quem está com a pessoa sabe o que foi combinado com a família (leitura).
 */
export function useSolicitacoesRespondidasDosHospedes(residenteIds: string[]) {
  return useQuery({
    queryKey: ["solicitacoes-respondidas-hospedes", [...residenteIds].sort().join(",")],
    enabled: residenteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("solicitacao_familia")
        .select("*")
        .in("residente_id", residenteIds)
        .eq("status", "respondida")
        .order("respondida_em", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Marca solicitações abertas como "EM ANÁLISE" quando o setor de destino abre
 * a caixa (5.3): a família passa a ver "Em análise por [setor]" em vez de só
 * "aberta" — prontidão percebida sem nenhum clique extra da equipe.
 */
export function useMarcarEmAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { ids: string[]; setor: string }) => {
      if (args.ids.length === 0) return;
      const { error } = await supabase
        .from("solicitacao_familia")
        .update({ em_analise_em: new Date().toISOString(), em_analise_por: args.setor })
        .in("id", args.ids)
        .is("em_analise_em", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_DESTINO });
      qc.invalidateQueries({ queryKey: keyFamilia() });
    },
  });
}

/** O destinatário responde a solicitação (status -> respondida). */
export function useResponderSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: ResponderSolicitacaoInput) => {
      const { error } = await supabase
        .from("solicitacao_familia")
        .update({
          resposta: args.resposta,
          respondida_por: args.respondidoPor,
          respondida_em: new Date().toISOString(),
          status: "respondida",
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_DESTINO });
      qc.invalidateQueries({ queryKey: keyFamilia() });
    },
  });
}

export type RedirecionarSolicitacaoInput = {
  id: string;
  destinoAtual: DestinoSolicitacao;
  novoDestino: DestinoSolicitacao;
};

/** Reencaminha a solicitação para outro setor (registra de onde veio em "redirecionada_de"). */
export function useRedirecionarSolicitacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RedirecionarSolicitacaoInput) => {
      const { error } = await supabase
        .from("solicitacao_familia")
        .update({
          destino: args.novoDestino,
          redirecionada_de: args.destinoAtual,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY_DESTINO });
      qc.invalidateQueries({ queryKey: keyFamilia() });
    },
  });
}
