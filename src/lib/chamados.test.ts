import { describe, expect, it } from "vitest";
import { chamadosPorSuite, indicadoresChamados, ordenarChamados, semResposta, situacaoCentral, tempoDesde } from "@/lib/chamados";
import { MODULO_5 } from "@/data/mapaModulo5";

const t = (hhmm: string) => `2026-09-30T${hhmm}:00-03:00`;
const agora = new Date(t("02:10"));

describe("mapa do Módulo 5", () => {
  it("1º andar 5101–5119 (19) e 2º andar 5201–5220 (20), sem repetição", () => {
    const [a1, a2] = MODULO_5.andares;
    expect(a1.suites.map((s) => s.codigo)).toEqual(Array.from({ length: 19 }, (_, i) => `51${String(i + 1).padStart(2, "0")}`));
    expect(a2.suites.map((s) => s.codigo)).toEqual(Array.from({ length: 20 }, (_, i) => `52${String(i + 1).padStart(2, "0")}`));
  });
  it("numeração começa no canto superior direito", () => {
    for (const a of MODULO_5.andares) {
      const topo = a.suites.filter((s) => s.y === Math.min(...a.suites.map((x) => x.y)));
      expect(topo.sort((x, y) => y.x - x.x)[0].codigo.endsWith("01")).toBe(true);
    }
  });
});

describe("chamados", () => {
  const lista = [
    { quarto: "5110", tipo: "chamado" as const, aberto_em: t("02:00") },
    { quarto: "5214", tipo: "emergencia" as const, aberto_em: t("02:05") },
    { quarto: "5103", tipo: "chamado" as const, aberto_em: t("01:50") },
  ];
  it("emergência primeiro; depois o mais antigo", () => {
    expect(ordenarChamados(lista).map((c) => c.quarto)).toEqual(["5214", "5103", "5110"]);
    expect(chamadosPorSuite(lista).get("5214")?.tipo).toBe("emergencia");
  });
  it("tempo desde a abertura", () => {
    expect(tempoDesde(t("02:10"), agora)).toBe("agora");
    expect(tempoDesde(t("02:03"), agora)).toBe("7 min");
    expect(tempoDesde(t("00:55"), agora)).toBe("1 h 15");
  });
  it("sem ninguém a caminho: chamado após 3 min, emergência após 1 min", () => {
    expect(semResposta({ tipo: "chamado", aberto_em: t("02:08"), reconhecido_em: null }, agora)).toBe(false);
    expect(semResposta({ tipo: "chamado", aberto_em: t("02:06"), reconhecido_em: null }, agora)).toBe(true);
    expect(semResposta({ tipo: "emergencia", aberto_em: t("02:08"), reconhecido_em: null }, agora)).toBe(true);
    expect(semResposta({ tipo: "emergencia", aberto_em: t("02:00"), reconhecido_em: t("02:01") }, agora)).toBe(false);
  });
});

describe("situação da central", () => {
  it("sem central = aparelho não instalado; sinal velho = sem conexão", () => {
    expect(situacaoCentral([], agora).tipo).toBe("sem_central");
    expect(situacaoCentral([{ ativo: true, ultimo_sinal_em: t("02:09") }], agora).tipo).toBe("online");
    expect(situacaoCentral([{ ativo: true, ultimo_sinal_em: t("02:05") }], agora).tipo).toBe("sem_sinal");
    expect(situacaoCentral([{ ativo: true, ultimo_sinal_em: null }], agora).tipo).toBe("sem_sinal");
    expect(situacaoCentral([{ ativo: false, ultimo_sinal_em: t("02:09") }], agora).tipo).toBe("sem_central");
  });
});

describe("indicadores", () => {
  it("mediana até a presença no quarto, sem simulações; excepcionais contados à parte", () => {
    const r = indicadoresChamados([
      { tipo: "chamado", status: "atendido", simulado: false, aberto_em: t("01:00"), atendido_em: t("01:04"), atendimento_via: "nfc" },
      { tipo: "emergencia", status: "atendido", simulado: false, aberto_em: t("01:10"), atendido_em: t("01:12"), atendimento_via: "nfc" },
      { tipo: "chamado", status: "atendido", simulado: false, aberto_em: t("01:20"), atendido_em: t("01:30"), atendimento_via: "presenca_dispositivo" },
      { tipo: "chamado", status: "encerrado_excepcional", simulado: false, aberto_em: t("01:40"), atendido_em: t("02:00"), atendimento_via: "excepcional" },
      { tipo: "emergencia", status: "atendido", simulado: true, aberto_em: t("01:50"), atendido_em: t("01:51"), atendimento_via: "nfc" },
    ]);
    expect(r).toEqual({ total: 4, emergencias: 1, atendidos: 3, excepcionais: 1, medianaMin: 4, maiorMin: 10 });
  });
});
