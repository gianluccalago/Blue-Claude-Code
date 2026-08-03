import { describe, expect, it } from "vitest";
import { serieMensalFC, mesCurto } from "@/lib/fluxoCaixa";

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
