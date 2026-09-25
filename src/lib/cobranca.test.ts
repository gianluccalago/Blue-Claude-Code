import { describe, expect, it } from "vitest";
import {
  contaComoInadimplente,
  ehPagamentoParcial,
  entraNoFaturamento,
  estaNoMes,
  estaVencidaNoMes,
  mensalidadeDoMes,
  proRataLigada,
  saldoDevedor,
  statusEfetivoCobranca,
  valorProRata,
  vencimentoEfetivo,
  type ResidenteRoster,
} from "@/lib/cobranca";
import type { PagamentoMensalidade } from "@/types/database";

const longa = (r: Partial<ResidenteRoster>): ResidenteRoster => ({
  modalidade: "longa_permanencia",
  status_hospede: "ativo",
  data_admissao: "2024-01-01",
  data_saida: null,
  ...r,
});

const pag = (p: Partial<PagamentoMensalidade>): PagamentoMensalidade =>
  ({
    id: "p1",
    residente_id: "r1",
    mes_referencia: "2026-09",
    valor: 1000,
    status: "em_aberto",
    pago_em: null,
    registrado_por: "Administração",
    criado_em: "2026-09-01T00:00:00Z",
    data_vencimento: null,
    forma_pagamento: null,
    valor_pago: null,
    data_pagamento: null,
    id_cobranca_externa: null,
    estorno_motivo: null,
    estornado_em: null,
    ...p,
  }) as PagamentoMensalidade;

describe("estaNoMes — roster do mês", () => {
  it("admitido no meio do mês aparece no mês (e não no anterior)", () => {
    const r = longa({ data_admissao: "2026-09-20" });
    expect(estaNoMes(r, "2026-09")).toBe(true);
    expect(estaNoMes(r, "2026-08")).toBe(false);
    expect(estaNoMes(r, "2026-10")).toBe(true);
  });
  it("saído no meio do mês ainda aparece no mês da saída", () => {
    const r = longa({ status_hospede: "inativo", data_saida: "2026-09-15" });
    expect(estaNoMes(r, "2026-09")).toBe(true);
    expect(estaNoMes(r, "2026-08")).toBe(true);
  });
  it("saído no mês anterior NÃO aparece", () => {
    const r = longa({ status_hospede: "inativo", data_saida: "2026-08-31" });
    expect(estaNoMes(r, "2026-09")).toBe(false);
    expect(estaNoMes(r, "2026-08")).toBe(true);
  });
  it("readmitido (ativo com nova data_admissao e data_saida antiga) aparece a partir da readmissão", () => {
    // O cadastro volta a "ativo"; se a data_saida antiga ficar no registro,
    // ela é ignorada para quem está ativo.
    const r = longa({ status_hospede: "ativo", data_admissao: "2026-09-05", data_saida: "2026-03-10" });
    expect(estaNoMes(r, "2026-09")).toBe(true);
    expect(estaNoMes(r, "2026-06")).toBe(false);
  });
  it("reativado por engano (data_saida apagada) volta a contar normalmente", () => {
    const r = longa({ status_hospede: "ativo", data_admissao: "2024-01-01", data_saida: null });
    expect(estaNoMes(r, "2026-06")).toBe(true);
  });
  it("sem data de admissão conta; day care nunca conta; inativo sem data de saída conta", () => {
    expect(estaNoMes(longa({ data_admissao: null }), "2026-09")).toBe(true);
    expect(estaNoMes(longa({ modalidade: "day_care" }), "2026-09")).toBe(false);
    expect(estaNoMes(longa({ status_hospede: "inativo", data_saida: null }), "2026-09")).toBe(true);
  });
});

