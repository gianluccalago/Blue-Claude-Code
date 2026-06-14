// ===========================================================================
// Número padronizado do quarto: Bloco·Andar·Suíte·Letra (ex.: 1204A).
//   1 · Bloco   (1–5)   — 1 dígito
//   2 · Andar   (1–3)   — 1 dígito
//   3 · Suíte   (1–99)  — sempre 2 dígitos
//   4 · Letra   (A/B/C) — simples é sempre A; duplo A/B; triplo A/B/C.
// O número é uma string contínua, SEM separadores (1204A). O Bloco reaproveita a
// coluna `modulo` e o Andar a coluna `andar`; a suíte e a letra vivem dentro da
// string `quarto`. parseQuarto() lê o formato novo (1204A) e os antigos com
// traços ("1-2-04-A" / "1-2-06b").
// ===========================================================================

export type LetraQuarto = "A" | "B" | "C";

export interface PartesQuarto {
  bloco: number | null;
  andar: number | null;
  suite: number | null;
  letra: LetraQuarto | null;
}

// Formato novo, contínuo: bloco(1) andar(1) suíte(2) letra(opcional).
const RE_QUARTO_NOVO = /^(\d)(\d)(\d{2})\s*([A-Ca-c])?$/;
// Formatos antigos com traços: "1-2-04-A" / "1-2-06b".
const RE_QUARTO_LEGADO = /^(\d+)-(\d+)-(\d+)\s*-?\s*([A-Ca-c])?$/;

/** Monta o número padronizado (suíte com 2 dígitos; letra default "A"). */
export function montarQuarto(
  bloco: number | null,
  andar: number | null,
  suite: number | null,
  letra: LetraQuarto | null,
): string | null {
  if (bloco == null || andar == null || suite == null) return null;
  return `${bloco}${andar}${String(suite).padStart(2, "0")}${letra ?? "A"}`;
}

/** Interpreta um número de quarto (formato novo, contínuo, ou antigo com traços). */
export function parseQuarto(quarto: string | null | undefined): PartesQuarto {
  const vazio: PartesQuarto = { bloco: null, andar: null, suite: null, letra: null };
  if (!quarto) return vazio;
  const t = quarto.trim();
  const m = t.match(RE_QUARTO_NOVO) ?? t.match(RE_QUARTO_LEGADO);
  if (!m) return vazio;
  return {
    bloco: Number(m[1]),
    andar: Number(m[2]),
    suite: Number(m[3]),
    letra: (m[4]?.toUpperCase() as LetraQuarto) ?? null,
  };
}

/**
 * Formata um número de quarto para exibição SEM traços (1204A). Aceita valores
 * já normalizados e os antigos com traços; o que não casar o padrão é devolvido
 * como veio (não inventamos formatação sobre texto livre).
 */
export function formatarQuarto(quarto: string | null | undefined): string | null {
  if (!quarto) return null;
  const p = parseQuarto(quarto);
  return montarQuarto(p.bloco, p.andar, p.suite, p.letra) ?? quarto;
}
