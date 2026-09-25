import type { PeriodoMedicacao } from "@/types/database";

// ===========================================================================
// PRESCRIÇÃO — regras PURAS de consistência do formulário (CLI-05, CLI-13).
// Nada aqui inventa horário nem dose: só confere que o que o médico marcou é
// coerente com o que ele escreveu (nº de períodos × frequência) e que a
// quantidade por administração é um número positivo.
// ===========================================================================

/**
 * Opções do seletor de posologia do Médico. `periodos` é apenas a PRÉ-MARCAÇÃO
 * sugerida ao trocar a opção (o médico pode alterar); a validação de
 * coerência usa só a CONTAGEM (ver dosesPorDiaDaPosologia).
 */
export const POSOLOGIA_OPCOES: { value: string; label: string; periodos: PeriodoMedicacao[] }[] = [
  { value: "1x/dia", label: "1x/dia", periodos: ["manha"] },
  { value: "12/12h", label: "12/12h", periodos: ["manha", "noite"] },
  { value: "8/8h", label: "8/8h", periodos: ["manha", "almoco", "noite"] },
  { value: "6/6h", label: "6/6h", periodos: ["manha", "almoco", "tarde", "noite"] },
  { value: "1x/dia em jejum", label: "1x/dia em jejum", periodos: ["jejum"] },
  { value: "1x/dia à noite", label: "1x/dia à noite", periodos: ["noite"] },
  { value: "Personalizado", label: "Personalizado", periodos: [] },
];

/** Rótulos dos períodos (para mensagens de validação). */
export const PERIODO_ROTULO: Record<PeriodoMedicacao, string> = {
  jejum: "Jejum",
  manha: "Manhã",
  almoco: "Almoço",
  apos_almoco: "Após almoço",
  tarde: "Tarde",
  noite: "Noite",
};

/** Valor de posologia que significa "sem validação de contagem". */
export const POSOLOGIA_LIVRE = "Personalizado";

/**
 * Quantas administrações por dia a posologia exige, ou null quando a
 * posologia é livre/condicional e não deve ser validada ("Personalizado",
 * "se necessário", "SOS", texto não reconhecido).
 *   "8/8h" → 3 · "6/6h" → 4 · "12/12h" → 2 · "24/24h" → 1
 *   "1x/dia", "2x ao dia", "3 x/dia", "1x/dia em jejum" → 1, 2, 3, 1
 */
export function dosesPorDiaDaPosologia(posologia: string | null | undefined): number | null {
  const t = (posologia ?? "").trim().toLowerCase();
  if (!t || t === POSOLOGIA_LIVRE.toLowerCase()) return null;
  // Condicional: "se necessário", "s/n", "SOS", "a critério" → não valida.
  if (/\b(se\s+necess|s\s*\/\s*n\b|sos\b|crit[eé]rio|quando\s+necess)/.test(t)) return null;

  // "8/8h", "8 / 8 h", "de 12 em 12 horas"
  const intervalo = t.match(/(\d{1,2})\s*(?:\/|em)\s*(\d{1,2})\s*h(?:oras?)?\b/);
  if (intervalo && intervalo[1] === intervalo[2]) {
    const h = Number(intervalo[1]);
    if (h > 0 && h <= 24 && 24 % h === 0) return 24 / h;
    return null;
  }

  // "1x/dia", "2 x ao dia", "3x por dia", "1x dia"
  const vezes = t.match(/(\d{1,2})\s*x\s*(?:\/|ao|por)?\s*dia\b/);
  if (vezes) {
    const n = Number(vezes[1]);
    return n > 0 ? n : null;
  }
  return null;
}

/**
 * Mensagem de erro quando o nº de períodos marcados não bate com a posologia;
 * null quando está coerente ou quando a posologia é livre.
 */
export function validarPeriodosPosologia(
  posologia: string | null | undefined,
  periodosMarcados: number,
): string | null {
  const esperado = dosesPorDiaDaPosologia(posologia);
  if (esperado === null || esperado === periodosMarcados) return null;
  const texto = (posologia ?? "").trim();
  const s = esperado === 1 ? "" : "s";
  return `A posologia "${texto}" corresponde a ${esperado} período${s} por dia, mas ${
    periodosMarcados === 1 ? "há 1 período marcado" : `há ${periodosMarcados} períodos marcados`
  }. Ajuste os períodos ou escolha "${POSOLOGIA_LIVRE}".`;
}

/**
 * Lê a quantidade por administração: um número positivo (inteiro, decimal com
 * vírgula ou ponto, fração "1/2" ou misto "1 1/2") seguido de unidade opcional.
 *   "1 comprimido" → {numero: 1, unidade: "comprimido"}
 *   "1/2" → 0,5 · "0,5 ml" → 0,5 · "1 1/2 cp" → 1,5 · "20 UI" → 20
 * Retorna null para vazio, zero, negativo ou texto sem número na frente.
 */
export function parsearQuantidade(texto: string | null | undefined): { numero: number; unidade: string } | null {
  const t = (texto ?? "").trim();
  if (!t) return null;
  const m = t.match(/^(\d+(?:[.,]\d+)?)(?:\s+(\d+)\s*\/\s*(\d+)|\s*\/\s*(\d+))?(?:\s+(.*))?$/);
  if (!m) return null;
  let numero = parseFloat(m[1].replace(",", "."));
  if (m[2] !== undefined && m[3] !== undefined) {
    // Misto: "1 1/2"
    const den = Number(m[3]);
    if (den === 0) return null;
    numero += Number(m[2]) / den;
  } else if (m[4] !== undefined) {
    // Fração simples: "1/2"
    const den = Number(m[4]);
    if (den === 0) return null;
    numero = numero / den;
  }
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return { numero, unidade: (m[5] ?? "").trim() };
}

/** Mensagem de erro para quantidade ausente ou não numérica positiva; null se válida. */
export function validarQuantidade(texto: string | null | undefined, rotuloPeriodo?: string): string | null {
  const onde = rotuloPeriodo ? ` (${rotuloPeriodo})` : "";
  if (!(texto ?? "").trim()) return `Informe a quantidade${onde}.`;
  if (!parsearQuantidade(texto)) {
    return `Quantidade inválida${onde}: comece com um número maior que zero (ex.: "1 comprimido", "1/2", "0,5 ml").`;
  }
  return null;
}
