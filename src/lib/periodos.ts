import type { PeriodoMedicacao } from "@/types/database";

// ===========================================================================
// Períodos do dia (os mesmos 6 das telas de medicação) + "hora atual" no fuso
// America/Sao_Paulo. Centralizado aqui para o serviço de NOTIFICAÇÕES decidir o
// que já está "no prazo/atrasado". As telas têm cópias próprias do array; não
// foram refatoradas para não arriscar o que já funciona.
// ===========================================================================

export const PERIODOS_MED: { key: PeriodoMedicacao; horario: string }[] = [
  { key: "jejum", horario: "06:00" },
  { key: "manha", horario: "08:00" },
  { key: "almoco", horario: "12:00" },
  { key: "apos_almoco", horario: "13:00" },
  { key: "tarde", horario: "16:00" },
  { key: "noite", horario: "20:00" },
];

function hhmmParaMin(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

/** Minutos desde a meia-noite NO FUSO America/Sao_Paulo (independe do device). */
export function minutosAgoraSP(d: Date = new Date()): number {
  const f = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = f.formatToParts(d);
  const h = Number(p.find((x) => x.type === "hour")?.value ?? "0") % 24;
  const m = Number(p.find((x) => x.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/** Períodos cujo horário-padrão JÁ passou (deveriam ter sido feitos até agora). */
export function periodosAteAgora(d: Date = new Date()): PeriodoMedicacao[] {
  const min = minutosAgoraSP(d);
  return PERIODOS_MED.filter((p) => hhmmParaMin(p.horario) <= min).map((p) => p.key);
}
