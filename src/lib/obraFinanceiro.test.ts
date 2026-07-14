import { describe, it, expect } from "vitest";
import { serieAcumuladaMensal, somaPorMes, custoM2, saldoOrcamentario, nivelPrazo } from "@/lib/obraFinanceiro";

describe("serieAcumuladaMensal", () => {
  it("agrupa por mês, ordena e acumula", () => {
    const r = serieAcumuladaMensal([
      { mes: "2026-02", valor: 100 },
      { mes: "2026-01", valor: 50 },
      { mes: "2026-02", valor: 25 },
      { mes: "2026-03", valor: 10 },
    ]);
    expect(r).toEqual([
      { mes: "2026-01", valor: 50, acumulado: 50 },
      { mes: "2026-02", valor: 125, acumulado: 175 },
      { mes: "2026-03", valor: 10, acumulado: 185 },
    ]);
  });
  it("vazio → série vazia", () => {
    expect(serieAcumuladaMensal([])).toEqual([]);
  });
});

describe("somaPorMes (fluxo mensal)", () => {
  it("soma por mês sem acumular", () => {
    expect(somaPorMes([
      { mes: "2026-01", valor: 30 },
      { mes: "2026-01", valor: 20 },
      { mes: "2026-02", valor: 15 },
    ])).toEqual([
      { mes: "2026-01", valor: 50 },
      { mes: "2026-02", valor: 15 },
    ]);
  });
});

describe("custoM2", () => {
  it("realizado ÷ área física", () => {
    expect(custoM2(500_000, 1_000)).toBe(500);
  });
  it("sem área concluída → 0 (evita divisão por zero)", () => {
    expect(custoM2(500_000, 0)).toBe(0);
  });
});

describe("saldoOrcamentario", () => {
  it("orçado − comprometido", () => {
    expect(saldoOrcamentario({ grupo: "mo", rotulo: "MO", orcado: 2_700_451.33, comprometido: 216_036.11, realizado: 0 }))
      .toBe(2_484_415.22);
  });
});

describe("nivelPrazo (semáforo)", () => {
  const hoje = "2026-06-01";
  it("vencido → crítico", () => expect(nivelPrazo("2026-05-20", hoje)).toBe("critico"));
  it("dentro da janela de atenção → atenção", () => expect(nivelPrazo("2026-06-10", hoje, 15)).toBe("atencao"));
  it("longe → ok", () => expect(nivelPrazo("2026-08-01", hoje, 15)).toBe("ok"));
  it("sem prazo → neutro", () => expect(nivelPrazo(null, hoje)).toBe("neutro"));
  it("documentos usam janela 30d", () => expect(nivelPrazo("2026-06-25", hoje, 30)).toBe("atencao"));
});
