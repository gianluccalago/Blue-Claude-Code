import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAutenticado } from "@/auth/usuarioAtual";
import type { SolicitacaoAcesso, SolicitacaoResetSenha } from "@/types/database";

// ===========================================================================
// Solicitações públicas (login) + gestão no Acesso Master.
//  - "Esqueci minha senha": o visitante pede reset (RPC solicitar_reset_senha);
//    o Master zera para "blue" (admin_definir_senha) e marca atendido.
//  - "Solicitar acesso": visitante (familiar/colaborador) pede cadastro (RPC
//    solicitar_acesso); o Master aprova (cria o usuário) ou recusa.
// As RPCs são SECURITY DEFINER (anon-callable); as filas só o Master lê (RLS).
// ===========================================================================

const KEY_RESET = ["solicitacoes-reset"];
const KEY_ACESSO = ["solicitacoes-acesso"];

// ─── Público (tela de login, sem autenticação) ──────────────────────────────

/** Registra um pedido de reset de senha (fila do Master). */
export function useSolicitarResetSenha() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.rpc("solicitar_reset_senha", { p_email: email });
      if (error) throw error;
    },
  });
}

export interface SolicitacaoAcessoInput {
  tipo: "familiar" | "colaborador";
  nome: string;
  email: string;
  contato: string;
  cargo: string;
  residenteNome: string;
  parentesco: string;
  observacao: string;
}

/** Registra um pedido de acesso (familiar/colaborador) para aprovação do Master. */
export function useSolicitarAcesso() {
  return useMutation({
    mutationFn: async (v: SolicitacaoAcessoInput) => {
      const { error } = await supabase.rpc("solicitar_acesso", {
        p_tipo: v.tipo,
        p_nome: v.nome,
        p_email: v.email,
        p_contato: v.contato || null,
        p_cargo: v.cargo || null,
        p_residente_nome: v.residenteNome || null,
        p_parentesco: v.parentesco || null,
        p_observacao: v.observacao || null,
      });
      if (error) throw error;
    },
  });
}

// ─── Master (leitura + gestão das filas) ────────────────────────────────────

/** Solicitações de reset (mais recentes primeiro). */
export function useSolicitacoesReset() {
  return useQuery({
    queryKey: KEY_RESET,
    queryFn: async (): Promise<SolicitacaoResetSenha[]> => {
      const { data, error } = await supabase
        .from("solicitacao_reset_senha")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Solicitações de acesso (mais recentes primeiro). */
export function useSolicitacoesAcesso() {
  return useQuery({
    queryKey: KEY_ACESSO,
    queryFn: async (): Promise<SolicitacaoAcesso[]> => {
      const { data, error } = await supabase
        .from("solicitacao_acesso")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Marca uma solicitação de reset como atendida (após zerar a senha). */
export function useAtenderReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("solicitacao_reset_senha")
        .update({ status: "atendido", atendido_por: usuarioAutenticado.nome, atendido_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_RESET }),
  });
}

/** Descarta uma solicitação de reset (spam / e-mail desconhecido). */
export function useDescartarReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("solicitacao_reset_senha")
        .update({ status: "descartado", atendido_por: usuarioAutenticado.nome, atendido_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_RESET }),
  });
}

/** Marca uma solicitação de acesso como aprovada (após criar o usuário). */
export function useAprovarAcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("solicitacao_acesso")
        .update({ status: "aprovada", revisado_por: usuarioAutenticado.nome, revisado_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_ACESSO }),
  });
}

/** Recusa uma solicitação de acesso (com motivo opcional). */
export function useRecusarAcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; motivo: string | null }) => {
      const { error } = await supabase
        .from("solicitacao_acesso")
        .update({ status: "recusada", motivo_recusa: args.motivo, revisado_por: usuarioAutenticado.nome, revisado_em: new Date().toISOString() })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY_ACESSO }),
  });
}
