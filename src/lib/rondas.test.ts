import { describe, expect, it } from "vitest";
import { blocosDoTurno, checklistCompleto, checklistInicial, contaNoHorario, pedeRevisao, resumoChecklist, situacaoRonda } from "@/lib/rondas";

const sp = (data: string, hhmm: string) => new Date(`${data}T${hhmm}:00-03:00`);
const cfg = { intervalo_min: 120, tolerancia_min: 30 };
const inicio = sp("2026-09-29", "19:00");
const fim = sp("2026-09-30", "07:00");

describe("checklist", () => {
  it("começa com pele 'sem alteração' e intercorrência 'não'; só posição, fralda e estado exigem toque", () => {
    const c = checklistInicial();
    expect(c).toMatchObject({ pele: "sem_alteracao", intercorrencia: "nao", observacoes: [] });
    expect(checklistCompleto(c)).toBe(false);
    expect(checklistCompleto({ ...c, posicao: "dorsal", fralda: "seca", estado: "dormindo" })).toBe(true);
  });
});

describe("situacaoRonda", () => {
  it("sem ronda no turno: conta do início; vencendo 15 min antes; atrasada após intervalo + tolerância", () => {
    expect(situacaoRonda(cfg, null, inicio, sp("2026-09-29", "20:30")).situacao).toBe("em_dia");
    expect(situacaoRonda(cfg, null, inicio, sp("2026-09-29", "20:45")).situacao).toBe("vencendo");
    expect(situacaoRonda(cfg, null, inicio, sp("2026-09-29", "21:30")).situacao).toBe("vencendo");
    expect(situacaoRonda(cfg, null, inicio, sp("2026-09-29", "21:31")).situacao).toBe("atrasada");
  });
  it("conta da última ronda; ronda de ontem não vale como base", () => {
    const r = situacaoRonda(cfg, sp("2026-09-29", "23:10"), inicio, sp("2026-09-30", "00:30"));
    expect([r.situacao, r.proximaEm.toISOString()]).toEqual(["em_dia", sp("2026-09-30", "01:10").toISOString()]);
    expect(situacaoRonda(cfg, sp("2026-09-28", "23:00"), inicio, sp("2026-09-29", "19:30")).situacao).toBe("em_dia");
  });
});

describe("blocosDoTurno", () => {
  it("12 h / 2 h = 6 blocos; ronda dentro do bloco ou até 30 min depois cumpre", () => {
    const rondas = [sp("2026-09-29", "20:00"), sp("2026-09-29", "23:20"), sp("2026-09-30", "01:10"), sp("2026-09-30", "03:05"), sp("2026-09-30", "05:30")];
    const r = blocosDoTurno(cfg, inicio, fim, rondas, sp("2026-09-30", "08:00"));
    // 19–21 ok (20:00) · 21–23 ok (23:20 ≤ 23:30) · 23–01 ok (01:10 ≤ 01:30) · 01–03 ok (03:05) · 03–05 ok (05:30) · 05–07 ok (05:30)
    expect(r.blocos).toHaveLength(6);
    expect([r.cumpridos, r.encerrados, r.pct]).toEqual([6, 6, 100]);
  });
  it("bloco sem ronda é descumprido; bloco ainda aberto não entra na conta", () => {
    const r = blocosDoTurno(cfg, inicio, fim, [sp("2026-09-29", "20:00")], sp("2026-09-29", "23:40"));
    expect(r.blocos.map((b) => b.estado)).toEqual(["cumprido", "descumprido", "em_andamento"]);
    expect(r.pct).toBe(50);
  });
});

describe("resumoChecklist", () => {
  it("segue a ordem dos campos e ignora as observações", () => {
    expect(resumoChecklist({ intercorrencia: "nao", fralda: "trocada", posicao: "dorsal", estado: "dormindo", pele: "sem_alteracao", observacoes: ["Tosse"] }))
      .toBe("Barriga para cima · Trocada · Dormindo · Sem alteração · Não");
  });
});

describe("leituras", () => {
  it("sincronizada tarde não conta no horário; recusada ou sinalizada pede revisão até ser revisada", () => {
    expect(contaNoHorario({ status_validacao: "valida", sincronizado_tarde: false })).toBe(true);
    expect(contaNoHorario({ status_validacao: "valida", sincronizado_tarde: true })).toBe(false);
    // Suspeita de forjada não conta até o supervisor revisar.
    expect(contaNoHorario({ status_validacao: "valida", sincronizado_tarde: false, flags: ["possivel_forjada"], revisada_em: null })).toBe(false);
    expect(contaNoHorario({ status_validacao: "valida", sincronizado_tarde: false, flags: ["possivel_forjada"], revisada_em: "2026-09-30T10:00:00Z" })).toBe(true);
    expect(pedeRevisao({ status_validacao: "rejeitada_contador_repetido", flags: [], revisada_em: null })).toBe(true);
    expect(pedeRevisao({ status_validacao: "valida", flags: [], revisada_em: null })).toBe(false);
    expect(pedeRevisao({ status_validacao: "valida", flags: ["plausibilidade"], revisada_em: null })).toBe(true);
    expect(pedeRevisao({ status_validacao: "valida", flags: ["plausibilidade"], revisada_em: "2026-09-30T10:00:00Z" })).toBe(false);
    // Salto de contador e fora do plantão ficam só no registro.
    expect(pedeRevisao({ status_validacao: "valida", flags: ["leituras_nao_registradas"], revisada_em: null })).toBe(false);
    expect(pedeRevisao({ status_validacao: "valida", flags: ["sem_plantao", "leituras_nao_registradas"], revisada_em: null })).toBe(false);
    expect(pedeRevisao({ status_validacao: "valida", flags: ["leituras_nao_registradas", "uid_nao_confirmado"], revisada_em: null })).toBe(true);
  });
});