describe("valorProRata", () => {
  it("entrada dia 20 num mês de 30 dias (setembro): 11 dias", () => {
    expect(valorProRata(3000, "2026-09-20", null, "2026-09")).toBe(1100);
  });
  it("entrada dia 20 num mês de 31 dias (outubro): 12 dias", () => {
    expect(valorProRata(3100, "2026-10-20", null, "2026-10")).toBe(1200);
  });
  it("saída dia 10: 10 dias", () => {
    expect(valorProRata(3000, "2020-01-01", "2026-09-10", "2026-09")).toBe(1000);
    expect(valorProRata(3100, "2020-01-01", "2026-10-10", "2026-10")).toBe(1000);
  });
  it("fevereiro bissexto (2028): 29 dias", () => {
    expect(valorProRata(2900, "2028-02-10", null, "2028-02")).toBe(2000);
    expect(valorProRata(2900, "2020-01-01", "2028-02-29", "2028-02")).toBe(2900);
  });
  it("fevereiro comum (2027): 28 dias", () => {
    expect(valorProRata(2800, "2027-02-15", null, "2027-02")).toBe(1400);
  });
  it("entrada e saída no mesmo mês: só o intervalo", () => {
    expect(valorProRata(3000, "2026-09-05", "2026-09-14", "2026-09")).toBe(1000);
  });
  it("entrada e saída fora do mês: mês cheio; sem admissão: cheio", () => {
    expect(valorProRata(3000, "2020-01-01", null, "2026-09")).toBe(3000);
    expect(valorProRata(3000, "2020-01-01", "2026-12-31", "2026-09")).toBe(3000);
    expect(valorProRata(3000, null, null, "2026-09")).toBe(3000);
  });
  it("entrada depois do mês ou saída antes dele: zero; arredonda a centavos", () => {
    expect(valorProRata(3000, "2026-10-01", null, "2026-09")).toBe(0);
    expect(valorProRata(3000, "2020-01-01", "2026-08-31", "2026-09")).toBe(0);
    expect(valorProRata(1000, "2026-09-30", null, "2026-09")).toBe(33.33);
    expect(valorProRata(0, "2026-09-30", null, "2026-09")).toBe(0);
  });
});

describe("mensalidadeDoMes e a chave prorata_mensalidade", () => {
  it("chave OFF (padrão): mês cheio mesmo entrando dia 20", () => {
    expect(proRataLigada(null)).toBe(false);
    expect(proRataLigada("off")).toBe(false);
    expect(proRataLigada("on")).toBe(true);
    expect(proRataLigada(" ON ")).toBe(true);
    expect(mensalidadeDoMes(3000, longa({ data_admissao: "2026-09-20" }), "2026-09", false)).toBe(3000);
  });
  it("chave ON: proporcional na entrada e na saída", () => {
    expect(mensalidadeDoMes(3000, longa({ data_admissao: "2026-09-20" }), "2026-09", true)).toBe(1100);
    expect(
      mensalidadeDoMes(3000, longa({ status_hospede: "inativo", data_saida: "2026-09-10" }), "2026-09", true),
    ).toBe(1000);
  });
  it("chave ON: readmitido ativo com data_saida antiga não é cortado", () => {
    const r = longa({ status_hospede: "ativo", data_admissao: "2024-01-01", data_saida: "2026-09-10" });
    expect(mensalidadeDoMes(3000, r, "2026-09", true)).toBe(3000);
  });
});

