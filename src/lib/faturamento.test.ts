import { describe, expect, it } from "vitest";
import { ehDiaDeJanela, proximaJanelaFaturamento } from "@/lib/faturamento";

describe("proximaJanelaFaturamento", () => {
  it("dia 1 é janela (inclusive)", () => {
    expect(proximaJanelaFaturamento("2026-08-01")).toBe("2026-08-01");
  });
  it("entre 2 e 11 cai no dia 11 do mesmo mês", () => {
    expect(proximaJanelaFaturamento("2026-08-02")).toBe("2026-08-11");
    expect(proximaJanelaFaturamento("2026-08-11")).toBe("2026-08-11");
  });
  it("depois do dia 11 vai para o dia 1 do mês seguinte", () => {
    expect(proximaJanelaFaturamento("2026-08-12")).toBe("2026-09-01");
    expect(proximaJanelaFaturamento("2026-08-31")).toBe("2026-09-01");
  });
  it("vira o ano em dezembro", () => {
    expect(proximaJanelaFaturamento("2026-12-15")).toBe("2027-01-01");
  });
});

describe("ehDiaDeJanela", () => {
  it("reconhece os dias 1 e 11", () => {
    expect(ehDiaDeJanela("2026-08-01")).toBe(true);
    expect(ehDiaDeJanela("2026-08-11")).toBe(true);
    expect(ehDiaDeJanela("2026-08-10")).toBe(false);
  });
});
