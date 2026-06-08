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
