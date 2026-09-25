// ===========================================================================
// Plano de cuidado — utilidades puras (sem React, sem Supabase).
// ===========================================================================

/** Retorno da RPC aplicar_modelo_rotina (0137). */
export interface ResultadoAplicacaoModelo {
  /** Tarefas do modelo que entraram no plano nesta chamada. */
  inseridas: number;
  /** Tarefas do modelo que já existiam ativas no plano (não duplicadas). */
  existentes: number;
}

function plural(n: number, singular: string, pluralForm: string): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

/**
 * Frase curta para o toast após aplicar um modelo. Diz o que entrou e o que
 * já estava lá — assim quem reaplica por engano entende por que "nada mudou".
 */
export function resumoAplicacaoModelo(r: ResultadoAplicacaoModelo): string {
  if (r.inseridas === 0 && r.existentes === 0) return "O modelo não tem tarefas.";
  if (r.inseridas === 0) return "Nenhuma tarefa nova: todas já estavam no plano.";
  const base = `${plural(r.inseridas, "tarefa adicionada", "tarefas adicionadas")}.`;
  if (r.existentes === 0) return base;
  return `${base} ${plural(r.existentes, "já estava", "já estavam")} no plano.`;
}
