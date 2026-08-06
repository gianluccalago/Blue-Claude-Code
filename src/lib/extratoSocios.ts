// ===========================================================================
// EXTRATO DOS SÓCIOS (contas Seniors Care) — regras de cálculo.
// Fiel à planilha mensal do sócio-diretor: saldo inicial DECLARADO por mês,
// bloco de ENTRADAS/movimentações societárias (com sinal — dividendos pagos
// são negativos), bloco de SAÍDAS, e saldo final = inicial + Σ tudo (caixa
// TOTAL: banco + aplicações). SEMPRE regime de caixa.
// ===========================================================================

export interface LinhaExtrato {
  mes: string;                // 'YYYY-MM'
  ordem: number;
  grupo: "entrada" | "saida";
  rotulo: string;
  valor: number;              // com sinal, como na planilha
}

/** Assinatura FIXA do demonstrativo (sócio-diretor). */
export const SOCIO_ASSINATURA = {
  nome: "Ernesto Carlos Lagomarsino Inurrieta",
  cargo: "Sócio-Diretor",
  cpf: "771.273.310-49",
  empresa: "Seniors Care Ltda. · CNPJ 42.200.613/0001-85",
};

export interface ResumoMesExtrato {
  mes: string;
  saldoInicial: number;
  entradas: LinhaExtrato[];
  saidas: LinhaExtrato[];
  totalEntradas: number;      // líquido do bloco superior (pode ser negativo)
  totalSaidas: number;        // negativo
  saldoFinal: number;
}

/** Resumo de UM mês a partir do saldo declarado + lançamentos. */
export function resumoMesExtrato(
  mes: string,
  saldoInicial: number,
  linhas: LinhaExtrato[],
): ResumoMesExtrato {
  const doMes = linhas.filter((l) => l.mes === mes).sort((a, b) => a.ordem - b.ordem);
  const entradas = doMes.filter((l) => l.grupo === "entrada");
  const saidas = doMes.filter((l) => l.grupo === "saida");
  const totalEntradas = entradas.reduce((s, l) => s + l.valor, 0);
  const totalSaidas = saidas.reduce((s, l) => s + l.valor, 0);
  return {
    mes,
    saldoInicial,
    entradas,
    saidas,
    totalEntradas,
    totalSaidas,
    saldoFinal: saldoInicial + totalEntradas + totalSaidas,
  };
}

export interface ConsolidadoAno {
  ano: string;
  meses: ResumoMesExtrato[];                          // ordem cronológica
  saldoInicial: number;                               // do 1º mês com dados
  totalEntradas: number;
  totalSaidas: number;
  saldoFinal: number;                                 // do último mês
  porRubricaEntrada: { rotulo: string; valor: number }[]; // agregado, desc por |valor|
  porRubricaSaida: { rotulo: string; valor: number }[];
}

/** Normaliza rubricas para agregação anual (junta "parcela 36/44 terreno 2" etc.). */
export function rubricaBase(rotulo: string): string {
  const r = rotulo.trim();
  const min = r.toLowerCase();
  if (/^parcela .*terreno/.test(min)) return "Parcelas dos terrenos";
  if (min.startsWith("arquiteto")) return "Arquiteto (Bacoccini)";
  if (min.startsWith("humberto")) return "Humberto";
  return r.charAt(0).toUpperCase() + r.slice(1);
}

export function consolidarAno(
  ano: string,
  saldosPorMes: Map<string, number>,
  linhas: LinhaExtrato[],
): ConsolidadoAno | null {
  const mesesComDados = [...new Set(linhas.filter((l) => l.mes.startsWith(ano)).map((l) => l.mes))].sort();
  if (mesesComDados.length === 0) return null;
  const meses = mesesComDados.map((m) => resumoMesExtrato(m, saldosPorMes.get(m) ?? 0, linhas));

  const agg = (grupo: "entrada" | "saida") => {
    const mapa = new Map<string, number>();
    for (const l of linhas.filter((l) => l.mes.startsWith(ano) && l.grupo === grupo)) {
      const chave = rubricaBase(l.rotulo);
      mapa.set(chave, (mapa.get(chave) ?? 0) + l.valor);
    }
    return [...mapa.entries()]
      .map(([rotulo, valor]) => ({ rotulo, valor }))
      .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
  };

  return {
    ano,
    meses,
    saldoInicial: meses[0].saldoInicial,
    totalEntradas: meses.reduce((s, m) => s + m.totalEntradas, 0),
    totalSaidas: meses.reduce((s, m) => s + m.totalSaidas, 0),
    saldoFinal: meses[meses.length - 1].saldoFinal,
    porRubricaEntrada: agg("entrada"),
    porRubricaSaida: agg("saida"),
  };
}

const MESES_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function rotuloMesExtenso(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${MESES_PT[parseInt(m, 10) - 1] ?? m} de ${ano}`;
}
