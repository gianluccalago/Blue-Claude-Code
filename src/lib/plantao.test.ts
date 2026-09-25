import { describe, expect, it } from "vitest";
import {
  diaAnterior,
  instanteNoPlantao,
  janelaDoPlantao,
  pendenciasMedicacaoAbertas,
  plantaoDoInstante,
  registroPorPeriodo,
  registrosDoPlantaoAnterior,
  rotuloPlantao,
  statusTarefaNoPlantao,
} from "@/lib/plantao";
import type { Administracao } from "@/types/database";

// Instantes escritos em horário de São Paulo (UTC−3, sem horário de verão).
const sp = (data: string, hhmm: string) => new Date(`${data}T${hhmm}:00-03:00`);
const iso = (data: string, hhmm: string) => sp(data, hhmm).toISOString();

// Turnos como a escala grava (instantes ISO/UTC).
const NOTURNO_24 = { inicio: iso("2026-09-24", "19:00"), fim: iso("2026-09-25", "07:00") };
const DIURNO_25 = { inicio: iso("2026-09-25", "07:00"), fim: iso("2026-09-25", "19:00") };

describe("janelaDoPlantao", () => {
  it("noturno 19h–07h: às 20h, 00h30 e 06h50 a janela e a data do plantão são as mesmas", () => {
    for (const agora of [sp("2026-09-24", "20:00"), sp("2026-09-25", "00:30"), sp("2026-09-25", "06:50")]) {
      const j = janelaDoPlantao(NOTURNO_24, agora);
      expect(j.dataPlantao).toBe("2026-09-24");
      // tolerância de 10 min nas duas pontas (a mesma do check-in)
      expect(j.inicio.toISOString()).toBe(iso("2026-09-24", "18:50"));
      expect(j.fim.toISOString()).toBe(iso("2026-09-25", "07:10"));
    }
  });
  it("diurno 07h–19h: data do plantão é o próprio dia", () => {
    const j = janelaDoPlantao(DIURNO_25, sp("2026-09-25", "10:00"));
    expect(j.dataPlantao).toBe("2026-09-25");
    expect(j.inicio.toISOString()).toBe(iso("2026-09-25", "06:50"));
    expect(j.fim.toISOString()).toBe(iso("2026-09-25", "19:10"));
  });
  it("sem turno: o dia civil de São Paulo (00:00 a 00:00 do dia seguinte)", () => {
    // 01:30 de 25/09 em SP é 04:30Z — o dia civil ainda é 25/09.
    const j = janelaDoPlantao(null, sp("2026-09-25", "01:30"));
    expect(j.dataPlantao).toBe("2026-09-25");
    expect(j.inicio.toISOString()).toBe(iso("2026-09-25", "00:00"));
    expect(j.fim.toISOString()).toBe(iso("2026-09-26", "00:00"));
    // 23:30 de 25/09 em SP é 02:30Z de 26/09 — continua 25/09.
    expect(janelaDoPlantao(null, sp("2026-09-25", "23:30")).dataPlantao).toBe("2026-09-25");
  });
  it("virada de mês: noturno de 30/09 às 02h de 01/10 continua sendo o plantão de 30/09", () => {
    const turno = { inicio: iso("2026-09-30", "19:00"), fim: iso("2026-10-01", "07:00") };
    const j = janelaDoPlantao(turno, sp("2026-10-01", "02:00"));
    expect(j.dataPlantao).toBe("2026-09-30");
    expect(j.fim.toISOString()).toBe(iso("2026-10-01", "07:10"));
  });
  it("virada de ano: noturno de 31/12 às 00h30 de 01/01 continua sendo o plantão de 31/12", () => {
    const turno = { inicio: iso("2026-12-31", "19:00"), fim: iso("2027-01-01", "07:00") };
    const j = janelaDoPlantao(turno, sp("2027-01-01", "00:30"));
    expect(j.dataPlantao).toBe("2026-12-31");
    expect(j.inicio.toISOString()).toBe(iso("2026-12-31", "18:50"));
    // sem turno na virada do ano: dia civil de SP
    expect(janelaDoPlantao(null, sp("2027-01-01", "00:30")).dataPlantao).toBe("2027-01-01");
    expect(diaAnterior("2027-01-01")).toBe("2026-12-31");
    expect(diaAnterior("2026-10-01")).toBe("2026-09-30");
  });
});

describe("instanteNoPlantao — horário HH:MM no eixo do plantão", () => {
  it("no noturno de 24/09, '06:00' é 25/09 06:00 e '20:00' é 24/09 20:00", () => {
    const j = janelaDoPlantao(NOTURNO_24, sp("2026-09-24", "20:00"));
    expect(instanteNoPlantao("06:00", j)?.toISOString()).toBe(iso("2026-09-25", "06:00"));
    expect(instanteNoPlantao("20:00", j)?.toISOString()).toBe(iso("2026-09-24", "20:00"));
    expect(instanteNoPlantao(null, j)).toBeNull();
    expect(instanteNoPlantao("x", j)).toBeNull();
  });
  it("no diurno ou sem turno, o horário cai no próprio dia", () => {
    const j = janelaDoPlantao(null, sp("2026-09-25", "10:00"));
    expect(instanteNoPlantao("08:00", j)?.toISOString()).toBe(iso("2026-09-25", "08:00"));
  });
});

