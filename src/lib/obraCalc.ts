// ===========================================================================
// Módulo Obra — cálculos financeiros PUROS (sem I/O). Testados em
// obraCalc.test.ts com os números do contrato TRÍADE. Toda a UI e as RPCs de
// pagamento consomem estes números; nada aqui depende de rede/estado.
// ===========================================================================

/** Arredonda para 2 casas (centavos), evitando drift de ponto flutuante. */
export function arred(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Preço/m² aplicado: fixo na Fase 1; Fases 2–4 reajustadas por IPCA acumulado.
 * O índice PODE ser negativo (período com deflação) — o reajuste vira redutor,
 * que é o comportamento correto. Só um fator <= 0 (IPCA <= -100%) é impossível;
 * nesse caso mantemos o preço-base, porque zerar/inverter o contrato seria pior
 * do que ignorar um dado claramente corrompido.
 */
export function precoM2Aplicado(precoBase: number, reajustavel: boolean, ipcaPct: number | null): number {
  if (!reajustavel || ipcaPct == null) return arred(precoBase);
  const fator = 1 + ipcaPct / 100;
  if (!Number.isFinite(fator) || fator <= 0) return arred(precoBase);
  return arred(precoBase * fator);
}

export interface AliquotaInput {
  chave: string; // 'inss' | 'iss' | 'irrf' | 'csrf'
  percentual: number;
  ativa: boolean;
}

export interface LinhaMemoria {
  rotulo: string;
  valor: number;
  sinal: "base" | "menos" | "total";
}

export interface ResultadoMedicao {
  precoM2Aplicado: number;
  valorBruto: number;
  retencaoValor: number;
  inssValor: number;
  issValor: number;
  outrasValor: number;
  valorLiquido: number;
  memoria: LinhaMemoria[];
}

/**
 * Valor de uma medição e sua memória de cálculo:
 *   bruto  = (% medido) × área × preço/m² reajustado
 *   líquido = bruto − retenção contratual − INSS − ISS − (IRRF/CSRF ativas)
 */
export function calcularMedicao(args: {
  percentualMedido: number;
  areaM2: number;
  precoBase: number;
  reajustavel: boolean;
  ipcaPct: number | null;
  retencaoPct: number;
  aliquotas: AliquotaInput[];
}): ResultadoMedicao {
  const preco = precoM2Aplicado(args.precoBase, args.reajustavel, args.ipcaPct);
  const valorBruto = arred((args.percentualMedido / 100) * args.areaM2 * preco);

  const pct = (chave: string) => {
    const a = args.aliquotas.find((x) => x.chave === chave);
    return a && a.ativa ? a.percentual : 0;
  };
  const retencaoValor = arred(valorBruto * (args.retencaoPct / 100));
  const inssPct = pct("inss");
  const issPct = pct("iss");
  const inssValor = arred(valorBruto * (inssPct / 100));
  const issValor = arred(valorBruto * (issPct / 100));
  // IRRF/CSRF e quaisquer outras ativas entram como "outras retenções".
  const outrasValor = arred(
    args.aliquotas
      .filter((a) => a.ativa && a.chave !== "inss" && a.chave !== "iss")
      .reduce((s, a) => s + valorBruto * (a.percentual / 100), 0),
  );
  const valorLiquido = arred(valorBruto - retencaoValor - inssValor - issValor - outrasValor);

  const memoria: LinhaMemoria[] = [
    { rotulo: "Valor bruto da medição", valor: valorBruto, sinal: "base" },
    { rotulo: `Retenção contratual ${args.retencaoPct}%`, valor: retencaoValor, sinal: "menos" },
    { rotulo: `INSS ${inssPct}%`, valor: inssValor, sinal: "menos" },
    { rotulo: `ISS ${issPct}%`, valor: issValor, sinal: "menos" },
  ];
  if (outrasValor > 0) memoria.push({ rotulo: "Outras retenções (IRRF/CSRF)", valor: outrasValor, sinal: "menos" });
  memoria.push({ rotulo: "Líquido a pagar", valor: valorLiquido, sinal: "total" });

  return { precoM2Aplicado: preco, valorBruto, retencaoValor, inssValor, issValor, outrasValor, valorLiquido, memoria };
}

/** Saldo de retenção em mãos do Contratante = Σ retido − Σ liberado. */
export function saldoRetencao(eventos: { tipo: "retido" | "liberado_trp" | "liberado_trd"; valor: number }[]): number {
  return arred(eventos.reduce((s, e) => s + (e.tipo === "retido" ? e.valor : -e.valor), 0));
}

/** Dias inteiros entre duas datas ISO (b − a). */
export function diffDias(aISO: string, bISO: string): number {
  const a = new Date(`${aISO}T00:00:00`);
  const b = new Date(`${bISO}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Soma dias a uma data ISO, devolvendo ISO (AAAA-MM-DD). null se base ausente. */
export function somarDiasISO(baseISO: string | null, dias: number | null): string | null {
  if (!baseISO || dias == null) return null;
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Perda de material por categoria vs tolerância, e proposta de GLOSA:
 *   perda = consumo real − previsto; a glosa é o que passa da tolerância,
 *   valorado pelo preço médio unitário. Perdas dentro da tolerância → glosa 0.
 */
export function calcularGlosaMaterial(args: {
  previsto: number;
  consumido: number;
  toleranciaPct: number;
  precoMedio: number;
}): { perdaPct: number; glosaQtd: number; glosaValor: number; excede: boolean } {
  if (args.previsto <= 0) return { perdaPct: 0, glosaQtd: 0, glosaValor: 0, excede: false };
  const perdaPct = arred(((args.consumido - args.previsto) / args.previsto) * 100);
  const limite = args.previsto * (1 + args.toleranciaPct / 100);
  const glosaQtd = arred(Math.max(0, args.consumido - limite));
  const glosaValor = arred(glosaQtd * args.precoMedio);
  return { perdaPct, glosaQtd, glosaValor, excede: glosaQtd > 0 };
}

export type ClasseABC = "A" | "B" | "C";

/** Curva ABC: A até 80% do valor acumulado, B até 95%, C o restante. */
export function curvaABC<T extends { valor: number }>(
  items: T[],
): (T & { classe: ClasseABC; acumuladoPct: number })[] {
  const total = items.reduce((s, i) => s + i.valor, 0);
  const ordenados = [...items].sort((a, b) => b.valor - a.valor);
  let cum = 0;
  return ordenados.map((it) => {
    cum += it.valor;
    const pct = total > 0 ? (cum / total) * 100 : 0;
    const classe: ClasseABC = pct <= 80 ? "A" : pct <= 95 ? "B" : "C";
    return { ...it, classe, acumuladoPct: arred(pct) };
  });
}

/**
 * Multa de atraso de uma DISCIPLINA de projeto: 0,15%/dia de atraso sobre o
 * valor da disciplina, teto 10%. dataReal = conclusão (ou "hoje" se em curso).
 * Sem data prevista/real → zero.
 */
export function calcularMultaDisciplina(args: {
  valorDisciplina: number;
  dataPrevista: string | null;
  dataReal: string | null;
  multaDiaPct: number;
  tetoPct: number;
}): { diasAtraso: number; multa: number } {
  if (!args.dataPrevista || !args.dataReal) return { diasAtraso: 0, multa: 0 };
  const diasAtraso = Math.max(0, diffDias(args.dataPrevista, args.dataReal));
  const bruta = args.valorDisciplina * (args.multaDiaPct / 100) * diasAtraso;
  const teto = args.valorDisciplina * (args.tetoPct / 100);
  return { diasAtraso, multa: arred(Math.min(bruta, teto)) };
}

export interface MultaBonusFase {
  diasAtraso: number;
  diasAntecipacao: number;
  multa: number;
  bonus: number;
}

/**
 * Multa/bônus de fase contra o cronograma:
 *   multa = 0,05%/dia de atraso sobre o valor da fase, teto 5%.
 *   bônus = 1% por 30 dias COMPLETOS de antecipação, teto 2%.
 * dataReal = TRP (conclusão efetiva). Sem uma das datas → tudo zero.
 */
export function calcularMultaBonusFase(args: {
  valorFase: number;
  dataPrevista: string | null;
  dataReal: string | null;
  multaDiaPct: number;
  multaTetoPct: number;
  bonusPct: number;
  bonusTetoPct: number;
}): MultaBonusFase {
  if (!args.dataPrevista || !args.dataReal) {
    return { diasAtraso: 0, diasAntecipacao: 0, multa: 0, bonus: 0 };
  }
  const delta = diffDias(args.dataPrevista, args.dataReal); // >0 atraso, <0 antecipação
  const diasAtraso = Math.max(0, delta);
  const diasAntecipacao = Math.max(0, -delta);

  const multaBruta = args.valorFase * (args.multaDiaPct / 100) * diasAtraso;
  const multaTeto = args.valorFase * (args.multaTetoPct / 100);
  const multa = arred(Math.min(multaBruta, multaTeto));

  const periodos = Math.floor(diasAntecipacao / 30);
  const bonusBruto = args.valorFase * (args.bonusPct / 100) * periodos;
  const bonusTeto = args.valorFase * (args.bonusTetoPct / 100);
  const bonus = arred(Math.min(bonusBruto, bonusTeto));

  return { diasAtraso, diasAntecipacao, multa, bonus };
}
