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

/** Tempo de permanência (entrada → saída) em linguagem natural. */
export function tempoPermanencia(entrada: string | null, saida: string | null): string {
  if (!entrada || !saida) return "Não informado";
  const d1 = new Date(`${entrada}T00:00:00`);
  const d2 = new Date(`${saida}T00:00:00`);
  if (isNaN(d1.getTime()) || isNaN(d2.getTime()) || d2 < d1) return "Não informado";

  let meses = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
  if (d2.getDate() < d1.getDate()) meses -= 1;
  if (meses < 0) meses = 0;

  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  const partes: string[] = [];
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? "s" : ""}`);
  if (m > 0) partes.push(`${m} ${m > 1 ? "meses" : "mês"}`);
  if (partes.length === 0) {
    const dias = Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86_400_000));
    return `${dias} dia${dias !== 1 ? "s" : ""}`;
  }
  return partes.join(" e ");
}
