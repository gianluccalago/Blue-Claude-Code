// ===========================================================================
// FATURAMENTO DA CONSTRUTORA — regras de janela e dados do tomador.
// Fluxo acordado: nos dias 1 e 11 de cada mês a TRÍADE confere o que está
// aferido e confirmado (Aprovado), emite a NF contra a Seniors Care e anexa;
// nós pagamos e anexamos o comprovante.
// ===========================================================================

/** Dias do mês em que a construtora fatura (confere aprovados + emite NF). */
export const DIAS_JANELA_FATURAMENTO = [1, 11] as const;

/** Dados do TOMADOR para emissão da NF (qualificação do contrato, cláusula 1.1). */
export const TOMADOR_NF = {
  razaoSocial: "Seniors Care Ltda.",
  cnpj: "42.200.613/0001-85",
  endereco: "Rua Pastor Manoel Virgínio de Souza, nº 1.071 — Capão da Imbuia",
  cep: "82810-400",
  municipio: "Curitiba/PR",
  /** Cláusula 7.1.5.2 — retenções que a NF deve destacar quando aplicáveis. */
  retencoes: "Destacar retenções legais: INSS (art. 31, Lei 8.212/91), ISS de Curitiba e IRRF/CSRF quando aplicáveis (cláusula 7.1.5.2).",
} as const;

/**
 * Próxima janela de faturamento a partir de `hoje` (ISO yyyy-mm-dd),
 * INCLUSIVE: se hoje é dia 1 ou 11, a janela é hoje.
 */
export function proximaJanelaFaturamento(hoje: string): string {
  const [ano, mes, dia] = hoje.split("-").map((n) => parseInt(n, 10));
  if (dia <= 1) return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-01`;
  if (dia <= 11) return `${String(ano).padStart(4, "0")}-${String(mes).padStart(2, "0")}-11`;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const proxAno = mes === 12 ? ano + 1 : ano;
  return `${String(proxAno).padStart(4, "0")}-${String(proxMes).padStart(2, "0")}-01`;
}

/** Hoje é dia de janela (1 ou 11)? */
export function ehDiaDeJanela(hoje: string): boolean {
  const dia = parseInt(hoje.slice(8, 10), 10);
  return (DIAS_JANELA_FATURAMENTO as readonly number[]).includes(dia);
}