describe("inadimplência — regra única (FIN-02)", () => {
  const hoje = "2026-09-25";
  it("vencimento efetivo: a do registro, senão dia 10 do mês", () => {
    expect(vencimentoEfetivo(undefined, "2026-09")).toBe("2026-09-10");
    expect(vencimentoEfetivo(pag({ data_vencimento: "2026-09-05" }), "2026-09")).toBe("2026-09-05");
  });
  it("sem registro e dia 10 já passou: vencida; antes do dia 10: em aberto", () => {
    expect(estaVencidaNoMes(undefined, "2026-09", hoje)).toBe(true);
    expect(estaVencidaNoMes(undefined, "2026-09", "2026-09-10")).toBe(false);
    expect(statusEfetivoCobranca(undefined, "2026-09", hoje)).toBe("vencida");
    expect(statusEfetivoCobranca(undefined, "2026-09", "2026-09-03")).toBe("em_aberto");
  });
  it("em aberto/enviada com vencimento passado: vencida; futuro: mantém", () => {
    expect(estaVencidaNoMes(pag({ status: "enviada", data_vencimento: "2026-09-20" }), "2026-09", hoje)).toBe(true);
    expect(statusEfetivoCobranca(pag({ status: "enviada", data_vencimento: "2026-09-30" }), "2026-09", hoje)).toBe("enviada");
  });
  it("paga nunca é inadimplente; cancelada fica fora do faturamento e da inadimplência", () => {
    expect(estaVencidaNoMes(pag({ status: "paga" }), "2026-09", hoje)).toBe(false);
    expect(estaVencidaNoMes(pag({ status: "cancelada" }), "2026-09", hoje)).toBe(false);
    expect(entraNoFaturamento(pag({ status: "cancelada" }))).toBe(false);
    expect(entraNoFaturamento(pag({ status: "em_aberto" }))).toBe(true);
    expect(entraNoFaturamento(undefined)).toBe(true);
    expect(statusEfetivoCobranca(pag({ status: "cancelada" }), "2026-09", hoje)).toBe("cancelada");
  });
  it("estornada: status exibido é 'estornada', mas conta como inadimplente após o vencimento", () => {
    const p = pag({ status: "estornada", valor_pago: 1000, estorno_motivo: "duplicado" });
    expect(statusEfetivoCobranca(p, "2026-09", hoje)).toBe("estornada");
    expect(estaVencidaNoMes(p, "2026-09", hoje)).toBe(true);
    expect(estaVencidaNoMes(p, "2026-09", "2026-09-01")).toBe(false);
  });
  it("sem mês (ficha do hóspede): só o vencimento gravado conta", () => {
    expect(statusEfetivoCobranca(undefined, undefined, hoje)).toBe("em_aberto");
    expect(statusEfetivoCobranca(pag({ status: "em_aberto", data_vencimento: "2026-09-01" }), undefined, hoje)).toBe("vencida");
  });
  it("contaComoInadimplente: só linhas com valor a cobrar", () => {
    expect(contaComoInadimplente({ total: 1000, pagamento: undefined }, "2026-09", hoje)).toBe(true);
    expect(contaComoInadimplente({ total: 0, pagamento: undefined }, "2026-09", hoje)).toBe(false);
    expect(contaComoInadimplente({ total: 1000, pagamento: pag({ status: "paga" }) }, "2026-09", hoje)).toBe(false);
  });
});

describe("pagamento parcial e estorno", () => {
  it("valor pago parcial deixa saldo devedor", () => {
    const p = pag({ status: "enviada", valor_pago: 400 });
    expect(saldoDevedor(1000, p)).toBe(600);
    expect(ehPagamentoParcial(1000, p)).toBe(true);
  });
  it("paga com valor_pago menor que o total ainda mostra saldo; paga sem valor_pago (registro antigo) = quitada", () => {
    expect(saldoDevedor(1000, pag({ status: "paga", valor_pago: 999.5 }))).toBe(0.5);
    expect(saldoDevedor(1000, pag({ status: "paga", valor_pago: null }))).toBe(0);
    expect(saldoDevedor(1000, pag({ status: "paga", valor_pago: 1000 }))).toBe(0);
    expect(ehPagamentoParcial(1000, pag({ status: "paga", valor_pago: 1000 }))).toBe(false);
  });
  it("sem registro: deve tudo; cancelada: nada; estornada: volta a dever tudo sem apagar o pagamento", () => {
    expect(saldoDevedor(1000, undefined)).toBe(1000);
    expect(saldoDevedor(1000, pag({ status: "cancelada", valor_pago: 500 }))).toBe(0);
    const est = pag({ status: "estornada", valor_pago: 1000, data_pagamento: "2026-09-08", estorno_motivo: "pago em duplicidade" });
    expect(saldoDevedor(1000, est)).toBe(1000);
    expect(est.valor_pago).toBe(1000);
    expect(ehPagamentoParcial(1000, est)).toBe(false);
  });
});
