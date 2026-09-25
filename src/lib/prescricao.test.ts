import { describe, expect, it } from "vitest";
import {
  dosesPorDiaDaPosologia,
  parsearQuantidade,
  POSOLOGIA_OPCOES,
  validarPeriodosPosologia,
  validarQuantidade,
} from "@/lib/prescricao";

// CLI-05: o app recusa salvar quando o nº de períodos marcados não bate com a
// frequência escrita. Não há horário padrão aqui — só contagem.
describe("posologia × períodos", () => {
  it("conta as administrações por dia das posologias do seletor", () => {
    expect(dosesPorDiaDaPosologia("1x/dia")).toBe(1);
    expect(dosesPorDiaDaPosologia("12/12h")).toBe(2);
    expect(dosesPorDiaDaPosologia("8/8h")).toBe(3);
    expect(dosesPorDiaDaPosologia("6/6h")).toBe(4);
    expect(dosesPorDiaDaPosologia("24/24h")).toBe(1);
    expect(dosesPorDiaDaPosologia("1x/dia em jejum")).toBe(1);
    expect(dosesPorDiaDaPosologia("1x/dia à noite")).toBe(1);
  });
  it("as pré-marcações do seletor são coerentes com a própria contagem", () => {
    for (const o of POSOLOGIA_OPCOES) {
      const esperado = dosesPorDiaDaPosologia(o.value);
      if (esperado !== null) expect(o.periodos.length, o.value).toBe(esperado);
    }
  });
  it("entende texto livre da admissão com variações de escrita", () => {
    expect(dosesPorDiaDaPosologia("2x ao dia")).toBe(2);
    expect(dosesPorDiaDaPosologia("3 x por dia")).toBe(3);
    expect(dosesPorDiaDaPosologia("de 8 em 8 horas")).toBe(3);
    expect(dosesPorDiaDaPosologia("12 / 12 H")).toBe(2);
  });
  it("não valida posologia livre, condicional ou não reconhecida", () => {
    expect(dosesPorDiaDaPosologia("Personalizado")).toBeNull();
    expect(dosesPorDiaDaPosologia("")).toBeNull();
    expect(dosesPorDiaDaPosologia(null)).toBeNull();
    expect(dosesPorDiaDaPosologia("se necessário")).toBeNull();
    expect(dosesPorDiaDaPosologia("1x/dia se necessário")).toBeNull();
    expect(dosesPorDiaDaPosologia("SOS")).toBeNull();
    expect(dosesPorDiaDaPosologia("S/N")).toBeNull();
    expect(dosesPorDiaDaPosologia("dias alternados")).toBeNull();
    expect(dosesPorDiaDaPosologia("8/12h")).toBeNull(); // intervalo mal escrito
    expect(dosesPorDiaDaPosologia("5/5h")).toBeNull(); // 24 não é múltiplo
  });
  it("recusa contagem incompatível e explica; aceita a compatível", () => {
    expect(validarPeriodosPosologia("8/8h", 2)).toMatch(/8\/8h.*3 períodos.*2 períodos marcados/);
    expect(validarPeriodosPosologia("6/6h", 3)).toMatch(/4 períodos/);
    expect(validarPeriodosPosologia("1x/dia", 2)).toMatch(/1 período por dia/);
    expect(validarPeriodosPosologia("12/12h", 1)).toMatch(/há 1 período marcado/);
    expect(validarPeriodosPosologia("8/8h", 3)).toBeNull();
    expect(validarPeriodosPosologia("6/6h", 4)).toBeNull();
    expect(validarPeriodosPosologia("12/12h", 2)).toBeNull();
    expect(validarPeriodosPosologia("1x/dia", 1)).toBeNull();
  });
  it("posologia livre nunca bloqueia", () => {
    expect(validarPeriodosPosologia("Personalizado", 5)).toBeNull();
    expect(validarPeriodosPosologia("se necessário", 0)).toBeNull();
    expect(validarPeriodosPosologia("", 3)).toBeNull();
  });
});

// CLI-13: quantidade obrigatória e numérica positiva por período.
describe("quantidade por administração", () => {
  it("aceita inteiro, decimal com vírgula ou ponto, fração e misto", () => {
    expect(parsearQuantidade("1 comprimido")).toEqual({ numero: 1, unidade: "comprimido" });
    expect(parsearQuantidade("1/2")).toEqual({ numero: 0.5, unidade: "" });
    expect(parsearQuantidade("1/2 comprimido")).toEqual({ numero: 0.5, unidade: "comprimido" });
    expect(parsearQuantidade("0,5")).toEqual({ numero: 0.5, unidade: "" });
    expect(parsearQuantidade("0.5 ml")).toEqual({ numero: 0.5, unidade: "ml" });
    expect(parsearQuantidade("1 1/2 cp")).toEqual({ numero: 1.5, unidade: "cp" });
    expect(parsearQuantidade("20 UI")).toEqual({ numero: 20, unidade: "UI" });
    expect(parsearQuantidade("  10 gotas  ")).toEqual({ numero: 10, unidade: "gotas" });
  });
  it("recusa vazio, zero, negativo, sem número e denominador zero", () => {
    expect(parsearQuantidade("")).toBeNull();
    expect(parsearQuantidade("   ")).toBeNull();
    expect(parsearQuantidade(null)).toBeNull();
    expect(parsearQuantidade("0")).toBeNull();
    expect(parsearQuantidade("0,0 ml")).toBeNull();
    expect(parsearQuantidade("-1")).toBeNull();
    expect(parsearQuantidade("um comprimido")).toBeNull();
    expect(parsearQuantidade("comprimido 1")).toBeNull();
    expect(parsearQuantidade("1/0")).toBeNull();
  });
  it("validarQuantidade explica o problema e nomeia o período", () => {
    expect(validarQuantidade("", "Manhã")).toBe("Informe a quantidade (Manhã).");
    expect(validarQuantidade("abc", "Noite")).toMatch(/Quantidade inválida \(Noite\)/);
    expect(validarQuantidade("1/2 comprimido")).toBeNull();
    expect(validarQuantidade("0,5")).toBeNull();
  });
});
