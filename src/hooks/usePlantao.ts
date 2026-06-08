import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { dataISO, hojeISO, somarDias } from "@/lib/utils";
import type { Turno } from "@/types/database";

// Tolerância de 10 min antes do início e depois do fim do turno.
const TOLERANCIA_MS = 10 * 60 * 1000;

export type EstadoPlantao = "carregando" | "sem_turno" | "sem_checkin" | "ativo";

export interface Plantao {
  estado: EstadoPlantao;
  /** Checklist liberado para registrar ações? (somente quando "ativo") */
  liberado: boolean;
  /** Turno ativo no momento (dentro do horário + tolerância), se houver. */
  turnoAtivo: Turno | null;
  /** check_in do turno ativo (ISO), se já iniciado. */
  checkInEm: string | null;
  isError: boolean;
  error: unknown;
  fazerCheckIn: () => void;
  fazerCheckOut: () => void;
  pending: boolean;
}

/** Um turno está "no horário" se agora ∈ [inicio-10min, fim+10min]. */
function noHorario(turno: Turno, agora: number): boolean {
  const ini = new Date(turno.inicio).getTime() - TOLERANCIA_MS;
  const fim = new Date(turno.fim).getTime() + TOLERANCIA_MS;
  return agora >= ini && agora <= fim;
}

/**
 * Estado do plantão da cuidadora atual (fixa: Ana Paula, enquanto não há login;
 * quando a autenticação existir, passa a valer para a cuidadora logada).
 *
 * Lê a tabela turnos (somente leitura no que toca às Escalas) e grava apenas
 * os campos check_in/check_out do próprio turno ao bater ponto.
 */
export function usePlantao(): Plantao {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["plantao", CUIDADOR_ATUAL.id, hojeISO()],
    queryFn: async (): Promise<Turno[]> => {
      // Busca turnos de ontem e hoje (cobre o noturno que cruza a meia-noite).
      const ontem = dataISO(somarDias(new Date(), -1));
      const hoje = hojeISO();
      const { data, error } = await supabase
        .from("turnos")
        .select("*")
        .eq("profissional_id", CUIDADOR_ATUAL.id)
        .gte("data", ontem)
        .lte("data", hoje);
      if (error) throw error;
      return data ?? [];
    },
    // Recalcula periodicamente para o turno "expirar" sem precisar recarregar.
    refetchInterval: 60 * 1000,
  });

  const agora = Date.now();
  const ativos = (query.data ?? []).filter((t) => noHorario(t, agora));
  // Prioriza um turno já iniciado e não encerrado (plantão em andamento).
  const turnoAtivo =
    ativos.find((t) => t.check_in && !t.check_out) ?? ativos[0] ?? null;

  let estado: EstadoPlantao;
  if (query.isLoading) estado = "carregando";
  else if (!turnoAtivo) estado = "sem_turno";
  else if (turnoAtivo.check_in && !turnoAtivo.check_out) estado = "ativo";
  else estado = "sem_checkin";

  const invalidar = () =>
    qc.invalidateQueries({ queryKey: ["plantao", CUIDADOR_ATUAL.id, hojeISO()] });

  const checkIn = useMutation({
    mutationFn: async (turnoId: string) => {
      // Novo check-in zera um eventual check-out anterior do mesmo turno.
      const { error } = await supabase
        .from("turnos")
        .update({ check_in: new Date().toISOString(), check_out: null })
        .eq("id", turnoId);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  const checkOut = useMutation({
    mutationFn: async (turnoId: string) => {
      const { error } = await supabase
        .from("turnos")
        .update({ check_out: new Date().toISOString() })
        .eq("id", turnoId);
      if (error) throw error;
    },
    onSuccess: invalidar,
  });

  return {
    estado,
    liberado: estado === "ativo",
    turnoAtivo,
    checkInEm: turnoAtivo?.check_in ?? null,
    isError: query.isError,
    error: query.error,
    fazerCheckIn: () => turnoAtivo && checkIn.mutate(turnoAtivo.id),
    fazerCheckOut: () => turnoAtivo && checkOut.mutate(turnoAtivo.id),
    pending: checkIn.isPending || checkOut.isPending,
  };
}
