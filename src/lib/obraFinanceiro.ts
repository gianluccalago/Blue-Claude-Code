import { arred } from "@/lib/obraCalc";

// ===========================================================================
// Módulo Obra — Fase 5: agregações financeiras PURAS (curva S, custo/m²,
// fluxo mensal). Testadas em obraFinanceiro.test.ts.
// ===========================================================================

export interface EventoMensal {
  mes: string; // 'AAAA-MM'
  valor: number;
}

export interface PontoSerie {
  mes: string;
  valor: number;
  acumulado: number;
}

/** Soma os eventos por mês e devolve a série ORDENADA com acumulado. */
export function serieAcumuladaMensal(eventos: EventoMensal[]): PontoSerie[] {
  const porMes = new Map<string, number>();
  for (const e of eventos) porMes.set(e.mes, (porMes.get(e.mes) ?? 0) + e.valor);
  const meses = [...porMes.keys()].sort();
  let acc = 0;
  return meses.map((mes) => {
    const valor = arred(porMes.get(mes) ?? 0);
    acc = arred(acc + valor);
    return { mes, valor, acumulado: acc };
  });
}

/** Soma simples por mês (sem acumular) — para o fluxo de caixa projetado. */
export function somaPorMes(eventos: EventoMensal[]): { mes: string; valor: number }[] {
  return serieAcumuladaMensal(eventos).map(({ mes, valor }) => ({ mes, valor }));
}

/** Custo por m² acumulado = realizado ÷ área física concluída (0 se sem área). */
export function custoM2(realizado: number, areaFisica: number): number {
  return areaFisica > 0 ? arred(realizado / areaFisica) : 0;
}

export interface LinhaResumo {
  grupo: string;
  rotulo: string;
  orcado: number;
  comprometido: number;
  realizado: number;
}

/** Saldo do pacote = orçado − comprometido (o que ainda pode ser contratado). */
export function saldoOrcamentario(l: LinhaResumo): number {
  return arred(l.orcado - l.comprometido);
}
