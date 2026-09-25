import { describe, expect, it } from "vitest";
import { intervaloMeses, mesCurto } from "@/lib/fluxoCaixa";
import { hojeISO, dataISO, formatarDataBR, calcularIdade } from "@/lib/utils";

// Viradas de dia, mês e ano; bissexto; fuso operacional fixo em São Paulo.
describe("datas — viradas e fuso", () => {
  it("hojeISO tem o formato YYYY-MM-DD e bate com dataISO(agora)", () => {
    expect(hojeISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dataISO(new Date())).toBe(hojeISO());
  });
  it("dataISO usa o fuso de São Paulo: 23h30 UTC de 31/12 ainda é 31/12 em SP", () => {
    expect(dataISO(new Date("2026-12-31T23:30:00Z"))).toBe("2026-12-31");
    // 02:30 UTC de 01/01 é 23:30 de 31/12 em SP (UTC-3)
    expect(dataISO(new Date("2027-01-01T02:30:00Z"))).toBe("2026-12-31");
    expect(dataISO(new Date("2027-01-01T03:00:00Z"))).toBe("2027-01-01");
  });
  it("intervaloMeses atravessa o ano e trata bissexto como qualquer mês", () => {
    expect(intervaloMeses("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
    expect(intervaloMeses("2028-02", "2028-02")).toEqual(["2028-02"]);
    expect(mesCurto("2028-02")).toBe("fev/28");
  });
  it("formatarDataBR não escorrega um dia em datas puras", () => {
    expect(formatarDataBR("2026-03-01")).toBe("01/03/2026");
    expect(formatarDataBR("2028-02-29")).toBe("29/02/2028");
  });
  it("calcularIdade respeita o aniversário (nascido em 29/02)", () => {
    const idade = calcularIdade("1940-02-29");
    expect(typeof idade).toBe("number");
    expect(idade).toBeGreaterThanOrEqual(86);
  });
});
