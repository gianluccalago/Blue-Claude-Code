import { describe, expect, it } from "vitest";
import {
  devidaNaData,
  diasDeAtraso,
  pendenciasNoPlantao,
  plantaoAtualEAnterior,
  plantaoPadrao,
  proximoVencimento,
  rotuloIntervalo,
  somarDias,
  ultimaExecucaoPorItem,
} from "@/lib/rotina";
import type { PlanoCuidadoItem } from "@/types/database";

const sp = (data: string, hhmm: string) => new Date(`${data}T${hhmm}:00-03:00`);
const iso = (data: string, hhmm: string) => sp(data, hhmm).toISOString();

function item(p: Partial<PlanoCuidadoItem> & { id: string; tarefa: string }): PlanoCuidadoItem {
  return {
    residente_id: "r1", horario: null, turno_livre: null, intervalo_dias: null, inicio_em: "2026-01-01",
    responsavel: "cuidador", tolerancia_minutos: 30, ativa: true, ...p,
  };
}

describe("periodicidade", () => {
  const pressao = { intervalo_dias: 15, inicio_em: "2026-09-03" };
  it("soma dias atravessando o mês", () => {
    expect(somarDias("2026-09-20", 15)).toBe("2026-10-05");
  });
  it("nunca feita: vence em inicio_em; feita no dia 03 volta no dia 18", () => {
    expect(proximoVencimento(pressao, null)).toBe("2026-09-03");
    expect(proximoVencimento(pressao, "2026-09-03")).toBe("2026-09-18");
    expect(devidaNaData(pressao, "2026-09-03", "2026-09-17")).toBe(false);
    expect(devidaNaData(pressao, "2026-09-03", "2026-09-18")).toBe(true);
  });
  it("atrasada continua devida e conta os dias; a próxima conta do dia em que foi feita", () => {
    expect(devidaNaData(pressao, "2026-09-03", "2026-09-20")).toBe(true);
    expect(diasDeAtraso(pressao, "2026-09-03", "2026-09-20")).toBe(2);
    expect(proximoVencimento(pressao, "2026-09-20")).toBe("2026-10-05");
  });
  it("diária é sempre devida", () => {
    expect(devidaNaData({ intervalo_dias: null }, "2026-09-28", "2026-09-29")).toBe(true);
    expect(rotuloIntervalo(null)).toBe("Todo dia");
    expect(rotuloIntervalo(15)).toBe("A cada 15 dias");
  });
  it("última execução ignora o próprio dia (feito hoje continua visível como feito)", () => {
    const m = ultimaExecucaoPorItem(
      [{ tarefa: "a", data: "2026-09-03" }, { tarefa: "a", data: "2026-09-18" }, { tarefa: "a", data: "2026-09-29" }],
      "2026-09-29",
    );
    expect(m.get("a")).toBe("2026-09-18");
  });
});

describe("plantões de referência", () => {
  it("madrugada = noturno da véspera; manhã = diurno; noite = noturno", () => {
    const madr = plantaoAtualEAnterior(sp("2026-09-29", "03:00"));
    expect([madr.atual.tag, madr.atual.dataPlantao, madr.anterior.tag, madr.anterior.dataPlantao]).toEqual(["noturno", "2026-09-28", "diurno", "2026-09-28"]);
    const manha = plantaoAtualEAnterior(sp("2026-09-29", "10:00"));
    expect([manha.atual.tag, manha.atual.dataPlantao, manha.anterior.tag, manha.anterior.dataPlantao]).toEqual(["diurno", "2026-09-29", "noturno", "2026-09-28"]);
    const noite = plantaoAtualEAnterior(sp("2026-09-29", "20:00"));
    expect([noite.atual.tag, noite.anterior.tag, noite.anterior.dataPlantao]).toEqual(["noturno", "diurno", "2026-09-29"]);
  });
});

describe("pendenciasNoPlantao", () => {
  const diurno = plantaoPadrao("diurno", "2026-09-29");
  const banho = item({ id: "banho", tarefa: "Banho", turno_livre: "diurno" });
  const sol = item({ id: "sol", tarefa: "Banho de sol", horario: "10:00", tolerancia_minutos: 30 });
  const noite = item({ id: "noite", tarefa: "Higiene", turno_livre: "noturno" });
  const pressao = item({ id: "pa", tarefa: "Aferir pressão", horario: "09:00", intervalo_dias: 15, inicio_em: "2026-09-01" });
  const itens = [banho, sol, noite, pressao];

  it("em curso às 10h20: nada atrasado (sol ainda na tolerância; banho sem hora fora das 2 h finais); pressão das 09h atrasada", () => {
    const p = pendenciasNoPlantao({
      itens, registros: [], historico: [{ tarefa: "pa", data: "2026-09-14" }], plantao: diurno, encerrado: false, agora: sp("2026-09-29", "10:20"),
    });
    expect(p.map((x) => [x.item.id, x.situacao, x.diasAtraso])).toEqual([["pa", "atrasada", 0]]);
  });
  it("em curso às 17h10: sol atrasado e banho vencendo; o noturno não entra", () => {
    const p = pendenciasNoPlantao({
      itens, registros: [], historico: [{ tarefa: "pa", data: "2026-09-20" }], plantao: diurno, encerrado: false, agora: sp("2026-09-29", "17:10"),
    });
    expect(p.map((x) => [x.item.id, x.situacao])).toEqual([["sol", "atrasada"], ["banho", "vencendo"]]);
  });
  it("feito dentro da janela some; periódica ainda não vencida não aparece", () => {
    const p = pendenciasNoPlantao({
      itens,
      registros: [{ tarefa: "banho", data: "2026-09-29", feito_em: iso("2026-09-29", "09:00") }, { tarefa: "sol", data: "2026-09-29", feito_em: iso("2026-09-29", "10:05") }],
      historico: [{ tarefa: "pa", data: "2026-09-20" }],
      plantao: diurno, encerrado: false, agora: sp("2026-09-29", "18:30"),
    });
    expect(p).toEqual([]);
  });
  it("plantão encerrado lista tudo o que era devido e não foi feito", () => {
    const p = pendenciasNoPlantao({
      itens, registros: [{ tarefa: "sol", data: "2026-09-29", feito_em: iso("2026-09-29", "10:05") }],
      historico: [], plantao: diurno, encerrado: true, agora: sp("2026-09-29", "20:00"),
    });
    expect(p.map((x) => [x.item.id, x.situacao])).toEqual([["pa", "nao_feita"], ["banho", "nao_feita"]]);
    expect(p[0].diasAtraso).toBe(28);
  });
});
