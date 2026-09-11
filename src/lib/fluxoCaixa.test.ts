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

// ───────────────────────────────────────────────────────────────────────────
// FONTE ÚNICA: a planilha do sócio-diretor dentro do app.
// ───────────────────────────────────────────────────────────────────────────
import { centroDoRotulo, serieCaixaMensal, valorComSinal, lerReais, apenasEmpreendimento, CENTROS_CUSTO } from "@/lib/fluxoCaixa";
import rotulos from "@/lib/__fixtures__/rotulos-extrato.json";

describe("centroDoRotulo — espelho da função SQL fc_centro_do_rotulo (0131)", () => {
  it("classifica os 256 rótulos reais da planilha exatamente como o banco", () => {
    const divergentes = (rotulos as { r: string; g: "entrada" | "saida"; c: string }[])
      .filter((x) => centroDoRotulo(x.r, x.g) !== x.c)
      .map((x) => `${x.r} → app:${centroDoRotulo(x.r, x.g)} sql:${x.c}`);
    expect(divergentes).toEqual([]);
  });
  it("todo centro devolvido existe na lista canônica", () => {
    const validos = new Set(CENTROS_CUSTO.map((c) => c.value));
    for (const x of rotulos as { r: string; g: "entrada" | "saida" }[]) {
      expect(validos.has(centroDoRotulo(x.r, x.g))).toBe(true);
    }
  });
  it("Humberto é o corretor do terreno (a CustoBlue chamava de Corretor)", () => {
    expect(centroDoRotulo("Humberto 90 de 90", "saida")).toBe("terreno");
  });
  it("TRÍADE vai para projetos complementares", () => {
    expect(centroDoRotulo("Triade", "saida")).toBe("complementares");
  });
});

describe("serieCaixaMensal — lógica da planilha (saldo inicial + entradas + saídas)", () => {
  const jul = [
    { data: "2026-07-05", valor: 242687.14, grupo: "entrada" as const, centro_custo: "receita_aluguel" },
    { data: "2026-07-28", valor: 629, grupo: "entrada" as const, centro_custo: "receita_financeira" },
    { data: "2026-07-25", valor: -234375, grupo: "entrada" as const, centro_custo: "socios" },
    { data: "2026-07-25", valor: 230000, grupo: "entrada" as const, centro_custo: "socios" },
    { data: "2026-07-10", valor: -557188.14, grupo: "saida" as const, centro_custo: "terreno" },
  ];
  it("julho/2026 fecha em 69.701 com o saldo inicial declarado de 387.948", () => {
    const [s] = serieCaixaMensal(jul, new Map([["2026-07", 387948]]));
    expect(s.entradas).toBeCloseTo(238941.14, 2);
    expect(s.saidas).toBeCloseTo(-557188.14, 2);
    expect(s.saldoFinal).toBeCloseTo(69701, 2);
  });
  it("agosto sem saldo declarado herda o saldo final de julho", () => {
    const ago = [{ data: "2026-08-10", valor: -1000, grupo: "saida" as const, centro_custo: "terreno" }];
    const serie = serieCaixaMensal([...jul, ...ago], new Map([["2026-07", 387948]]));
    expect(serie[1].mes).toBe("2026-08");
    expect(serie[1].saldoInicial).toBeCloseTo(69701, 2);
    expect(serie[1].saldoFinal).toBeCloseTo(68701, 2);
  });
  it("saldo declarado do mês prevalece sobre o carregado", () => {
    const ago = [{ data: "2026-08-10", valor: -1000, grupo: "saida" as const, centro_custo: "terreno" }];
    const serie = serieCaixaMensal([...jul, ...ago], new Map([["2026-07", 387948], ["2026-08", 70000]]));
    expect(serie[1].saldoInicial).toBe(70000);
  });
});

describe("valorComSinal / lerReais — convenção da planilha", () => {
  it("saída é sempre negativa; entrada fica como digitada (dividendo com menos)", () => {
    expect(valorComSinal("saida", 3500)).toBe(-3500);
    expect(valorComSinal("saida", -3500)).toBe(-3500);
    expect(valorComSinal("entrada", 50000)).toBe(50000);
    expect(valorComSinal("entrada", -234375)).toBe(-234375);
  });
  it("lê reais nos formatos que as pessoas digitam", () => {
    expect(lerReais("1.234,56")).toBe(1234.56);
    expect(lerReais("1234.56")).toBe(1234.56);
    expect(lerReais("-234.375")).toBe(-234.375); // ponto sem vírgula = decimal (como no JS)
    expect(lerReais("-234.375,00")).toBe(-234375);
    expect(lerReais("R$ 3.500,00")).toBe(3500);
    expect(lerReais("")).toBe(0);
  });
});

describe("apenasEmpreendimento + serieMensalFC — a correção IPCA ignora impostos, sócios e o Seniors Club", () => {
  it("só saídas de terreno/projetos/complementares/construtora/materiais/indiretos entram", () => {
    const ls = [
      { data: "2026-08-10", valor: -179618.64, grupo: "saida" as const, centro_custo: "terreno" },
      { data: "2026-08-10", valor: -149580, grupo: "saida" as const, centro_custo: "complementares" },
      { data: "2026-08-20", valor: -7281, grupo: "saida" as const, centro_custo: "impostos" },
      { data: "2026-08-12", valor: -2000, grupo: "saida" as const, centro_custo: "seniors_club" },
      { data: "2026-08-05", valor: 242687.14, grupo: "entrada" as const, centro_custo: "receita_aluguel" },
    ];
    const [s] = serieMensalFC(apenasEmpreendimento(ls), new Map([["2026-08", -0.0032]]));
    expect(s.total).toBeCloseTo(329198.64, 2);
    expect(s.corrigido).toBeCloseTo(329198.64 * (1 - 0.0032), 2);
  });
});
