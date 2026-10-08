import { describe, expect, it } from "vitest";
import { acoesDisponiveis, codigoAvulso, resumoAvulsos, totalMedido, totalPrevisto, valorVigente } from "@/lib/orcamentoAvulso";

// Orçamento real da TRÍADE: tapume 48 m² × 99,45 + portão 6 m (CPU-01) 3.573,43.
const itens = [
  { quantidade_prevista: 48, preco_unitario: 99.45, quantidade_real: 46 },
  { quantidade_prevista: 1, preco_unitario: 3573.43, quantidade_real: null },
];

describe("orçamento avulso", () => {
  it("total previsto do orçamento do tapume e portão = R$ 8.347,03", () => {
    expect(totalPrevisto(itens)).toBe(8347.03);
  });
  it("total medido usa a quantidade real (46 m²) e a prevista onde não houve medição", () => {
    expect(totalMedido(itens)).toBe(8148.13);
  });
  it("valor vigente: real > aprovado > previsto", () => {
    expect(valorVigente({ valor_previsto: 10, valor_aprovado: null, valor_real: null })).toBe(10);
    expect(valorVigente({ valor_previsto: 10, valor_aprovado: 12, valor_real: null })).toBe(12);
    expect(valorVigente({ valor_previsto: 10, valor_aprovado: 12, valor_real: 11 })).toBe(11);
  });
  it("código OA-001", () => {
    expect(codigoAvulso(1)).toBe("OA-001");
    expect(codigoAvulso(27)).toBe("OA-027");
  });
  it("resumo: aguardando a Blue, aprovado a receber e pago", () => {
    const r = resumoAvulsos([
      { status: "enviado", valor_previsto: 1000, valor_aprovado: null, valor_real: null },
      { status: "aprovado", valor_previsto: 8347.03, valor_aprovado: 8347.03, valor_real: null },
      { status: "executado", valor_previsto: 500, valor_aprovado: 500, valor_real: null },
      { status: "pago", valor_previsto: 300, valor_aprovado: 300, valor_real: 280 },
      { status: "reprovado", valor_previsto: 9999, valor_aprovado: null, valor_real: null },
    ]);
    expect(r).toEqual({ aguardandoBlue: 2, emAnalise: 1000, aprovadoAReceber: 8847.03, pago: 280, comprometido: 9127.03 });
  });
  it("ações: construtora edita só rascunho/ajustes e não decide; Blue decide o enviado e paga o conferido", () => {
    expect(acoesDisponiveis("rascunho", "construtora")).toMatchObject({ editar: true, enviar: true, decidir: false, cancelar: true });
    expect(acoesDisponiveis("enviado", "construtora")).toMatchObject({ editar: false, decidir: false, cancelar: true, anexar: false });
    expect(acoesDisponiveis("enviado", "blue")).toMatchObject({ decidir: true });
    expect(acoesDisponiveis("aprovado", "construtora")).toMatchObject({ informarExecucao: true, cancelar: false, conferir: false });
    expect(acoesDisponiveis("conferido", "blue")).toMatchObject({ pagar: true });
    expect(acoesDisponiveis("pago", "blue")).toMatchObject({ desfazerPagamento: true, cancelar: false });
  });
});
