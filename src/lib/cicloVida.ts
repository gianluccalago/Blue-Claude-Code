/** Ciclo de vida do hóspede — motivos de saída e tempo de permanência. */

export const MOTIVOS_SAIDA = [
  "Falecimento",
  "Retorno para casa",
  "Mudança para outro residencial",
  "Inadimplência",
  "Aumento de grau (incompatível)",
  "Curta permanência",
  "Outro",
] as const;

export type MotivoSaida = (typeof MOTIVOS_SAIDA)[number];

/** Tempo de permanência em MESES (numérico) — para médias/agregações. */
export function mesesPermanencia(entrada: string | null, saida: string | null): number | null {
  if (!entrada || !saida) return null;
  const d1 = new Date(`${entrada}T00:00:00`);
  const d2 = new Date(`${saida}T00:00:00`);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return null;
  let meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) meses -= 1;
  return Math.max(0, meses);
}

/** Formata uma quantidade de meses (ex.: média) em anos/meses. */
export function formatarMeses(meses: number | null): string {
  if (meses == null) return "Não informado";
  const arred = Math.round(meses);
  const anos = Math.floor(arred / 12);
  const m = arred % 12;
  const partes: string[] = [];
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? "s" : ""}`);
  if (m > 0) partes.push(`${m} ${m > 1 ? "meses" : "mês"}`);
  if (partes.length === 0) return "menos de 1 mês";
  return partes.join(" e ");
}

/** Tempo de permanência (entrada → saída) em linguagem natural. */
export function tempoPermanencia(entrada: string | null, saida: string | null): string {
  const meses = mesesPermanencia(entrada, saida);
  if (meses == null) return "Não informado";
  if (meses === 0) {
    const d1 = new Date(`${entrada}T00:00:00`);
    const d2 = new Date(`${saida}T00:00:00`);
    const dias = Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86_400_000));
    return `${dias} dia${dias !== 1 ? "s" : ""}`;
  }
  return formatarMeses(meses);
}

