import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadFotoAtividade } from "@/lib/storage";
import { MULTI_ATUAL } from "@/data/profiles";
import type { Atividade, AtividadeExecucao, AtividadeParticipacao } from "@/types/database";

const ATIVIDADES_KEY = ["atividades"];
const HISTORICO_KEY = ["atividade-historico"];

// ─── Agenda ───────────────────────────────────────────────────────────────────

/** Todas as atividades de grupo cadastradas, ordenadas por horário. */
export function useAtividades() {
  return useQuery({
    queryKey: ATIVIDADES_KEY,
    queryFn: async (): Promise<Atividade[]> => {
      const { data, error } = await supabase.from("atividade").select("*").order("horario");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Dia da semana (0=domingo..6=sábado) de uma data "YYYY-MM-DD". */
export function diaSemanaDe(data: string): number {
  return new Date(data + "T00:00:00").getDay();
}

/** Atividades que ocorrem numa data: pontuais com `data` igual, ou recorrentes no dia da semana. */
export function atividadesDoDia(atividades: Atividade[], data: string): Atividade[] {
  const dow = String(diaSemanaDe(data));
  return atividades.filter((a) => (a.recorrente ? (a.dias_semana ?? []).includes(dow) : a.data === data));
}

export type CriarAtividadeInput = {
  titulo: string;
  descricao: string | null;
  horario: string;
  recorrente: boolean;
  /** Obrigatório quando `recorrente` é false. */
  data?: string;
  /** Obrigatório quando `recorrente` é true. */
  diasSemana?: string[];
};

/** Cria uma nova atividade de grupo (pontual ou recorrente). */
export function useCriarAtividade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: CriarAtividadeInput) => {
      const { error } = await supabase.from("atividade").insert({
        titulo: args.titulo,
        descricao: args.descricao,
        horario: args.horario,
        recorrente: args.recorrente,
        data: args.recorrente ? null : args.data ?? null,
        dias_semana: args.recorrente ? args.diasSemana ?? null : null,
        criada_por: MULTI_ATUAL.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ATIVIDADES_KEY }),
  });
}

// ─── Execução do dia ────────────────────────────────────────────────────────────

/** Execuções já registradas numa data, para saber quais atividades já têm registro. */
export function useExecucoesDoDia(data: string) {
  return useQuery({
    queryKey: ["atividade-execucoes", data],
    queryFn: async (): Promise<AtividadeExecucao[]> => {
      const { data: rows, error } = await supabase.from("atividade_execucao").select("*").eq("data", data);
      if (error) throw error;
      return rows ?? [];
    },
  });
}

/** Participantes registrados numa execução (atividade + data). */
export function useParticipantesDaExecucao(atividadeId: string, data: string) {
  return useQuery({
    queryKey: ["atividade-participantes", atividadeId, data],
    queryFn: async (): Promise<AtividadeParticipacao[]> => {
      const { data: rows, error } = await supabase
        .from("atividade_participacao")
        .select("*")
        .eq("atividade_id", atividadeId)
        .eq("data", data);
      if (error) throw error;
      return rows ?? [];
    },
  });
}

export type RegistrarExecucaoInput = {
  atividadeId: string;
  data: string;
  descricaoGeral: string | null;
  /** Foto do registro da atividade — obrigatória. */
  foto: File;
  /** IDs dos residentes que participaram (ausência é implícita). */
  participantesIds: string[];
};

/** Registra a execução de uma atividade do dia: foto, descrição geral e presenças. */
export function useRegistrarExecucao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: RegistrarExecucaoInput) => {
      const fotoUrl = await uploadFotoAtividade(args.foto, args.atividadeId, args.data);
      if (!fotoUrl) throw new Error("Falha ao enviar a foto da atividade. Tente novamente.");

      const { error: errExec } = await supabase.from("atividade_execucao").insert({
        atividade_id: args.atividadeId,
        data: args.data,
        descricao_geral: args.descricaoGeral,
        foto_url: fotoUrl,
        realizada_por: MULTI_ATUAL.nome,
      });
      if (errExec) throw errExec;

      if (args.participantesIds.length > 0) {
        const { error: errPart } = await supabase.from("atividade_participacao").insert(
          args.participantesIds.map((residenteId) => ({
            atividade_id: args.atividadeId,
            data: args.data,
            residente_id: residenteId,
            presente: true,
            registrado_por: MULTI_ATUAL.nome,
          }))
        );
        if (errPart) throw errPart;
      }
    },
    onSuccess: (_r, args) => {
      qc.invalidateQueries({ queryKey: ["atividade-execucoes", args.data] });
      qc.invalidateQueries({ queryKey: ["atividade-participantes", args.atividadeId, args.data] });
      qc.invalidateQueries({ queryKey: HISTORICO_KEY });
    },
  });
}

// ─── Histórico por hóspede ──────────────────────────────────────────────────────

export type ParticipacaoComAtividade = AtividadeParticipacao & {
  atividade_titulo?: string;
  atividade_horario?: string;
};

/** Histórico de participação de um residente em atividades, mais recente primeiro. */
export function useHistoricoParticipacao(residenteId: string | undefined) {
  return useQuery({
    queryKey: [...HISTORICO_KEY, residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<ParticipacaoComAtividade[]> => {
      const { data, error } = await supabase
        .from("atividade_participacao")
        .select("*, atividade:atividade_id(titulo, horario)")
        .eq("residente_id", residenteId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        ...(row as AtividadeParticipacao),
        atividade_titulo: (row.atividade as { titulo?: string } | null)?.titulo,
        atividade_horario: (row.atividade as { horario?: string } | null)?.horario,
      }));
    },
  });
}