// ─── Medicação: "uma dose já registrada pode aparecer de novo como pendente?" ─

function adm(p: Partial<Administracao> & { periodo: string; administrado_em: string }): Administracao {
  return {
    id: p.id ?? `id-${p.periodo}-${p.administrado_em}`,
    residente_id: p.residente_id ?? "a0000000-0000-0000-0000-000000000001",
    periodo: p.periodo,
    status: p.status ?? "sim",
    itens_faltantes: null,
    administrado_por: "Ana Paula",
    administrado_em: p.administrado_em,
    prescricao_id: null,
    baixa_farmacia: false,
    motivo: p.motivo ?? null,
  };
}

describe("registroPorPeriodo — status por período na janela do plantão", () => {
  const doseNoite = adm({ periodo: "noite", status: "sim", administrado_em: iso("2026-09-24", "20:00") });
  const doseJejumOntem = adm({ periodo: "jejum", status: "sim", administrado_em: iso("2026-09-24", "06:10") });

  it("dose da Noite registrada às 20h continua 'registrada' às 00h30 e às 06h50 do mesmo plantão", () => {
    for (const agora of [sp("2026-09-25", "00:30"), sp("2026-09-25", "06:50")]) {
      const j = janelaDoPlantao(NOTURNO_24, agora);
      const mapa = registroPorPeriodo([doseNoite, doseJejumOntem], j);
      expect(mapa.noite?.id).toBe(doseNoite.id);
      expect(mapa.noite?.status).toBe("sim");
      // o jejum de 24/09 06:10 é do plantão ANTERIOR: não conta neste
      expect(mapa.jejum).toBeUndefined();
    }
  });
  it("no plantão seguinte (diurno das 07h) a dose da Noite não aparece — nem registrada nem pendente", () => {
    const j = janelaDoPlantao(DIURNO_25, sp("2026-09-25", "07:30"));
    const mapa = registroPorPeriodo([doseNoite], j);
    expect(mapa.noite).toBeUndefined();
    expect(Object.keys(mapa)).toHaveLength(0);
    // ...mas fica disponível para LEITURA na passagem de plantão
    expect(registrosDoPlantaoAnterior([doseNoite], j).noite?.id).toBe(doseNoite.id);
  });
  it("prevalece o registro mais recente do período, independentemente da ordem recebida", () => {
    const nao = adm({ id: "nao", periodo: "noite", status: "nao", administrado_em: iso("2026-09-24", "20:00") });
    const sim = adm({ id: "sim", periodo: "noite", status: "sim", administrado_em: iso("2026-09-24", "20:40") });
    const j = janelaDoPlantao(NOTURNO_24, sp("2026-09-25", "00:30"));
    expect(registroPorPeriodo([nao, sim], j).noite?.id).toBe("sim");
    expect(registroPorPeriodo([sim, nao], j).noite?.id).toBe("sim");
  });
  it("sem turno, vale o dia civil: a dose de ontem à noite não é 'de hoje'", () => {
    const j = janelaDoPlantao(null, sp("2026-09-25", "00:30"));
    expect(registroPorPeriodo([doseNoite], j).noite).toBeUndefined();
  });
});

// ─── Checklist: atraso no eixo do plantão ────────────────────────────────────

describe("statusTarefaNoPlantao", () => {
  const tarefa06 = { horario: "06:00", tolerancia_minutos: 30 };
  const tarefa21 = { horario: "21:00", tolerancia_minutos: 15 };

  it("tarefa das 06h do noturno NÃO está em atraso às 19h, 00h30 nem 06h20; atrasa depois de 06h30 do dia seguinte", () => {
    const j = janelaDoPlantao(NOTURNO_24, sp("2026-09-24", "20:00"));
    expect(statusTarefaNoPlantao(tarefa06, false, j, sp("2026-09-24", "19:05")).key).toBe("normal");
    expect(statusTarefaNoPlantao(tarefa06, false, j, sp("2026-09-25", "00:30")).key).toBe("normal");
    expect(statusTarefaNoPlantao(tarefa06, false, j, sp("2026-09-25", "05:35")).key).toBe("em_breve");
    expect(statusTarefaNoPlantao(tarefa06, false, j, sp("2026-09-25", "06:20")).key).toBe("em_breve");
    expect(statusTarefaNoPlantao(tarefa06, false, j, sp("2026-09-25", "06:30")).key).toBe("em_breve");
    expect(statusTarefaNoPlantao(tarefa06, false, j, sp("2026-09-25", "06:31")).key).toBe("atraso");
    expect(statusTarefaNoPlantao(tarefa06, true, j, sp("2026-09-25", "06:50")).key).toBe("feito");
  });
  it("tarefa das 21h do noturno atrasa após 21h15 e segue em atraso depois da meia-noite", () => {
    const j = janelaDoPlantao(NOTURNO_24, sp("2026-09-24", "20:00"));
    expect(statusTarefaNoPlantao(tarefa21, false, j, sp("2026-09-24", "20:45")).key).toBe("em_breve");
    expect(statusTarefaNoPlantao(tarefa21, false, j, sp("2026-09-24", "21:16")).key).toBe("atraso");
    expect(statusTarefaNoPlantao(tarefa21, false, j, sp("2026-09-25", "00:30")).key).toBe("atraso");
  });
  it("sem turno, comporta-se como antes (minutos do dia civil)", () => {
    const j = janelaDoPlantao(null, sp("2026-09-25", "10:00"));
    const t = { horario: "08:00", tolerancia_minutos: 30 };
    expect(statusTarefaNoPlantao(t, false, j, sp("2026-09-25", "07:00")).key).toBe("normal");
    expect(statusTarefaNoPlantao(t, false, j, sp("2026-09-25", "07:35")).key).toBe("em_breve");
    expect(statusTarefaNoPlantao(t, false, j, sp("2026-09-25", "08:31")).key).toBe("atraso");
    expect(statusTarefaNoPlantao({ horario: null, tolerancia_minutos: 0 }, false, j).key).toBe("normal");
  });
});

