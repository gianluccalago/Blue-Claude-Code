// ===========================================================================
// Número padronizado do quarto: Bloco-Andar-Suíte-Letra (ex.: 1-2-04-A).
//   1 · Bloco   (1–5)
//   2 · Andar   (1–3)
//   3 · Suíte   (1–99, sempre com 2 dígitos)
//   4 · Letra   (A/B/C) — simples é sempre A; duplo A/B; triplo A/B/C.
// O Bloco reaproveita a coluna `modulo` e o Andar a coluna `andar`; a suíte e a
// letra vivem dentro da string `quarto`. parseQuarto() lê tanto o formato novo
// quanto o antigo ("1-2-04" / "1-2-06b").
// ===========================================================================

export type LetraQuarto = "A" | "B" | "C";

export interface PartesQuarto {
  bloco: number | null;
  andar: number | null;
  suite: number | null;
  letra: LetraQuarto | null;
}

const RE_QUARTO = /^(\d+)-(\d+)-(\d+)\s*-?\s*([A-Ca-c])?$/;

/** Monta o número padronizado (suíte com 2 dígitos; letra default "A"). */
export function montarQuarto(
  bloco: number | null,
  andar: number | null,
  suite: number | null,
  letra: LetraQuarto | null,
): string | null {
  if (bloco == null || andar == null || suite == null) return null;
  return `${bloco}-${andar}-${String(suite).padStart(2, "0")}-${letra ?? "A"}`;
}

/** Interpreta um número de quarto (formato novo ou antigo). */
export function parseQuarto(quarto: string | null | undefined): PartesQuarto {
  const vazio: PartesQuarto = { bloco: null, andar: null, suite: null, letra: null };
  if (!quarto) return vazio;
  const m = quarto.trim().match(RE_QUARTO);
  if (!m) return vazio;
  return {
    bloco: Number(m[1]),
    andar: Number(m[2]),
    suite: Number(m[3]),
    letra: (m[4]?.toUpperCase() as LetraQuarto) ?? null,
  };
}
