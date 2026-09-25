import { describe, expect, it } from "vitest";
import {
  duracaoHorasTurno,
  escolherTurnoAtivo,
  mensagemErroTurno,
  sobrepoe,
  tagPelasHoras,
  turnoNoHorario,
  validarHorariosTurno,
} from "@/lib/turnos";

// Fuso da casa: America/Sao_Paulo (UTC−3, sem horário de verão).
const sp = (data: string, hora: string) => new Date(`${data}T${hora}:00-03:00`).toISOString();
const t = (inicio: string, fim: string, extra: Partial<{ check_in: string | null; check_out: string | null }> = {}) => ({
  inicio,
  fim,
  check_in: null,
  check_out: null,
  ...extra,
});

describe("sobrepoe — colisão por instante, não por texto (ESC-01)", () => {
  it("detecta sobreposição parcial", () => {
    expect(sobrepoe(t(sp("2026-09-10", "07:00"), sp("2026-09-10", "19:00")), t(sp("2026-09-10", "12:00"), sp("2026-09-10", "20:00")))).toBe(true);
  });
  it("turnos encostados (19:00 → 19:00) não colidem", () => {
    expect(sobrepoe(t(sp("2026-09-10", "07:00"), sp("2026-09-10", "19:00")), t(sp("2026-09-10", "19:00"), sp("2026-09-11", "07:00")))).toBe(false);
  });
  it("compara instantes mesmo com formatos ISO diferentes (offset × Z)", () => {
    // Mesmo instante escrito de dois jeitos: "2026-09-10T07:00:00-03:00" e "2026-09-10T10:00:00.000Z".
    const a = t("2026-09-10T07:00:00-03:00", "2026-09-10T19:00:00-03:00");
    const b = t("2026-09-10T22:00:00.000Z", "2026-09-11T10:00:00.000Z"); // 19:00 → 07:00 SP
    expect(sobrepoe(a, b)).toBe(false);
    // Comparando como texto, "2026-09-10T22..." < "2026-09-10T19..." seria falso e "2026-09-10T07" < "2026-09-11T10" verdadeiro — daria colisão errada num caso e deixaria passar noutro.
    const c = t("2026-09-10T21:00:00.000Z", "2026-09-11T09:00:00.000Z"); // 18:00 → 06:00 SP: colide com a
    expect(sobrepoe(a, c)).toBe(true);
  });
  it("noturno que cruza a meia-noite colide com o diurno seguinte que começa antes de ele acabar", () => {
    const noturno = t(sp("2026-09-10", "19:00"), sp("2026-09-11", "07:00"));
    expect(sobrepoe(noturno, t(sp("2026-09-11", "06:00"), sp("2026-09-11", "18:00")))).toBe(true);
    expect(sobrepoe(noturno, t(sp("2026-09-11", "07:00"), sp("2026-09-11", "19:00")))).toBe(false);
  });
});

describe("validarHorariosTurno — fim antes do início (ESC-02)", () => {
  it("aceita 07:00 → 19:00", () => expect(validarHorariosTurno("07:00", "19:00", false)).toBeNull());
  it("recusa fim igual ao início", () => expect(validarHorariosTurno("07:00", "07:00", false)).not.toBeNull());
  it("recusa 19:00 → 07:00 sem marcar dia seguinte e sugere a opção", () => {
    expect(validarHorariosTurno("19:00", "07:00", false)).toMatch(/dia seguinte/);
  });
  it("aceita 19:00 → 07:00 no dia seguinte", () => expect(validarHorariosTurno("19:00", "07:00", true)).toBeNull());
  it("recusa mais de 24h (07:00 → 08:00 do dia seguinte)", () => {
    expect(validarHorariosTurno("07:00", "08:00", true)).toMatch(/24 horas/);
  });
  it("recusa campo vazio", () => expect(validarHorariosTurno("", "19:00", false)).not.toBeNull());
});