// ─── Coordenação: pendências não somem à meia-noite e fecham com "sim" posterior ─

describe("plantaoDoInstante / rotuloPlantao", () => {
  it("madrugada pertence ao noturno da véspera; 07h–19h é diurno", () => {
    expect(plantaoDoInstante(iso("2026-09-25", "00:30"))).toEqual({ dataPlantao: "2026-09-24", tag: "noturno" });
    expect(plantaoDoInstante(iso("2026-09-24", "20:00"))).toEqual({ dataPlantao: "2026-09-24", tag: "noturno" });
    expect(plantaoDoInstante(iso("2026-09-25", "06:10"))).toEqual({ dataPlantao: "2026-09-24", tag: "noturno" });
    expect(plantaoDoInstante(iso("2026-09-25", "07:00"))).toEqual({ dataPlantao: "2026-09-25", tag: "diurno" });
    expect(plantaoDoInstante(iso("2026-09-25", "18:59"))).toEqual({ dataPlantao: "2026-09-25", tag: "diurno" });
    expect(rotuloPlantao(iso("2026-09-25", "00:30"))).toBe("Plantão noturno de 24/09");
    expect(rotuloPlantao(iso("2027-01-01", "02:00"))).toBe("Plantão noturno de 31/12");
  });
});

describe("pendenciasMedicacaoAbertas", () => {
  const recusa20h = adm({ id: "recusa", periodo: "noite", status: "nao", motivo: "Recusou", administrado_em: iso("2026-09-24", "20:00") });

  it("recusa das 20h continua aberta depois da meia-noite quando não houve 'sim' posterior", () => {
    expect(pendenciasMedicacaoAbertas([recusa20h]).map((r) => r.id)).toEqual(["recusa"]);
  });
  it("fecha quando há 'sim' posterior do mesmo residente e período no mesmo plantão (mesmo após a meia-noite)", () => {
    const sim = adm({ id: "sim", periodo: "noite", status: "sim", administrado_em: iso("2026-09-25", "00:20") });
    expect(pendenciasMedicacaoAbertas([sim, recusa20h])).toEqual([]);
  });
  it("NÃO fecha com 'sim' de outro período, de outro residente, anterior à recusa ou de outro plantão", () => {
    const outroPeriodo = adm({ id: "a", periodo: "jejum", status: "sim", administrado_em: iso("2026-09-25", "06:00") });
    const outroResidente = adm({ id: "b", periodo: "noite", status: "sim", residente_id: "outro", administrado_em: iso("2026-09-24", "21:00") });
    const anterior = adm({ id: "c", periodo: "noite", status: "sim", administrado_em: iso("2026-09-24", "19:30") });
    const outroPlantao = adm({ id: "d", periodo: "noite", status: "sim", administrado_em: iso("2026-09-25", "19:30") });
    const abertas = pendenciasMedicacaoAbertas([outroPlantao, outroPeriodo, outroResidente, anterior, recusa20h]);
    expect(abertas.map((r) => r.id)).toEqual(["recusa"]);
  });
  it("'sim' nunca é pendência; parcial é pendência até um 'sim' posterior", () => {
    const parcial = adm({ id: "p", periodo: "manha", status: "parcial", administrado_em: iso("2026-09-25", "08:00") });
    const sim = adm({ id: "s", periodo: "manha", status: "sim", administrado_em: iso("2026-09-25", "08:30") });
    expect(pendenciasMedicacaoAbertas([parcial]).map((r) => r.id)).toEqual(["p"]);
    expect(pendenciasMedicacaoAbertas([sim, parcial])).toEqual([]);
  });
});
