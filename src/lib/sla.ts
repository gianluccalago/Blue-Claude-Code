// ===========================================================================
// Limites de envelhecimento das filas (gestão visual / fluxo puxado).
//
// DEFAULTS PROVISÓRIOS — os valores finais serão PACTUADOS PELA GESTÃO
// (SLA é acordo antes de campo; ver AUDITORIA_LEAN_DISNEY.md §5.1).
// Centralizados aqui para a mudança ser um número, não uma caça por telas.
// ===========================================================================

export const SLA_HORAS = {
  /** Pendências clínicas (medicação não administrada, intercorrência, escalado ao médico). */
  pendenciaClinica: 4,
  /** Solicitações da família (qualquer destino). */
  solicitacaoFamilia: 24,
  /** Chamados de manutenção NÃO urgentes (emergência tem fila própria, sempre no topo). */
  chamadoNaoUrgente: 48,
} as const;

/** Horas decorridas desde um timestamp ISO. */
export function horasDesde(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 36e5;
}

/** Idade humana: "há 35 min", "há 3h", "há 2 dias". */
export function idadeTexto(iso: string): string {
  const h = horasDesde(iso);
  if (h < 1) return `há ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `há ${Math.round(h)}h`;
  return `há ${Math.round(h / 24)} dias`;
}

/** O item estourou o limite (em horas)? */
export function estourouSLA(iso: string, limiteHoras: number): boolean {
  return horasDesde(iso) > limiteHoras;
}
