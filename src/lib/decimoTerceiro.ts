/**
 * 13º dos hóspedes — cobrança própria (NÃO depende de upselling).
 *
 * Cobra-se um 13º = valor de UMA mensalidade base, dividido em DUAS parcelas:
 * metade em NOVEMBRO, metade em DEZEMBRO. Proporcional ao tempo no ano civil
 * (meses de permanência ÷ 12) a partir da data de admissão. Hóspede o ano todo
 * → integral. É calculado (não armazenado): determinístico, sem risco de duplicar.
 */

export function mesNumero(mes: string): number {
  return parseInt(mes.slice(5, 7), 10) || 0;
}

/** 1 em novembro, 2 em dezembro, null nos demais meses. */
export function parcelaDecimo(mes: string): 1 | 2 | null {
  const n = mesNumero(mes);
  return n === 11 ? 1 : n === 12 ? 2 : null;
}

export function rotuloParcelaDecimo(mes: string): string | null {
  const p = parcelaDecimo(mes);
  return p === 1 ? "13º — 1ª parcela" : p === 2 ? "13º — 2ª parcela" : null;
}

/** Meses de permanência no ANO `ano`, a partir da data de admissão (0–12). */
export function mesesDeAno(dataAdmissao: string | null | undefined, ano: number): number {
  if (!dataAdmissao) return 12; // sem data → assume ano inteiro
  const [a, m] = dataAdmissao.split("-").map(Number);
  if (!a || !m) return 12;
  if (a > ano) return 0; // admitido depois do ano de referência
  if (a < ano) return 12; // já estava na casa
  return Math.max(0, Math.min(12, 13 - m)); // entrou no mês m deste ano
}

/**
 * Valor da PARCELA (nov ou dez) do 13º proporcional. 0 se o mês não for nov/dez.
 * parcela = mensalidadeBase × (meses no ano ÷ 12) ÷ 2.
 */
export function valorParcelaDecimo(
  mensalidadeBase: number,
  dataAdmissao: string | null | undefined,
  mes: string,
): number {
  if (parcelaDecimo(mes) === null) return 0;
  const ano = parseInt(mes.slice(0, 4), 10);
  const meses = mesesDeAno(dataAdmissao, ano);
  return (mensalidadeBase * (meses / 12)) / 2;
}
