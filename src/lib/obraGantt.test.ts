import { describe, expect, it } from "vitest";
import {
  janelaGantt,
  posPct,
  larguraPct,
  mesesDaJanela,
  somarDias,
  statusBarraFase,
  statusBarraDisciplina,
} from "@/lib/obraGantt";

const HOJE = "2026-07-15";

describe("janelaGantt", () => {
  it("vai do 1º dia do mês da menor data ao 1º dia do mês seguinte à maior", () => {
    const j = janelaGantt(["2026-03-10", "2026-11-20"], HOJE);
    expect(j.min).toBe("2026-03-01");
    expect(j.max).toBe("2026-12-01");
  });

  it("inclui hoje mesmo quando as datas são passadas", () => {
    const j = janelaGantt(["2025-01-05", "2025-02-10"], HOJE);
    expect(j.min).toBe("2025-01-01");
    expect(j.max >= "2026-08-01").toBe(true);
  });

  it("sem datas, abre uma janela a partir do mês de hoje", () => {
    const j = janelaGantt([], HOJE);
    expect(j.min).toBe("2026-07-01");
    expect(j.totalDias).toBeGreaterThanOrEqual(180);
  });

  it("garante janela mínima de ~6 meses", () => {
    const j = janelaGantt(["2026-07-10", "2026-07-20"], HOJE);
    expect(j.totalDias).toBeGreaterThanOrEqual(180);
  });
});

describe("posPct / larguraPct", () => {
  const j = janelaGantt(["2026-01-01", "2026-12-31"], "2026-06-01");
  it("início da janela = 0%, e posições crescem", () => {
    expect(posPct(j.min, j)).toBe(0);
    expect(posPct("2026-07-01", j)).toBeGreaterThan(posPct("2026-03-01", j));
  });
  it("clampa fora da janela", () => {
    expect(posPct("2020-01-01", j)).toBe(0);
    expect(posPct("2030-01-01", j)).toBe(100);
  });
  it("largura = diferença de posições (nunca negativa)", () => {
    expect(larguraPct("2026-03-01", "2026-05-01", j)).toBeCloseTo(
      posPct("2026-05-01", j) - posPct("2026-03-01", j),
      5,
    );
    expect(larguraPct("2026-05-01", "2026-03-01", j)).toBe(0);
  });
});

describe("mesesDaJanela", () => {
  it("lista o 1º dia de cada mês da janela", () => {
    const j = janelaGantt(["2026-01-15", "2026-06-10"], "2026-03-01");
    const meses = mesesDaJanela(j);
    expect(meses[0]).toBe("2026-01-01");
    expect(meses).toContain("2026-06-01");
    expect(meses.every((m) => m.endsWith("-01"))).toBe(true);
  });
});

describe("somarDias", () => {
  it("soma atravessando mês e ano", () => {
    expect(somarDias("2026-12-30", 5)).toBe("2027-01-04");
  });
});

describe("statusBarraFase", () => {
  it("TRP/TRD = concluída", () => {
    expect(statusBarraFase({ status: "trp_emitido", data_fim_prevista: null }, HOJE)).toBe("concluida");
    expect(statusBarraFase({ status: "trd_emitido", data_fim_prevista: "2026-01-01" }, HOJE)).toBe("concluida");
  });
  it("em andamento com fim vencido = atrasada; no prazo = andamento", () => {
    expect(statusBarraFase({ status: "em_andamento", data_fim_prevista: "2026-07-01" }, HOJE)).toBe("atrasada");
    expect(statusBarraFase({ status: "em_andamento", data_fim_prevista: "2026-09-01" }, HOJE)).toBe("andamento");
    expect(statusBarraFase({ status: "em_andamento", data_fim_prevista: null }, HOJE)).toBe("andamento");
  });
  it("não iniciada = prevista", () => {
    expect(statusBarraFase({ status: "nao_iniciada", data_fim_prevista: null }, HOJE)).toBe("prevista");
  });
});

describe("statusBarraDisciplina", () => {
  it("progresso 100 = concluída (mesmo com prazo vencido)", () => {
    expect(statusBarraDisciplina({ progresso_pct: 100, data_base: "2026-01-01", prazo_dias: 30 }, HOJE)).toBe("concluida");
    expect(statusBarraDisciplina({ progresso_pct: 100, data_base: null, prazo_dias: null }, HOJE)).toBe("concluida");
  });
  it("progresso < 100 nunca é concluída — prazo vencido = atrasada", () => {
    expect(statusBarraDisciplina({ progresso_pct: 50, data_base: "2026-01-01", prazo_dias: 30 }, HOJE)).toBe("atrasada");
    expect(statusBarraDisciplina({ progresso_pct: 99, data_base: "2026-01-01", prazo_dias: 30 }, HOJE)).toBe("atrasada");
  });
  it("dentro do prazo = andamento; sem data-base = prevista", () => {
    expect(statusBarraDisciplina({ progresso_pct: 10, data_base: "2026-07-01", prazo_dias: 90 }, HOJE)).toBe("andamento");
    expect(statusBarraDisciplina({ progresso_pct: 0, data_base: null, prazo_dias: 60 }, HOJE)).toBe("prevista");
  });
});
