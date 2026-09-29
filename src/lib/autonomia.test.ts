import { describe, expect, it } from "vitest";
import {
  DOMINIOS,
  indicadorDaCasa,
  indicadorDoHospede,
  limparItens,
  mudancasDeGrau,
  prazoEntrada,
  resumoAutonomia,
  statusDoDominio,
  statusDosDominios,
  textoPrazo,
} from "@/lib/autonomia";
import type { AutonomiaAvaliacao, AutonomiaObjetivo, AutonomiaRevisao, DominioAutonomia } from "@/types/database";

function aval(dominio: DominioAutonomia, assinadaEm: string | null, itens: AutonomiaAvaliacao["itens"] = { x: { obs: "ok" } }): AutonomiaAvaliacao {
  return {
    id: `${dominio}-${assinadaEm ?? "rasc"}`, residente_id: "r1", dominio, motivo: "entrada", itens, sintese: null,
    assinada: !!assinadaEm, assinada_em: assinadaEm ? `${assinadaEm}T12:00:00Z` : null, assinada_por: null,
    registrado_por: null, criado_em: "2026-01-01T00:00:00Z", atualizado_em: "2026-01-01T00:00:00Z",
  };
}
const base = { dataAdmissao: "2026-09-01", ativadoEm: "2026-09-29", ivcfs: [], escalonamentos: [] as string[] };

describe("prazos", () => {
  it("admitido depois da ativação: 7 dias; quem já estava: 30 dias da ativação", () => {
    expect(prazoEntrada("2026-10-05", "2026-09-29")).toBe("2026-10-12");
    expect(prazoEntrada("2025-03-01", "2026-09-29")).toBe("2026-10-29");
    expect(prazoEntrada(null, "2026-09-29")).toBe("2026-10-29");
  });
  it("sem avaliação assinada = pendente de entrada (rascunho não conta)", () => {
    const s = statusDoDominio({ ...base, dominio: "fisio", avaliacoes: [aval("fisio", null)], hoje: "2026-10-01" });
    expect([s.situacao, s.motivo, s.prazo, s.vencida, !!s.rascunho]).toEqual(["pendente", "entrada", "2026-10-29", false, true]);
    expect(statusDoDominio({ ...base, dominio: "fisio", avaliacoes: [], hoje: "2026-10-30" }).vencida).toBe(true);
  });
  it("assinada: em dia até 6 meses; depois, reavaliação semestral", () => {
    const a = [aval("nutricao", "2026-03-01")];
    expect(statusDoDominio({ ...base, dominio: "nutricao", avaliacoes: a, hoje: "2026-08-29" }).situacao).toBe("em_dia");
    const s = statusDoDominio({ ...base, dominio: "nutricao", avaliacoes: a, hoje: "2026-08-31" });
    expect([s.situacao, s.motivo]).toEqual(["pendente", "periodica"]);
  });
  it("mudança de grau depois da última avaliação pede reavaliação em 7 dias (todos os domínios)", () => {
    const ivcfs = [
      { classificacao: "Grau I", registrado_em: "2026-01-10T10:00:00Z" },
      { classificacao: "Grau II", registrado_em: "2026-09-20T10:00:00Z" },
    ];
    expect(mudancasDeGrau(ivcfs)).toEqual(["2026-09-20"]);
    const s = statusDoDominio({ ...base, ivcfs, dominio: "nutricao", avaliacoes: [aval("nutricao", "2026-09-01")], hoje: "2026-09-29" });
    expect([s.situacao, s.motivo, s.prazo, s.vencida]).toEqual(["pendente", "mudanca_grau", "2026-09-27", true]);
  });
  it("intercorrência escalada pede reavaliação de médico, coordenação e fisio — não da nutrição", () => {
    const esc = { ...base, escalonamentos: ["2026-09-25"], hoje: "2026-09-29" };
    expect(statusDoDominio({ ...esc, dominio: "fisio", avaliacoes: [aval("fisio", "2026-09-01")] }).motivo).toBe("intercorrencia");
    expect(statusDoDominio({ ...esc, dominio: "nutricao", avaliacoes: [aval("nutricao", "2026-09-01")] }).situacao).toBe("em_dia");
    // Intercorrência ANTES da última avaliação não conta.
    expect(statusDoDominio({ ...esc, dominio: "fisio", avaliacoes: [aval("fisio", "2026-09-26")] }).situacao).toBe("em_dia");
  });
  it("texto do prazo", () => {
    expect(textoPrazo("2026-09-29", "2026-09-29")).toBe("vence hoje");
    expect(textoPrazo("2026-10-02", "2026-09-29")).toBe("vence em 3 dias");
    expect(textoPrazo("2026-09-28", "2026-09-29")).toBe("venceu há 1 dia");
  });
});

