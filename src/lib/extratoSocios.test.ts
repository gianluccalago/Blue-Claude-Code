import { describe, expect, it } from "vitest";
import { consolidarAno, resumoMesExtrato, rubricaBase, type LinhaExtrato } from "@/lib/extratoSocios";

// Fixture REAL: julho/2026 da planilha do sócio-diretor (verbatim).
const JUL26: LinhaExtrato[] = [
  { mes: "2026-07", ordem: 1, grupo: "entrada", rotulo: "aluguel", valor: 242687.14 },
  { mes: "2026-07", ordem: 2, grupo: "entrada", rotulo: "rendimento aplicações", valor: 629 },
  { mes: "2026-07", ordem: 3, grupo: "entrada", rotulo: "pagto dividendos Ernesto", valor: -234375 },
  { mes: "2026-07", ordem: 4, grupo: "entrada", rotulo: "emprestimo Ernesto", valor: 230000 },
  { mes: "2026-07", ordem: 5, grupo: "saida", rotulo: "parcela 36/44 terreno 2", valor: -78439.12 },
  { mes: "2026-07", ordem: 6, grupo: "saida", rotulo: "parcela 3/50 terreno 4", valor: -54096 },
  { mes: "2026-07", ordem: 7, grupo: "saida", rotulo: "parcela 32/36 terreno 3", valor: -47083.52 },
  { mes: "2026-07", ordem: 8, grupo: "saida", rotulo: "contabilidade", valor: -400 },
  { mes: "2026-07", ordem: 9, grupo: "saida", rotulo: "Tarifas bancárias / rendimentos", valor: -84 },
  { mes: "2026-07", ordem: 10, grupo: "saida", rotulo: "motores", valor: -187000 },
  { mes: "2026-07", ordem: 11, grupo: "saida", rotulo: "ITBI", valor: -76140 },
  { mes: "2026-07", ordem: 12, grupo: "saida", rotulo: "corte árvores", valor: -11000 },
  { mes: "2026-07", ordem: 13, grupo: "saida", rotulo: "Edvaldo", valor: -2350 },
  { mes: "2026-07", ordem: 14, grupo: "saida", rotulo: "Arquiteto 31/36 e5/16", valor: -4692.5 },
  { mes: "2026-07", ordem: 15, grupo: "saida", rotulo: "IRPJ", valor: -57148 },
  { mes: "2026-07", ordem: 16, grupo: "saida", rotulo: "CSLL", valor: -19589 },
  { mes: "2026-07", ordem: 17, grupo: "saida", rotulo: "IR retido na fonte", valor: -308 },
  { mes: "2026-07", ordem: 18, grupo: "saida", rotulo: "Humberto 90 de 90", valor: -10000 },
  { mes: "2026-07", ordem: 19, grupo: "saida", rotulo: "PIS", valor: -1577 },
  { mes: "2026-07", ordem: 20, grupo: "saida", rotulo: "COFINS", valor: -7281 },
];

describe("resumoMesExtrato — julho/2026 real bate com a planilha", () => {
  const r = resumoMesExtrato("2026-07", 387948, JUL26);
  it("entradas líquidas = 238.941,14 (planilha: 626.889,14 − 387.948)", () => {
    expect(r.totalEntradas).toBeCloseTo(238941.14, 2);
    expect(r.saldoInicial + r.totalEntradas).toBeCloseTo(626889.14, 2);
  });
  it("saídas = −557.188,14 (subtotal da planilha)", () => {
    expect(r.totalSaidas).toBeCloseTo(-557188.14, 2);
  });
  it("saldo final = 69.701 (planilha: 'saldo banco final')", () => {
    expect(r.saldoFinal).toBeCloseTo(69701, 2);
  });
});

describe("consolidarAno", () => {
  it("agrega rubricas e propaga saldos", () => {
    const c = consolidarAno("2026", new Map([["2026-07", 387948]]), JUL26)!;
    expect(c.saldoInicial).toBe(387948);
    expect(c.saldoFinal).toBeCloseTo(69701, 2);
    const terrenos = c.porRubricaSaida.find((r) => r.rotulo === "Parcelas dos terrenos");
    expect(terrenos?.valor).toBeCloseTo(-179618.64, 2);
  });
});

describe("rubricaBase", () => {
  it("normaliza parcelas de terreno e arquiteto", () => {
    expect(rubricaBase("parcela 36/44 terreno 2")).toBe("Parcelas dos terrenos");
    expect(rubricaBase("Arquiteto 31/36 e5/16")).toBe("Arquiteto (Bacoccini)");
    expect(rubricaBase("aluguel")).toBe("Aluguel");
  });
});
