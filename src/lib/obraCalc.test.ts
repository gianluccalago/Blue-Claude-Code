import { describe, it, expect } from "vitest";
import {
  precoM2Aplicado,
  calcularMedicao,
  saldoRetencao,
  calcularMultaBonusFase,
  diffDias,
} from "@/lib/obraCalc";

// Números do contrato TRÍADE (fonte da verdade dos casos de teste):
// preço MO R$ 914,66/m²; Fase 1 = Módulo 5 = 2.952,41 m² (preço fixo);
// retenção 5%; INSS 11%; ISS Curitiba 5%.
const PRECO = 914.66;
const AREA_F1 = 2952.41;
const VALOR_FASE_1 = 2_700_451.33; // arred(2952.41 × 914.66)

const ALIQUOTAS = [
  { chave: "inss", percentual: 11, ativa: true },
  { chave: "iss", percentual: 5, ativa: true },
  { chave: "irrf", percentual: 1.2, ativa: false },
  { chave: "csrf", percentual: 4.65, ativa: false },
];

describe("precoM2Aplicado", () => {
  it("Fase 1 é preço fixo (não reajusta)", () => {
    expect(precoM2Aplicado(PRECO, false, 10)).toBe(914.66);
  });
  it("Fase reajustável aplica IPCA acumulado", () => {
    expect(precoM2Aplicado(PRECO, true, 10)).toBe(1006.13); // 914,66 × 1,10
  });
  it("Reajustável sem IPCA informado = base", () => {
    expect(precoM2Aplicado(PRECO, true, null)).toBe(914.66);
  });
});

describe("calcularMedicao — Fundações (8%) na Fase 1", () => {
  const r = calcularMedicao({
    percentualMedido: 8,
    areaM2: AREA_F1,
    precoBase: PRECO,
    reajustavel: false,
    ipcaPct: null,
    retencaoPct: 5,
    aliquotas: ALIQUOTAS,
  });
  it("valor bruto = 8% × área × preço", () => expect(r.valorBruto).toBe(216_036.11));
  it("retenção contratual 5%", () => expect(r.retencaoValor).toBe(10_801.81));
  it("INSS 11%", () => expect(r.inssValor).toBe(23_763.97));
  it("ISS 5%", () => expect(r.issValor).toBe(10_801.81));
  it("sem outras retenções (IRRF/CSRF inativas)", () => expect(r.outrasValor).toBe(0));
  it("líquido a pagar", () => expect(r.valorLiquido).toBe(170_668.52));
  it("memória fecha (base − descontos = total)", () => {
    const base = r.memoria[0].valor;
    const descontos = r.memoria.filter((l) => l.sinal === "menos").reduce((s, l) => s + l.valor, 0);
    const total = r.memoria.find((l) => l.sinal === "total")!.valor;
    expect(Math.round((base - descontos - total) * 100) / 100).toBe(0);
  });
});

describe("calcularMedicao — fase inteira (100%) confere com o valor de contrato", () => {
  it("100% da Fase 1 = valor total da MO da fase", () => {
    const r = calcularMedicao({
      percentualMedido: 100,
      areaM2: AREA_F1,
      precoBase: PRECO,
      reajustavel: false,
      ipcaPct: null,
      retencaoPct: 5,
      aliquotas: ALIQUOTAS,
    });
    expect(r.valorBruto).toBe(VALOR_FASE_1);
  });
  it("IRRF/CSRF ativas entram em 'outras'", () => {
    const r = calcularMedicao({
      percentualMedido: 100,
      areaM2: AREA_F1,
      precoBase: PRECO,
      reajustavel: false,
      ipcaPct: null,
      retencaoPct: 5,
      aliquotas: [
        { chave: "inss", percentual: 11, ativa: true },
        { chave: "iss", percentual: 5, ativa: true },
        { chave: "irrf", percentual: 1.2, ativa: true },
        { chave: "csrf", percentual: 4.65, ativa: true },
      ],
    });
    // (1,2 + 4,65)% de 2.700.451,33 = 5,85% = 157.976,40
    expect(r.outrasValor).toBe(157_976.4);
  });
});

describe("saldoRetencao", () => {
  it("Σ retido − Σ liberado", () => {
    expect(
      saldoRetencao([
        { tipo: "retido", valor: 10_801.81 },
        { tipo: "retido", valor: 5_000 },
        { tipo: "liberado_trp", valor: 7_900.91 },
      ]),
    ).toBe(7_900.9);
  });
  it("fase quitada (TRP+TRD liberam tudo) → 0", () => {
    expect(
      saldoRetencao([
        { tipo: "retido", valor: 20_000 },
        { tipo: "liberado_trp", valor: 10_000 },
        { tipo: "liberado_trd", valor: 10_000 },
      ]),
    ).toBe(0);
  });
});

describe("diffDias", () => {
  it("conta dias civis inteiros", () => {
    expect(diffDias("2026-01-01", "2026-01-11")).toBe(10);
    expect(diffDias("2026-03-15", "2026-02-03")).toBe(-40);
  });
});

describe("calcularMultaBonusFase", () => {
  const base = {
    valorFase: VALOR_FASE_1,
    multaDiaPct: 0.05,
    multaTetoPct: 5,
    bonusPct: 1,
    bonusTetoPct: 2,
  };
  it("10 dias de atraso: 0,05%/dia", () => {
    const r = calcularMultaBonusFase({ ...base, dataPrevista: "2026-01-01", dataReal: "2026-01-11" });
    expect(r.diasAtraso).toBe(10);
    expect(r.multa).toBe(13_502.26); // 2.700.451,33 × 0,0005 × 10
    expect(r.bonus).toBe(0);
  });
  it("atraso enorme trava no teto de 5%", () => {
    const r = calcularMultaBonusFase({ ...base, dataPrevista: "2026-01-01", dataReal: "2026-07-20" });
    expect(r.multa).toBe(135_022.57); // 5% de 2.700.451,33
  });
  it("40 dias de antecipação: 1 período completo = 1%", () => {
    const r = calcularMultaBonusFase({ ...base, dataPrevista: "2026-03-15", dataReal: "2026-02-03" });
    expect(r.diasAntecipacao).toBe(40);
    expect(r.bonus).toBe(27_004.51); // 1% de 2.700.451,33
    expect(r.multa).toBe(0);
  });
  it("sem cronograma definido → tudo zero", () => {
    const r = calcularMultaBonusFase({ ...base, dataPrevista: null, dataReal: "2026-02-03" });
    expect(r).toEqual({ diasAtraso: 0, diasAntecipacao: 0, multa: 0, bonus: 0 });
  });
});
