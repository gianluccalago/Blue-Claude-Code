import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type {
  ChamadoManutencao,
  PerfilSolicitanteChamado,
  StatusChamado,
  UrgenciaChamado,
} from "@/types/database";

const CHAMADOS_KEY = ["chamados-manutencao"];

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Todos os chamados de manutenção, mais recentes primeiro. */
export function useChamadosManutencao() {
  return useQuery({
    queryKey: CHAMADOS_KEY,
    queryFn: async (): Promise<ChamadoManutencao[]> => {
      const { data, error } = await supabase
        .from("chamado_manutencao")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Mutações ─────────────────────────────────────────────────────────────────

export type CriarChamadoInput = {
  local: string;
  residenteId: string | null;
  problema: string;
  urgencia: UrgenciaChamado;
  abertoPor: string;
  perfilSolicitante: PerfilSolicitanteChamado;
};

/** Abre um novo chamado de manutenção. */
export function useCriarChamado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CriarChamadoInput) => {
      const { data, error } = await supabase
        .from("chamado_manutencao")
        .insert({
          local: args.local,
          residente_id: args.residenteId,
          problema: args.problema,
          urgencia: args.urgencia,
          aberto_por: args.abertoPor,
          perfil_solicitante: args.perfilSolicitante,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAMADOS_KEY });
    },
  });
}

/** Atribui responsável e prazo ao chamado, movendo para "em_andamento". */
export function useAtribuirResponsavel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; responsavel: string; prazo: string | null }) => {
      const { error } = await supabase
        .from("chamado_manutencao")
        .update({
          responsavel: args.responsavel,
          prazo: args.prazo,
          status: "em_andamento" as StatusChamado,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAMADOS_KEY });
    },
  });
}

/** Resolve o chamado, gravando a foto de evidência (se houver) e o horário de resolução. */
export function useResolverChamado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; fotoUrl: string | null }) => {
      const { error } = await supabase
        .from("chamado_manutencao")
        .update({
          status: "resolvido" as StatusChamado,
          resolvido_em: new Date().toISOString(),
          foto_url: args.fotoUrl,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAMADOS_KEY });
    },
  });
}