describe("tagPelasHoras — diurno/noturno pelo ponto médio (escala 07–19)", () => {
  it("07–19 é diurno; 19–07(+1) é noturno", () => {
    expect(tagPelasHoras("07:00", "19:00", false)).toBe("diurno");
    expect(tagPelasHoras("19:00", "07:00", true)).toBe("noturno");
  });
  it("turnos fora do padrão seguem o ponto médio", () => {
    expect(tagPelasHoras("06:00", "18:00", false)).toBe("diurno");
    expect(tagPelasHoras("13:00", "01:00", true)).toBe("noturno");
    expect(tagPelasHoras("22:00", "06:00", true)).toBe("noturno");
    expect(tagPelasHoras("08:00", "14:00", false)).toBe("diurno");
  });
});

describe("turno ativo — noturno atravessando a meia-noite", () => {
  const noturnoOntem = t(sp("2026-09-10", "19:00"), sp("2026-09-11", "07:00"));
  const diurnoHoje = t(sp("2026-09-11", "07:00"), sp("2026-09-11", "19:00"));

  it("00h30 ainda é o turno de ontem 19h", () => {
    const agora = Date.parse(sp("2026-09-11", "00:30"));
    expect(turnoNoHorario(noturnoOntem, agora)).toBe(true);
    expect(turnoNoHorario(diurnoHoje, agora)).toBe(false);
    expect(escolherTurnoAtivo([diurnoHoje, noturnoOntem], agora)).toBe(noturnoOntem);
  });
  it("às 06:55 (dentro da tolerância dos dois) o noturno em curso ganha do diurno que ainda não começou", () => {
    const agora = Date.parse(sp("2026-09-11", "06:55"));
    expect(escolherTurnoAtivo([diurnoHoje, noturnoOntem], agora)).toBe(noturnoOntem);
  });
  it("às 07:05 o diurno já contém o instante e ganha do noturno em tolerância — salvo se o noturno ainda estiver aberto", () => {
    const agora = Date.parse(sp("2026-09-11", "07:05"));
    expect(escolherTurnoAtivo([noturnoOntem, diurnoHoje], agora)).toBe(diurnoHoje);
    const noturnoAberto = t(noturnoOntem.inicio, noturnoOntem.fim, { check_in: sp("2026-09-10", "19:01") });
    expect(escolherTurnoAtivo([diurnoHoje, noturnoAberto], agora)).toBe(noturnoAberto);
  });
  it("noturno encerrado (check-out feito) não volta a ser o ativo", () => {
    const agora = Date.parse(sp("2026-09-11", "07:05"));
    const encerrado = t(noturnoOntem.inicio, noturnoOntem.fim, { check_in: sp("2026-09-10", "19:01"), check_out: sp("2026-09-11", "07:02") });
    expect(escolherTurnoAtivo([encerrado, diurnoHoje], agora)).toBe(diurnoHoje);
  });
  it("fora da janela de todos não há turno ativo", () => {
    const agora = Date.parse(sp("2026-09-11", "19:30"));
    expect(escolherTurnoAtivo([noturnoOntem, diurnoHoje], agora)).toBeNull();
  });
  it("duração do noturno é 12h", () => {
    expect(duracaoHorasTurno(noturnoOntem)).toBe(12);
  });
});

describe("mensagemErroTurno — violações da 0140 em português", () => {
  it("exclusão de sobreposição", () => {
    expect(mensagemErroTurno({ code: "23P01", message: 'conflicting key value violates exclusion constraint "turnos_sem_sobreposicao"' })).toMatch(/Conflito de horário/);
  });
  it("check fim > inicio", () => {
    expect(mensagemErroTurno({ code: "23514", message: 'new row violates check constraint "turnos_fim_apos_inicio"' })).toMatch(/depois do início/);
  });
  it("RAISE do trigger passa a mensagem do servidor", () => {
    expect(mensagemErroTurno({ code: "P0001", message: "Profissional inativa não pode ser designada num turno." })).toBe("Profissional inativa não pode ser designada num turno.");
  });
  it("erro desconhecido tem fallback", () => {
    expect(mensagemErroTurno(null)).toMatch(/Não foi possível/);
  });
});
