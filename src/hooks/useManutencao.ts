import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadFotoManutencao } from "@/lib/storage";
import type {
  ChamadoManutencao,
  DestinoChamado,
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
  /** Quem trata o chamado: Hotelaria ou Serviços Gerais. */
  destino: DestinoChamado;
  /** Foto do problema (opcional). */
  foto?: File | null;
};

/**
 * Abre um novo chamado de manutenção, com upload opcional de foto.
 * O id é gerado no cliente para subir a foto ANTES do insert e gravar tudo de
 * uma vez — sem RETURNING nem update pós-insert. Isso mantém o INSERT compatível
 * com a RLS por destino (quem abre não precisa de SELECT do chamado criado).
 */
export function useCriarChamado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CriarChamadoInput) => {
      const id = crypto.randomUUID();
      const fotoUrl = args.foto ? await uploadFotoManutencao(args.foto, id) : null;

      const { error } = await supabase.from("chamado_manutencao").insert({
        id,
        local: args.local,
        residente_id: args.residenteId,
        problema: args.problema,
        urgencia: args.urgencia,
        aberto_por: args.abertoPor,
        perfil_solicitante: args.perfilSolicitante,
        destino: args.destino,
        foto_url: fotoUrl,
      });
      if (error) throw error;

      return id;
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
          // Mantém a foto já anexada (na abertura) caso nenhuma seja enviada agora.
          ...(args.fotoUrl ? { foto_url: args.fotoUrl } : {}),
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CHAMADOS_KEY });
    },
  });
}
