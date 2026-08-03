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

/** Formata 'YYYY-MM' como 'mmm/aa' (jan/26). */
export function mesCurto(mes: string): string {
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [ano, m] = mes.split("-");
  return `${nomes[parseInt(m, 10) - 1] ?? m}/${ano.slice(2)}`;
}
