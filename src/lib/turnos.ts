import type { TipoRemuneracao } from "@/types/database";

// ===========================================================================
// Regra de CARGA HORÁRIA dos turnos. NÃO afeta o pagamento (que é por plantão
// fixo) — só a contagem de horas EFETIVAS exibida em indicadores de carga.
//
// Plantões de ~12h de profissionais PJ (por_plantao) descontam 1h de almoço →
// contam como 11h efetivas. Sem check-in/out de almoço e sem registro fictício:
// é só cálculo. CLT (mensal_fixo, isentos) e turnos que não sejam de 12h não
// sofrem desconto.
// ===========================================================================

/** Duração do turno em horas, a partir dos timestamps inicio/fim. */
export function duracaoHorasTurno(turno: { inicio: string; fim: string }): number {
  const ini = new Date(turno.inicio).getTime();
  const fim = new Date(turno.fim).getTime();
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) return 0;
  let horas = (fim - ini) / 36e5;
  // Tolera fim "sem a data seguinte" num turno que cruza a meia-noite.
  if (horas <= 0) horas += 24;
  return horas;
}

/** Turno de ~12h (janela 11–13h, tolerando variação de minutos). */
export function ehTurno12h(horas: number): boolean {
  return horas >= 11 && horas <= 13;
}

/** Horas EFETIVAS do turno (desconta 1h de almoço nos plantões 12h PJ). */
export function horasEfetivasTurno(
  turno: { inicio: string; fim: string },
  tipoRemuneracao: TipoRemuneracao | null,
): number {
  const horas = duracaoHorasTurno(turno);
  if (tipoRemuneracao === "por_plantao" && ehTurno12h(horas)) return horas - 1;
  return horas;
}

/** "11h" / "23,5h" para exibição compacta de carga horária. */
export function formatarHoras(horas: number): string {
  const arred = Math.round(horas * 10) / 10;
  return `${arred.toLocaleString("pt-BR")}h`;
}
