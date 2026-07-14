import { describe, it, expect } from "vitest";
import { ultimaVerificacaoPorEtapa, percentualEtapa, etapaConcluida, avancoFisico } from "@/lib/obra";
import type { ObraChecklistExecucao, ObraEtapa } from "@/types/database";

function registro(etapa_id: string, percentual: number, registrado_em: string): ObraChecklistExecucao {
  return {
    id: `${etapa_id}-${registrado_em}`, etapa_id, concluido: percentual >= 100, percentual,
    foto_url: null, observacao: null, registrado_por: "x", perfil_registrador: "master", registrado_em,
  };
}
function etapa(id: string, peso_pct: number): ObraEtapa {
  return { id, fase_id: "f", ordem: 1, nome: id, descricao: null, peso_pct, depende_de: null, criado_em: "" };
}

describe("ultimaVerificacaoPorEtapa + percentualEtapa", () => {
  it("usa o registro MAIS RECENTE por etapa", () => {
    const m = ultimaVerificacaoPorEtapa([
      registro("a", 30, "2026-01-01T10:00:00Z"),
      registro("a", 70, "2026-02-01T10:00:00Z"),
      registro("b", 50, "2026-01-15T10:00:00Z"),
    ]);
    expect(percentualEtapa("a", m)).toBe(70);
    expect(percentualEtapa("b", m)).toBe(50);
    expect(percentualEtapa("inexistente", m)).toBe(0);
  });
});

describe("etapaConcluida (medível no BM só a 100%)", () => {
  const m = ultimaVerificacaoPorEtapa([registro("a", 100, "t"), registro("b", 99, "t")]);
  it("100% → concluída", () => expect(etapaConcluida("a", m)).toBe(true));
  it("99% → não concluída", () => expect(etapaConcluida("b", m)).toBe(false));
});

describe("avancoFisico (peso ponderado pelo %)", () => {
  it("Estrutura 22% a 50% + Fundações 8% a 100% = 11 + 8 = 19", () => {
    const etapas = [etapa("estrutura", 22), etapa("fundacoes", 8)];
    const m = ultimaVerificacaoPorEtapa([registro("estrutura", 50, "t"), registro("fundacoes", 100, "t")]);
    expect(avancoFisico(etapas, m)).toBe(19);
  });
  it("tudo a 100% = soma dos pesos", () => {
    const etapas = [etapa("a", 40), etapa("b", 60)];
    const m = ultimaVerificacaoPorEtapa([registro("a", 100, "t"), registro("b", 100, "t")]);
    expect(avancoFisico(etapas, m)).toBe(100);
  });
  it("etapa sem registro conta 0", () => {
    expect(avancoFisico([etapa("a", 50)], new Map())).toBe(0);
  });
});
