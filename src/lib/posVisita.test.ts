import { describe, expect, it } from "vitest";
import {
  calcularOpcao, validadeSimulacao, textoSimulacao, preencher, camposPendentes, diaVisitaTexto, grauDaTabela, chaveTabelaPreco,
  gerarSequencia, semRetornoApos3Contatos, contatosFeitos, type DadosMensagem,
} from "@/lib/posVisita";
import type { CrmBiblioteca, CrmModeloMensagem } from "@/types/database";

const bib = (codigo: string, tipo: "dor" | "objecao", texto: string, link: string | null = null): CrmBiblioteca => ({
  codigo, tipo, titulo: `Título ${codigo}`, sinais: null, o_que_ouvimos: null, como_resolve: null, prova_social: null,
  conteudo_titulo: `Conteúdo ${codigo}`, conteudo_link: link, texto_whatsapp: texto, observacoes: null, ativo: true, ordem: 0, atualizado_em: "",
});
const mod = (codigo: string, texto: string, ativo = true): CrmModeloMensagem => ({
  codigo, nome: codigo, dias_apos_visita: null, quando: null, texto, ativo, ordem: 0, atualizado_em: "",
});

const BIBLIOTECA = [
  bib("D01", "dor", "Quedas: equipe a noite toda para {residente}.", "https://blue/quedas"),
  bib("D02", "dor", "Solidão: atividades todo dia."),
  bib("D06", "dor", "Família longe: portal da família."),
  bib("O04", "objecao", "Decisão em família: encaminhe para os demais."),
];
const MODELOS = [
  mod("M1", "Olá, {visitante}! Aqui é {consultor}, do Blue.\n\nObrigado pela visita {dia_visita}. Foi um prazer conhecer vocês{detalhe_pessoal}.\n\nVocês nos contaram que {frase_o_que_ouvimos}.\n\n{blocos_dores}\n\n{bloco_objecao}"),
  mod("M2", "Material 👇\n\n{simulacao}\n\n{conteudos_dores}\n\nEncaminhe à família."),
  mod("M3", "Avaliação: {link_google}", false),
  mod("M4", "{proximos_passos}\n\n{pergunta_confirmacao}\n\n{opt_out}"),
  mod("M5", "Uma família que também {situacao_parecida} contou: \"{depoimento}\". Como vocês estão pensando sobre {residente}?"),
  mod("OPTOUT", "Se preferir não receber mais mensagens, é só me avisar."),
];

const base: DadosMensagem = {
  visitante: "Ana Souza", consultor: "Ernesto Lagomarsino", residenteChamar: "Dona Maria", nomeIdoso: "Maria Souza",
  tratamento: "sua mãe", detalhePessoal: "e ouvir as histórias da Dona Maria como professora",
  oQueOuvimos: "a Dona Maria caiu duas vezes este ano.", dores: ["D01", "D06", "D02"], objecoes: ["O04"],
  proximosPassos: [{ passo: "Almoço experiência", data: "2026-11-28" }, { passo: "", data: null }],
  perguntaConfirmacao: null,
  simulacao: [calcularOpcao({ modalidade: "longa_permanencia", tipo_suite: "Suíte Luxo", ocupacao: "simples", grau: "II", valor_tabela: 10000, unidade: "/mês" }, null)],
  simulacaoValidade: "2026-12-24", visitaEm: "2026-11-24", hoje: "2026-11-24",
};

describe("simulação", () => {
  it("longa permanência e reabilitação: tabela com 15% de desconto", () => {
    const o = calcularOpcao({ modalidade: "reabilitacao", tipo_suite: "Suíte Luxo", ocupacao: "simples", grau: "I", valor_tabela: 9000, unidade: "/mês" }, null);
    expect(o.desconto_pct).toBe(15);
    expect(o.valor_final).toBe(7650);
  });
  it("Seniors Day e curta permanência: diária da tabela, sem desconto; valor digitado prevalece", () => {
    const d = calcularOpcao({ modalidade: "day_use", tipo_suite: null, ocupacao: null, grau: "I", valor_tabela: 346.5, unidade: "/dia", plano: "sd_2a_6a" }, null);
    expect(d).toMatchObject({ desconto_pct: 0, valor_final: 346.5, unidade: "/dia" });
    expect(calcularOpcao({ modalidade: "day_use", tipo_suite: null, ocupacao: null, grau: "I", valor_tabela: 346.5, unidade: "/dia" }, 400).valor_final).toBe(400);
    const c = calcularOpcao({ modalidade: "curta_permanencia", tipo_suite: "Suíte Luxo", ocupacao: "simples", grau: "II", valor_tabela: null, unidade: "/dia" }, 0);
    expect(c.valor_final).toBeNull();
    expect(textoSimulacao([d], null)).toContain("Seniors Day (Day Use) · 2ª a 6ª · grau I\nR$ 346,50/dia");
  });
  it("Memory Care aparece pelo nome; reabilitação usa a faixa de preço única", () => {
    const mc = calcularOpcao({ modalidade: "longa_permanencia", tipo_suite: "Suíte Luxo", ocupacao: "simples", grau: "MC", valor_tabela: 20117.65, unidade: "/mês" }, null);
    expect(mc.valor_final).toBe(17100); // = "com desconto máximo" da planilha
    expect(textoSimulacao([mc], null)).toContain("Memory Care");
    const ci = calcularOpcao({ modalidade: "longa_permanencia", tipo_suite: "Long Stay", ocupacao: "triplo", grau: "III", valor_tabela: 14823.53, unidade: "/mês" }, null);
    expect(textoSimulacao([ci], null)).toContain("Long Stay Cuidados Intensivos · ocupação triplo · grau III");
    expect(ci.valor_final).toBe(12600); // = "com desconto máximo" da planilha
    expect(grauDaTabela("reabilitacao", "II")).toBe("REAB");
    expect(grauDaTabela("longa_permanencia", "MC")).toBe("MC");
    expect(chaveTabelaPreco("reabilitacao", "Suíte Luxo", "II", "duplo")).toEqual({ tipoSuite: "Apartamento", grau: "REAB", ocupacao: "simples" });
    expect(chaveTabelaPreco("longa_permanencia", "Suíte Luxo", "II", "duplo")).toEqual({ tipoSuite: "Suíte Luxo", grau: "II", ocupacao: "duplo" });
  });
  it("validade de 30 dias e aviso de avaliação médica", () => {
    expect(validadeSimulacao("2026-11-24")).toBe("2026-12-24");
    const t = textoSimulacao(base.simulacao, "2026-12-24");
    expect(t).toContain("válida até 24/12/2026");
    expect(t).toContain("de R$ 10.000,00 por R$ 8.500,00/mês (15% de desconto)");
    expect(t).toContain("sujeito à avaliação médica");
  });
});

