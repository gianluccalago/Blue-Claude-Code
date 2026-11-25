import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import {
  CAMPOS_MINUTA, CAIXAS_MINUTA, acomodacaoContrato, camposDaMinuta, dadosDaMinuta, nomeArquivoMinuta,
  numeroPorExtenso, preencherMinutaXml, valorPorExtenso,
} from "@/lib/minuta";
import type { OpcaoSimulacao } from "@/types/database";

const opcao = (o: Partial<OpcaoSimulacao>): OpcaoSimulacao => ({
  modalidade: "longa_permanencia", tipo_suite: "Suíte Luxo", ocupacao: "simples", grau: "III",
  valor_tabela: 18117.65, desconto_pct: 15, valor_final: 15400, unidade: "/mês", ...o,
});

describe("valor por extenso", () => {
  it("números", () => {
    expect(numeroPorExtenso(100)).toBe("cem");
    expect(numeroPorExtenso(101)).toBe("cento e um");
    expect(numeroPorExtenso(1000)).toBe("mil");
    expect(numeroPorExtenso(1020)).toBe("mil e vinte");
    expect(numeroPorExtenso(2500)).toBe("dois mil e quinhentos");
    expect(numeroPorExtenso(18117)).toBe("dezoito mil cento e dezessete");
    expect(numeroPorExtenso(1_000_000)).toBe("um milhão");
    expect(numeroPorExtenso(2_300_015)).toBe("dois milhões trezentos mil e quinze");
  });
  it("reais e centavos", () => {
    expect(valorPorExtenso(15400)).toBe("quinze mil e quatrocentos reais");
    expect(valorPorExtenso(17100)).toBe("dezessete mil e cem reais");
    expect(valorPorExtenso(20117.65)).toBe("vinte mil cento e dezessete reais e sessenta e cinco centavos");
    expect(valorPorExtenso(1.01)).toBe("um real e um centavo");
    expect(valorPorExtenso(0.5)).toBe("cinquenta centavos");
    expect(valorPorExtenso(1_000_000)).toBe("um milhão de reais");
  });
});

describe("campos da minuta", () => {
  const contato = { nome: "Ana Souza", nome_idoso: "Maria Souza", telefones: ["41 99999-0000"], emails: ["ana@x.com"], grau_estimado: "II" as const };

  it("longa permanência: LP, mensalidade pelo valor cheio + 15% de desconto vitalício, acomodação e grau", () => {
    const { campos, marcar } = camposDaMinuta(dadosDaMinuta({ simulacao: { opcoes: [opcao({})] } }, contato));
    expect(campos).toMatchObject({
      residente_nome: "Maria Souza", mantenedor_nome: "Ana Souza", mantenedor_telefone: "41 99999-0000", mantenedor_email: "ana@x.com",
      mensalidade_valor: "18.117,65", mensalidade_extenso: "dezoito mil cento e dezessete reais e sessenta e cinco centavos", desconto_pct: "15",
      acomodacao: "Suíte Luxo individual", grau: "III",
    });
    expect(marcar.sort()).toEqual(["chk_individual", "chk_lp", "chk_mensalidade"]);
  });

  it("curta permanência: CP com a diária; Memory Care usa o grau estimado", () => {
    const { campos, marcar } = camposDaMinuta(dadosDaMinuta(
      { simulacao: { opcoes: [opcao({ modalidade: "curta_permanencia", ocupacao: "duplo", grau: "MC", desconto_pct: 0, valor_final: 682.5, unidade: "/dia" })] } }, contato));
    expect(campos.curta_valor).toBe("R$ 682,50 por dia");
    expect(campos.mensalidade_valor).toBeUndefined();
    expect(campos.grau).toBe("II");
    expect(marcar.sort()).toEqual(["chk_cp", "chk_curta", "chk_duplo"]);
  });

  it("reabilitação: mensalidade marcada, modalidade em aberto", () => {
    const { marcar } = camposDaMinuta(dadosDaMinuta({ simulacao: { opcoes: [opcao({ modalidade: "reabilitacao" })] } }, contato));
    expect(marcar).not.toContain("chk_lp");
    expect(marcar).not.toContain("chk_cp");
    expect(marcar).toContain("chk_mensalidade");
  });

  it("acomodação com o nome do contrato e nome de arquivo sem acento", () => {
    expect(acomodacaoContrato("Suíte Premium", "duplo")).toBe("Suíte Premium dupla");
    expect(acomodacaoContrato("Suíte Luxo", "simples")).toBe("Suíte Luxo individual");
    expect(acomodacaoContrato("Suíte", "simples")).toBe("Suíte Luxo individual"); // simulação salva antes da 0156
    expect(acomodacaoContrato("Long Stay", "triplo")).toBe("Long Stay Cuidados Intensivos");
    expect(nomeArquivoMinuta(dadosDaMinuta({ simulacao: null }, { ...contato, nome_idoso: "José da Conceição" }))).toBe("Minuta_Contrato_Blue_Jose_da_Conceicao.docx");
  });
});

describe("modelo Word", () => {
  it("tem todos os campos e caixas; preenche, escapa e marca", async () => {
    const zip = await JSZip.loadAsync(readFileSync(resolve(__dirname, "../assets/minuta-contrato.docx")));
    const xml = await zip.file("word/document.xml")!.async("string");
    for (const c of CAMPOS_MINUTA) expect(xml.split(`{{${c}}}`).length - 1, c).toBe(1);
    for (const k of CAIXAS_MINUTA) expect(xml.split(`name="${k}"`).length - 1, k).toBe(1);
    expect(xml).toContain("Remoção (quando necessário)");

    const cheio = preencherMinutaXml(xml, { residente_nome: "Maria & Filhos <teste>", mensalidade_valor: "15.400,00" }, ["chk_lp"]);
    expect(cheio).not.toMatch(/\{\{\w+\}\}/);
    expect(cheio).toContain("Maria &amp; Filhos &lt;teste&gt;");
    expect(cheio).toContain("Mensalidade: R$ ");
    expect(cheio).toContain("[●]"); // o que não se sabe fica para completar
    const lp = cheio.indexOf('name="chk_lp"');
    expect(cheio.slice(lp, lp + 3000)).toContain('<a:solidFill><a:srgbClr val="F79646"/></a:solidFill>');
    const cp = cheio.indexOf('name="chk_cp"');
    expect(cheio.slice(cp, cp + 3000)).not.toContain("F79646");
  });
});
