import { describe, expect, it } from "vitest";
import { lerUrlNtag213, normalizarUid, validateTagRead, type TagValidator } from "./validacaoTag";

const URL_OK = "https://app.blueseniorliving.com.br/r?m=04A1B2C3D4E5F6x00002A";

describe("NTAG213 — leitura da URL espelhada", () => {
  it("formato do chip com os dois espelhos: ?m=UIDxCONTADOR", () => {
    expect(lerUrlNtag213(URL_OK)).toEqual({ uid: "04A1B2C3D4E5F6", counter: 42 });
  });
  it("formato alternativo ?u=&c= e hex minúsculo", () => {
    expect(lerUrlNtag213("https://app.blueseniorliving.com.br/r?u=04a1b2c3d4e5f6&c=0000ff")).toEqual({ uid: "04A1B2C3D4E5F6", counter: 255 });
  });
  it("URL malformada, UID curto, contador ausente ou não-hex são inválidos", () => {
    for (const u of [
      null,
      "não é url",
      "https://x/r?m=04A1B2C3D4E5x00002A",
      "https://x/r?m=04A1B2C3D4E5F600002A",
      "https://x/r?u=04A1B2C3D4E5F6",
      "https://x/r?m=04A1B2C3D4E5F6x00ZZ2A",
    ]) expect(lerUrlNtag213(u)).toBeNull();
  });
  it("normaliza o serialNumber do Web NFC", () => {
    expect(normalizarUid("04:a1:b2:c3:d4:e5:f6")).toBe("04A1B2C3D4E5F6");
    expect(normalizarUid("")).toBeNull();
    expect(normalizarUid("04:a1")).toBeNull();
  });
});

describe("validateTagRead (ntag213)", () => {
  it("serialNumber igual ao UID da URL → válida, sem flags", async () => {
    const r = await validateTagRead({ url: URL_OK, serialNumber: "04:A1:B2:C3:D4:E5:F6" });
    expect(r).toMatchObject({ valid: true, tagUid: "04A1B2C3D4E5F6", counter: 42, flags: [], motivo: null, implementacao: "ntag213" });
  });
  it("UID divergente (URL de outra tag) → rejeitada", async () => {
    const r = await validateTagRead({ url: URL_OK, serialNumber: "04:00:00:00:00:00:01" });
    expect(r).toMatchObject({ valid: false, motivo: "uid_divergente" });
  });
  it("serialNumber vazio → aceita o UID da URL com a flag uid_nao_confirmado", async () => {
    const r = await validateTagRead({ url: URL_OK, serialNumber: "" });
    expect(r).toMatchObject({ valid: true, tagUid: "04A1B2C3D4E5F6", flags: ["uid_nao_confirmado"] });
  });
  it("payload sem URL válida → rejeitada", async () => {
    expect(await validateTagRead({ url: "https://x/r", serialNumber: "04:A1:B2:C3:D4:E5:F6" })).toMatchObject({ valid: false, motivo: "payload_invalido" });
  });
  it("a implementação é trocável sem mudar a chamada (ex.: futura ntag424)", async () => {
    const falso: TagValidator = {
      id: "ntag424-teste",
      validate: async () => ({ valid: true, tagUid: "04DE5F1EACC040", counter: 61, flags: [], motivo: null, implementacao: "ntag424-teste" }),
    };
    expect(await validateTagRead({ url: "qualquer", serialNumber: null }, falso)).toMatchObject({ tagUid: "04DE5F1EACC040", counter: 61 });
  });
});
