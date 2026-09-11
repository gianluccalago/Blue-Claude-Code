// ===========================================================================
// FLUXO DE CAIXA — regras de cálculo (visão do diretor: SEMPRE caixa).
// Fórmula da correção (a mesma da planilha CustoBlue):
//   corrigido(mês) = (corrigido anterior + desembolso do mês) × (1 + IPCA do mês)
// ===========================================================================

/** Centros de custo canônicos (o campo aceita valores livres além destes). */
export const CENTROS_CUSTO = [
  { value: "terreno", label: "Terreno" },
  { value: "projetos", label: "Projetos (arquitetura)" },
  { value: "complementares", label: "Projetos complementares" },
  { value: "construtora", label: "Construtora (mão de obra)" },
  { value: "materiais", label: "Materiais de construção" },
  { value: "indiretos", label: "Indiretos (gerais e subcontratos)" },
] as const;

export const PAGADORES = [
  { value: "seniors", label: "Seniors Care" },
  { value: "pht", label: "PHT" },
  { value: "ernesto", label: "Ernesto" },
] as const;

export function rotuloCentro(slug: string): string {
  return CENTROS_CUSTO.find((c) => c.value === slug)?.label ?? slug;
}
export function rotuloPagador(slug: string): string {
  return PAGADORES.find((p) => p.value === slug)?.label ?? slug;
}

export interface LinhaMesFC {
  mes: string;       // YYYY-MM
  total: number;     // desembolso do mês
  acumulado: number; // nominal
  corrigido: number; // acumulado corrigido pelo IPCA
}

/**
 * Série mensal do caixa: total, acumulado nominal e acumulado corrigido.
 * `lancamentos` = pares {data, valor}; `ipca` = mês → fração (0.0084).
 * Meses sem IPCA cadastrado corrigem por 0 (ficam nominais naquele mês).
 */
export function serieMensalFC(
  lancamentos: { data: string; valor: number }[],
  ipca: Map<string, number>,
): LinhaMesFC[] {
  const porMes = new Map<string, number>();
  for (const l of lancamentos) {
    const mes = l.data.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + l.valor);
  }
  const meses = [...porMes.keys()].sort();
  const out: LinhaMesFC[] = [];
  let acumulado = 0;
  let corrigido = 0;
  for (const mes of meses) {
    const total = porMes.get(mes)!;
    acumulado += total;
    corrigido = (corrigido + total) * (1 + (ipca.get(mes) ?? 0));
    out.push({ mes, total, acumulado, corrigido });
  }
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// Percentual digitado pelo usuário — INFLAÇÃO OU DEFLAÇÃO.
// O IPCA mensal pode ser negativo (agosto/2026 fechou em −0,32%). O campo
// precisa aceitar o sinal em todas as formas que aparecem na prática: hífen
// comum, o "menos" tipográfico (U+2212) que vem colado do site do IBGE, o
// sinal depois do número, e vírgula ou ponto como separador decimal.
// ───────────────────────────────────────────────────────────────────────────

export type PercentualLido =
  | { ok: true; pct: number; fracao: number }
  | { ok: false; erro: string };

/**
 * Lê um percentual digitado e devolve o valor em % e em fração.
 * `maximoAbsoluto` protege contra o erro clássico de digitar 32 no lugar de
 * 0,32 — que multiplicaria o acumulado por 1,32 e estragaria a série inteira.
 */
export function lerPercentual(texto: string, maximoAbsoluto = 10): PercentualLido {
  const bruto = (texto ?? "").trim();
  if (bruto === "") return { ok: false, erro: "Informe o índice do mês." };

  // Normaliza: menos tipográfico/travessão viram hífen; vírgula vira ponto;
  // sinal ao final ("0,32-") passa para a frente; remove espaços e "%".
  let t = bruto
    .replace(/[\u2212\u2012\u2013\u2014]/g, "-")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  if (/-$/.test(t)) t = "-" + t.slice(0, -1);
  t = t.replace(/^\+/, "");

  if (!/^-?\d*\.?\d+$/.test(t)) {
    return { ok: false, erro: 'Use apenas números, com vírgula decimal. Para deflação, comece com o sinal de menos (ex.: -0,32).' };
  }
  const pct = parseFloat(t);
  if (!Number.isFinite(pct)) return { ok: false, erro: "Índice inválido." };
  if (Math.abs(pct) > maximoAbsoluto) {
    return {
      ok: false,
      erro: `Índice fora do esperado (${pct.toString().replace(".", ",")}%). ` +
        `O limite aceito é ${maximoAbsoluto}% para mais ou para menos — confira se não faltou a vírgula.`,
    };
  }
  return { ok: true, pct, fracao: pct / 100 };
}

/** Formata uma fração (0.0084 / -0.0032) como percentual com sinal explícito. */
export function formatarPercentual(fracao: number): string {
  const pct = fracao * 100;
  const sinal = pct > 0 ? "+" : "";
  return `${sinal}${pct.toFixed(2).replace(".", ",")}%`;
}

/** Rótulo do efeito do índice no acumulado corrigido. */
export function efeitoIndice(fracao: number): "inflacao" | "deflacao" | "neutro" {
  if (fracao > 0) return "inflacao";
  if (fracao < 0) return "deflacao";
  return "neutro";
}

/** Formata 'YYYY-MM' como 'mmm/aa' (jan/26). */
export function mesCurto(mes: string): string {
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [ano, m] = mes.split("-");
  return `${nomes[parseInt(m, 10) - 1] ?? m}/${ano.slice(2)}`;
}
