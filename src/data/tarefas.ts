/** Tarefas pré-definidas para planos de cuidado e modelos de rotina. */
export const TAREFAS_PREDEFINIDAS = [
  "Sinais vitais",
  "Medicação",
  "Higiene oral",
  "Banho e troca",
  "Prótese dentária",
  "Aparelho auditivo",
  "Hidratação",
  "Mudança de decúbito",
  "Glicemia capilar",
  "Aplicação de creme/hidratação da pele",
  "Sondagem de alívio",
  "Condução ao refeitório",
  "Condução à fisioterapia",
  "Banho de sol",
  "Estímulo cognitivo",
  "Troca de fralda",
  "Posicionamento",
] as const;

/** Valor especial do dropdown que libera o campo de texto livre. */
export const TAREFA_OUTRA = "Outra (digitar)";

export type Responsavel = "cuidador" | "enfermagem";

/**
 * "Quando" a tarefa acontece (0145): em horário fixo (turno_livre = null) ou a
 * qualquer momento de um plantão de 12h — ex.: banho, que não tem hora marcada.
 */
export const TURNO_LIVRE_OPCOES: ReadonlyArray<{ valor: "diurno" | "noturno" | "ambos"; label: string; curto: string }> = [
  { valor: "diurno", label: "A qualquer momento do turno diurno (07h–19h)", curto: "Turno diurno" },
  { valor: "noturno", label: "A qualquer momento do turno noturno (19h–07h)", curto: "Turno noturno" },
  { valor: "ambos", label: "A qualquer momento, em todos os turnos", curto: "Todo turno" },
];

export function rotuloTurnoLivre(valor: string | null | undefined): string | null {
  return TURNO_LIVRE_OPCOES.find((o) => o.valor === valor)?.curto ?? null;
}
