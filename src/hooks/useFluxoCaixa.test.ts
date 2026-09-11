import { describe, expect, it } from "vitest";
import { jaNoCaixaPelaPlanilha, pendentesDeSincronizacao } from "@/hooks/useFluxoCaixa";
import type { FcLancamento, ObraDisciplinaMarco, ObraNotaFiscal } from "@/types/database";

// ===========================================================================
// Sincronização módulo Obra → caixa: NUNCA contar duas vezes o que a planilha
// do sócio-diretor já trouxe. Caso real: agosto/2026.
// ===========================================================================

const base = { descricao: null, pagador: "seniors" as const, observacao: null, registrado_por: null, criado_em: "", ordem: 0 };
const linhaPlanilha = (over: Partial<FcLancamento>): FcLancamento => ({
  id: "l1", data: "2026-08-10", valor: -149580, grupo: "saida", centro_custo: "complementares",
  fornecedor: "Triade", origem: "planilha", origem_id: null, ...base, ...over,
});
const marco = (over: Partial<ObraDisciplinaMarco>): ObraDisciplinaMarco => ({
  id: "m1", disciplina_id: "d1", rotulo: "Entrada", valor: 10000, status: "Pago",
  data_pagamento: "2026-08-27", ...over,
} as ObraDisciplinaMarco);
const nf = (over: Partial<ObraNotaFiscal>): ObraNotaFiscal => ({
  id: "n1", numero: "13", valor: 149580, retencoes: 9199.17, data_emissao: "2026-08-20", arquivo_url: null,
  observacao: null, itens: [], status: "paga", comprovante_url: null, data_pagamento: "2026-08-25",
  pago_por: null, registrado_por: null, perfil_registrador: null, criado_em: "", ...over,
});
const vazio = { nomeDisciplina: new Map<string, string>(), medicoes: [], ocs: [], indiretos: [] };

describe("jaNoCaixaPelaPlanilha", () => {
  it("reconhece a linha 'Triade' da planilha no mês (qualquer grafia)", () => {
    expect(jaNoCaixaPelaPlanilha([linhaPlanilha({})], "2026-08")).toBe(true);
    expect(jaNoCaixaPelaPlanilha([linhaPlanilha({ fornecedor: "TRÍADE", origem: "manual" })], "2026-08")).toBe(true);
  });
  it("ignora outros meses e linhas que já vieram do módulo Obra", () => {
    expect(jaNoCaixaPelaPlanilha([linhaPlanilha({})], "2026-09")).toBe(false);
    expect(jaNoCaixaPelaPlanilha([linhaPlanilha({ origem: "nf", origem_id: "n1" })], "2026-08")).toBe(false);
  });
});

describe("pendentesDeSincronizacao — agosto/2026 real", () => {
  it("com a linha 'Triade' de 149.580 na planilha, a entrada da Terraplanagem (10.000) NÃO entra de novo", () => {
    const novos = pendentesDeSincronizacao({ existentes: [linhaPlanilha({})], marcos: [marco({})], notas: [], ...vazio });
    expect(novos).toEqual([]);
  });
  it("registrar a NF 13 como paga também não duplica: o dinheiro já está na linha da planilha", () => {
    const novos = pendentesDeSincronizacao({ existentes: [linhaPlanilha({})], marcos: [], notas: [nf({})], ...vazio });
    expect(novos).toEqual([]);
  });
  it("em mês SEM linha da planilha, a NF paga entra como líquido + retenções, ambos negativos", () => {
    const novos = pendentesDeSincronizacao({ existentes: [], marcos: [], notas: [nf({ data_pagamento: "2026-09-10" })], ...vazio });
    expect(novos).toHaveLength(2);
    expect(novos[0]).toMatchObject({ grupo: "saida", origem: "nf", fornecedor: "TRÍADE" });
    expect(novos[0].valor).toBeCloseTo(-140380.83, 2);
    expect(novos[1]).toMatchObject({ grupo: "saida", origem: "nf_retencao" });
    expect(novos[1].valor).toBeCloseTo(-9199.17, 2);
  });
  it("marco pago em mês sem planilha entra negativo, uma vez só", () => {
    const m = marco({ data_pagamento: "2026-09-05" });
    const novos = pendentesDeSincronizacao({ existentes: [], marcos: [m], notas: [], ...vazio });
    expect(novos).toHaveLength(1);
    expect(novos[0].valor).toBe(-10000);
    const jaTem = linhaPlanilha({ origem: "marco", origem_id: "m1", data: "2026-09-05", valor: -10000 });
    expect(pendentesDeSincronizacao({ existentes: [jaTem], marcos: [m], notas: [], ...vazio })).toEqual([]);
  });
});
