import { describe, expect, it } from "vitest";
import { nomeSeguroArquivo, ACCEPT_ENTREGA_OBRA, LIMITE_UPLOAD_MB } from "@/lib/storage";

describe("nomeSeguroArquivo — o nome da entrega precisa sobreviver ao upload", () => {
  it("preserva o nome real da entrega da TRÍADE", () => {
    // Caso real: R00 do Projeto de Terraplanagem.
    expect(nomeSeguroArquivo("TERRAPLENAGEM - SENIORS CARE - R0.zip"))
      .toBe("TERRAPLENAGEM-SENIORS-CARE-R0.zip");
  });
  it("remove acentos e caracteres problemáticos na chave do objeto", () => {
    expect(nomeSeguroArquivo("Memorial Descritivo – Revisão nº1.pdf"))
      .toBe("Memorial-Descritivo-Revisao-n-1.pdf");
  });
  it("mantém a extensão em minúsculas", () => {
    expect(nomeSeguroArquivo("MAPA CORTE-ATERRO - R0.DWG")).toBe("MAPA-CORTE-ATERRO-R0.dwg");
  });
  it("aguenta nome sem extensão e nome só de símbolos", () => {
    expect(nomeSeguroArquivo("planta")).toBe("planta.bin");
    expect(nomeSeguroArquivo("###.zip")).toBe("arquivo.zip");
  });
  it("limita o tamanho da chave sem perder a extensão", () => {
    const gerado = nomeSeguroArquivo("A".repeat(300) + ".zip");
    expect(gerado.endsWith(".zip")).toBe(true);
    expect(gerado.length).toBeLessThanOrEqual(84);
  });
});

describe("formatos aceitos na entrega de projeto", () => {
  it("aceita pacote compactado — uma entrega é uma pasta", () => {
    for (const ext of [".zip", ".rar", ".7z"]) expect(ACCEPT_ENTREGA_OBRA).toContain(ext);
  });
  it("aceita os formatos de projeto usados na obra", () => {
    for (const ext of [".pdf", ".dwg", ".dxf", ".rvt", ".ifc"]) expect(ACCEPT_ENTREGA_OBRA).toContain(ext);
  });
  it("declara um limite compatível com uma entrega completa", () => {
    expect(LIMITE_UPLOAD_MB).toBeGreaterThanOrEqual(100);
  });
});
