import { describe, expect, it } from "vitest";
import { serieMensalFC, mesCurto, lerPercentual, formatarPercentual } from "@/lib/fluxoCaixa";

describe("serieMensalFC", () => {
  it("reproduz a fórmula da planilha CustoBlue (primeiros meses reais)", () => {
    // fev/23: 150.000 (IPCA 0,84%) → 151.260; mar/23: +150.000 (0,71%) → 303.398,946
    const serie = serieMensalFC(
      [
        { data: "2023-02-10", valor: 150000 },
        { data: "2023-03-10", valor: 150000 },
      ],
      new Map([["2023-02", 0.0084], ["2023-03", 0.0071]]),
    );
    expect(serie[0].corrigido).toBeCloseTo(151260, 2);
    expect(serie[1].corrigido).toBeCloseTo(303398.946, 2);
    expect(serie[1].acumulado).toBe(300000);
  });

  it("soma lançamentos do mesmo mês antes de corrigir", () => {
    const serie = serieMensalFC(
      [
        { data: "2024-01-05", valor: 100 },
        { data: "2024-01-20", valor: 200 },
      ],
      new Map([["2024-01", 0.01]]),
    );
    expect(serie).toHaveLength(1);
    expect(serie[0].total).toBe(300);
    expect(serie[0].corrigido).toBeCloseTo(303, 5);
  });

  it("mês sem IPCA cadastrado corrige por zero", () => {
    const serie = serieMensalFC([{ data: "2026-08-03", valor: 1000 }], new Map());
    expect(serie[0].corrigido).toBe(1000);
  });
});

describe("mesCurto", () => {
  it("formata YYYY-MM", () => {
    expect(mesCurto("2026-01")).toBe("jan/26");
    expect(mesCurto("2023-12")).toBe("dez/23");
  });
});

describe("lerPercentual — deflação é um resultado válido", () => {
  it("aceita o sinal de menos nas formas que as pessoas digitam e colam", () => {
    for (const t of ["-0,32", "−0,32", " -0.32 ", "0,32-", "-0,32%"]) {
      const r = lerPercentual(t);
      expect(r.ok && r.pct).toBe(-0.32);
      expect(r.ok && r.fracao).toBeCloseTo(-0.0032, 10);
    }
  });
  it("aceita inflação com ou sem o sinal de mais", () => {
    expect(lerPercentual("0,44")).toMatchObject({ ok: true, pct: 0.44 });
    expect(lerPercentual("+0,44")).toMatchObject({ ok: true, pct: 0.44 });
  });
  it("aceita índice zero", () => {
    expect(lerPercentual("0")).toMatchObject({ ok: true, pct: 0, fracao: 0 });
  });
  it("barra o erro clássico de esquecer a vírgula (32 em vez de 0,32)", () => {
    const r = lerPercentual("32");
    expect(r.ok).toBe(false);
  });
  it("barra texto e campo vazio", () => {
    expect(lerPercentual("abc").ok).toBe(false);
    expect(lerPercentual("").ok).toBe(false);
  });
  it("permite limite maior para o IPCA ACUMULADO de uma fase", () => {
    expect(lerPercentual("18,7", 100)).toMatchObject({ ok: true, pct: 18.7 });
    expect(lerPercentual("-3,5", 100)).toMatchObject({ ok: true, pct: -3.5 });
  });
});

describe("formatarPercentual", () => {
  it("deixa o sinal explícito nos dois lados", () => {
    expect(formatarPercentual(-0.0032)).toBe("-0,32%");
    expect(formatarPercentual(0.0044)).toBe("+0,44%");
    expect(formatarPercentual(0)).toBe("0,00%");
  });
});

describe("serieMensalFC com deflação (caso real de agosto/2026)", () => {
  it("o acumulado corrigido DIMINUI no mês deflacionário", () => {
    // jul/26: +0,07% · ago/26: -0,32% (deflação) · set/26: sem índice
    const serie = serieMensalFC(
      [
        { data: "2026-07-10", valor: 284109 },
        { data: "2026-08-10", valor: 10000 },
      ],
      new Map([["2026-07", 0.0007], ["2026-08", -0.0032]]),
    );
    const [jul, ago] = serie;
    expect(jul.corrigido).toBeCloseTo(284109 * 1.0007, 2);
    // (corrigido de julho + 10.000) reduzido em 0,32%
    expect(ago.corrigido).toBeCloseTo((jul.corrigido + 10000) * (1 - 0.0032), 2);
    // O acumulado NOMINAL não se mexe com deflação — só o corrigido.
    expect(ago.acumulado).toBe(284109 + 10000);
    expect(ago.corrigido).toBeLessThan(jul.corrigido + 10000);
  });

  it("deflação seguida de inflação volta a subir", () => {
    const serie = serieMensalFC(
      [
        { data: "2026-08-05", valor: 1000 },
        { data: "2026-09-05", valor: 0.01 },
      ],
      new Map([["2026-08", -0.0032], ["2026-09", 0.005]]),
    );
    expect(serie[0].corrigido).toBeCloseTo(996.8, 2);
    expect(serie[1].corrigido).toBeGreaterThan(serie[0].corrigido);
  });
});
