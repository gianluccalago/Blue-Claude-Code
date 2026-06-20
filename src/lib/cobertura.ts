import { dataISO } from "@/lib/utils";
import type { TagTurno } from "@/types/database";

// ===========================================================================
// Cobertura Assistencial — utilidades puras (turnos, presença, day care).
//
// O turno aqui é a TAG da escala (diurno/noturno). A enfermeira NÃO é designada:
// vem da escala (turnos categoria='enfermeiras'). Day care só frequenta à
// tarde → só aparece para designar no turno DIURNO.
// ===========================================================================

export const TURNOS_COBERTURA: { tag: TagTurno; label: string }[] = [
  { tag: "diurno", label: "Diurno" },
  { tag: "noturno", label: "Noturno" },
];

export const TURNO_LABEL: Record<TagTurno, string> = {
  diurno: "Diurno",
  noturno: "Noturno",
};

/**
 * Turno corrente (default do seletor; navegável). Heurística por hora:
 * 06:00–17:59 = diurno; senão noturno. A madrugada (00:00–05:59) pertence ao
 * turno noturno da DATA ANTERIOR (o plantão começou na véspera).
 */
export function turnoCorrente(now: Date = new Date()): { data: string; tag: TagTurno } {
  const h = now.getHours();
  if (h >= 6 && h < 18) return { data: dataISO(now), tag: "diurno" };
  if (h < 6) {
    const ontem = new Date(now);
    ontem.setDate(ontem.getDate() - 1);
    return { data: dataISO(ontem), tag: "noturno" };
  }
  return { data: dataISO(now), tag: "noturno" };
}

/** Day care só é atendido à tarde → só entra no turno diurno. */
export function dayCareNoTurno(tag: TagTurno): boolean {
  return tag === "diurno";
}

// ─── Presença (cruza designação/escala com o check-in/out do turno) ───────────

export type PresencaTurno = "presente" | "saiu" | "sem_check_in";

/** Deriva a presença a partir do check-in/out do turno da escala. */
export function presencaDoTurno(t: { check_in: string | null; check_out: string | null }): PresencaTurno {
  if (t.check_out) return "saiu";
  if (t.check_in) return "presente";
  return "sem_check_in";
}

export const PRESENCA_LABEL: Record<PresencaTurno, string> = {
  presente: "Check-in feito",
  saiu: "Check-out",
  sem_check_in: "Sem check-in",
};

export const PRESENCA_VARIANTE: Record<PresencaTurno, "success" | "muted" | "warning"> = {
  presente: "success",
  saiu: "muted",
  sem_check_in: "warning",
};

/** "Presente de verdade" = fez check-in e ainda não saiu. */
export function estaPresente(p: PresencaTurno): boolean {
  return p === "presente";
}