describe("itens", () => {
  it("limpa itens vazios e apara textos", () => {
    expect(limparItens({ a: {}, b: { preferencia: "  banho à tarde " }, c: { equipe_assume: false } })).toEqual({ b: { preferencia: "banho à tarde" } });
  });
});

describe("indicador", () => {
  const hoje = "2026-10-10";
  const todas = DOMINIOS.map((d) => aval(d.id, "2026-10-01", { roupa: { consegue: "sozinho", preferencia: "escolhe a roupa na véspera" } }));
  const status = statusDosDominios({ ...base, avaliacoes: todas, hoje });
  const obj: AutonomiaObjetivo = {
    id: "o1", residente_id: "r1", dominio: "fisio", avaliacao_id: null, descricao: "Andar até o refeitório", meta: "3x/semana com andador",
    responsavel: null, prazo_revisao: "2026-12-30", status: "ativo", acordado_residente_em: null, acordado_familia_em: null, criado_por: null, criado_em: "2026-10-01T00:00:00Z",
  };
  const rev: AutonomiaRevisao = {
    id: "v1", objetivo_id: "o1", observado: "Foi 3x com andador", fala_residente: "Gosto de ir sozinho", resultado: "mantido",
    participantes: ["residente", "equipe"], proxima_revisao: null, revisado_por: null, revisado_em: "2026-10-09T10:00:00Z",
  };
  it("documentada exige 4 avaliações em dia + preferência + objetivo ativo; verificada exige revisão recente", () => {
    const sem = indicadorDoHospede({ residenteId: "r1", status, objetivos: [], revisoes: [], hoje });
    expect([sem.avaliacoesEmDia, sem.temPreferencia, sem.documentada]).toEqual([true, true, false]);
    const doc = indicadorDoHospede({ residenteId: "r1", status, objetivos: [obj], revisoes: [], hoje });
    expect([doc.documentada, doc.verificada]).toEqual([true, false]);
    const ver = indicadorDoHospede({ residenteId: "r1", status, objetivos: [obj], revisoes: [rev], hoje });
    expect(ver.verificada).toBe(true);
    const casa = indicadorDaCasa([sem, doc, ver]);
    expect([casa.total, casa.documentadas, casa.verificadas, casa.pctDocumentada, casa.pctVerificada, casa.semObjetivo]).toEqual([3, 2, 1, 67, 33, 1]);
  });
  it("faltando um domínio, não é documentada", () => {
    const tres = statusDosDominios({ ...base, avaliacoes: todas.slice(0, 3), hoje });
    expect(indicadorDoHospede({ residenteId: "r1", status: tres, objetivos: [obj], revisoes: [rev], hoje }).documentada).toBe(false);
  });
});

describe("resumo para a equipe", () => {
  it("separa sozinho/supervisão, 'deixe fazer' e preferências; restrição clínica vem do médico", () => {
    const r = resumoAutonomia([
      aval("coordenacao", "2026-10-01", {
        roupa: { consegue: "sozinho", quer: "sim", preferencia: "gosta de cores claras", equipe_assume: true },
        vestir: { consegue: "supervisao" },
        visitas: { consegue: "dependente" },
      }),
      aval("medico", "2026-10-01", { restricoes: { obs: "Sem banho sem apoio até 15/11 (pós-queda)" } }),
      aval("fisio", null, { cama: { consegue: "sozinho" } }), // rascunho: não entra
    ]);
    expect(r.sozinho).toEqual(["Escolher a própria roupa"]);
    expect(r.supervisao).toEqual(["Vestir-se e calçar-se"]);
    expect(r.deixeFazer).toEqual(["Escolher a própria roupa"]);
    expect(r.preferencias).toEqual([{ item: "Escolher a própria roupa", texto: "gosta de cores claras" }]);
    expect(r.restricoesClinicas).toBe("Sem banho sem apoio até 15/11 (pós-queda)");
  });
});