describe("mensagens", () => {
  it("preenche só o que conhece e aponta o que falta", () => {
    expect(preencher("Oi {visitante}, {x}", { visitante: "Ana" })).toBe("Oi Ana, {x}");
    expect(camposPendentes("{depoimento} e {evento} e {depoimento}")).toEqual(["depoimento", "evento"]);
    expect(diaVisitaTexto("2026-11-23", "2026-11-24")).toBe("ontem");
    expect(diaVisitaTexto("2026-11-20", "2026-11-24")).toBe("no dia 20/11");
  });

  it("M1 usa no máximo 2 dores (na ordem marcada) e 1 objeção, assinada pelo consultor", () => {
    const [m1] = gerarSequencia(base, BIBLIOTECA, MODELOS, true);
    expect(m1.mensagem).toContain("Olá, Ana! Aqui é Ernesto, do Blue.");
    expect(m1.mensagem).toContain("pela visita hoje. Foi um prazer conhecer vocês, e ouvir as histórias");
    expect(m1.mensagem).toContain("Vocês nos contaram que a Dona Maria caiu duas vezes este ano.");
    expect(m1.mensagem).toContain("Quedas: equipe a noite toda para Dona Maria.");
    expect(m1.mensagem).toContain("Família longe");
    expect(m1.mensagem).not.toContain("Solidão");
    expect(m1.mensagem).toContain("Decisão em família");
  });

  it("M2 leva a simulação e o conteúdo específico das dores marcadas", () => {
    const m2 = gerarSequencia(base, BIBLIOTECA, MODELOS, true).find((t) => t.modelo === "M2")!;
    expect(m2.mensagem).toContain("📋 Simulação");
    expect(m2.mensagem).toContain("📌 Conteúdo D01: https://blue/quedas");
  });

  it("3 contatos na primeira semana: D0, D+3 e D+7; Google desligado não entra", () => {
    const seq = gerarSequencia(base, BIBLIOTECA, MODELOS, true);
    expect(seq.map((t) => [t.modelo, t.data, t.tentativa])).toEqual([
      ["M1", "2026-11-24", 1], ["M2", "2026-11-24", 1], ["M4", "2026-11-27", 2], ["M5", "2026-12-01", 3],
    ]);
    const m4 = seq.find((t) => t.modelo === "M4")!;
    expect(m4.mensagem).toContain("📅 Almoço experiência — 28/11");
    expect(m4.mensagem).toContain("Se preferir não receber mais mensagens");
    expect(camposPendentes(seq.find((t) => t.modelo === "M5")!.mensagem)).toEqual(["situacao_parecida", "depoimento"]);
  });

  it("Google ligado entra em D+1 só se a visita foi positiva", () => {
    const comGoogle = MODELOS.map((m) => (m.codigo === "M3" ? { ...m, ativo: true } : m));
    expect(gerarSequencia(base, BIBLIOTECA, comGoogle, true).some((t) => t.modelo === "M3" && t.data === "2026-11-25")).toBe(true);
    expect(gerarSequencia(base, BIBLIOTECA, comGoogle, false).some((t) => t.modelo === "M3")).toBe(false);
  });

  it("pós-visita registrado dias depois: a semana conta a partir do registro", () => {
    const seq = gerarSequencia({ ...base, visitaEm: "2026-11-20", hoje: "2026-11-24" }, BIBLIOTECA, MODELOS, false);
    expect(seq.map((t) => t.data)).toEqual(["2026-11-24", "2026-11-24", "2026-11-27", "2026-12-01"]);
    expect(seq[0].mensagem).toContain("pela visita no dia 20/11");
  });
});

describe("regra dos 3 contatos sem retorno", () => {
  const feita = (tentativa: number, concluida_em: string) => ({ tentativa, concluida: true, cancelada: false, concluida_em });
  it("3 contatos feitos e nenhuma resposta: dar como perdido", () => {
    const t = [feita(1, "2026-11-24T15:00:00Z"), feita(2, "2026-11-27T12:00:00Z"), feita(3, "2026-12-01T12:00:00Z")];
    expect(contatosFeitos(t)).toBe(3);
    expect(semRetornoApos3Contatos(t, null)).toBe(true);
    expect(semRetornoApos3Contatos(t, "2026-11-25T10:00:00Z")).toBe(false);
  });
  it("menos de 3 contatos ainda não decide", () => {
    expect(semRetornoApos3Contatos([feita(1, "2026-11-24T15:00:00Z"), feita(2, "2026-11-27T12:00:00Z")], null)).toBe(false);
  });
});
