// Poka-yoke de alergia: cruza o texto livre de `residentes.alergias` com o
// nome do medicamento sendo prescrito. É um cruzamento LEXICAL (substring,
// sem acento/caixa) — não substitui julgamento clínico; serve para fazer o
// alerta aparecer quando o nome do fármaco e o alérgeno coincidem.

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Retorna o alérgeno cadastrado que "casa" com o medicamento (ou null).
 * Tokens de alergia são separados por vírgula/;,/" e ". Considera match
 * quando um contém o outro (tokens com 4+ letras, para evitar falso positivo
 * com palavras curtas tipo "mel").
 */
export function alergiaConflitante(
  alergias: string | null | undefined,
  medicamento: string,
): string | null {
  if (!alergias || !medicamento.trim()) return null;
  const med = normalizar(medicamento);
  if (med.length < 4) return null;

  const tokens = alergias
    .split(/[,;/]|\be\b/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 4);

  for (const original of tokens) {
    const tok = normalizar(original);
    if (tok.length < 4) continue;
    if (med.includes(tok) || tok.includes(med)) return original;
  }
  return null;
}
