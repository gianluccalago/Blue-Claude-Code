// ===========================================================================
// VALIDAÇÃO DA LEITURA DA TAG — interface única, implementação trocável.
//
// Todo o fluxo de rondas chama só `validateTagRead(payload)`, que devolve
// { valid, tagUid, counter, flags }. Hoje a implementação é "ntag213"; uma
// futura "ntag424" (SUN: PICCData cifrado + CMAC) entra aqui, com a mesma
// assinatura, sem mexer na Edge Function, no banco nem no app.
//
// Este arquivo é PURO (sem Deno, sem rede, sem imports): roda na Edge
// Function, no app (tela de cadastro de tag) e nos testes do Vitest.
//
// NTAG213 — o que o chip grava na URL (espelhamento ASCII, datasheet NXP
// NTAG213/215/216, "UID and NFC counter mirror"):
//   · UID: 7 bytes → 14 caracteres hex;
//   · contador NFC: 3 bytes → 6 caracteres hex, incrementado pelo próprio
//     chip na primeira leitura de cada toque;
//   · com os DOIS espelhos ligados, o chip escreve num ponto só:
//     "<UID>x<CONTADOR>" (o 'x' é inserido pelo chip). Por isso o formato
//     principal é  https://app.blueseniorliving.com.br/r?m=04A1B2C3D4E5F6x00002A
//   · também aceitamos ?u=<UID>&c=<CONTADOR> (espelhos em posições
//     separadas, se algum dia a gravação for feita assim).
// A NTAG213 NÃO tem criptografia: a prova de presença vem da soma "tag
// cadastrada + contador sempre crescente + tablet cadastrado + número de
// série lido pelo Android igual ao UID da URL" — checagens de estado feitas
// no banco (RPC registrar_leitura_nfc), atômicas.
// ===========================================================================

export interface TagReadPayload {
  /** URL do registro NDEF lido (ou colada, em testes). */
  url: string | null | undefined;
  /** `serialNumber` do Web NFC (ex.: "04:a1:b2:c3:d4:e5:f6"); pode vir vazio. */
  serialNumber: string | null | undefined;
}

export type FlagLeitura =
  /** O aparelho não informou o número de série: vale só o UID da URL. */
  | "uid_nao_confirmado";

export type MotivoRejeicao = "payload_invalido" | "uid_divergente";

export interface TagReadResult {
  valid: boolean;
  tagUid: string | null;
  counter: number | null;
  flags: FlagLeitura[];
  motivo: MotivoRejeicao | null;
  implementacao: string;
}

export interface TagValidator {
  id: string;
  validate(payload: TagReadPayload): Promise<TagReadResult>;
}

const UID_RE = /^[0-9A-F]{14}$/;
const CTR_RE = /^[0-9A-F]{6}$/;

/** "04:a1:b2…" / "04A1B2…" → "04A1B2…" (14 hex maiúsculos) ou null. */
export function normalizarUid(v: string | null | undefined): string | null {
  if (!v) return null;
  const hex = v.replace(/[^0-9a-fA-F]/g, "").toUpperCase();
  return UID_RE.test(hex) ? hex : null;
}

/** Extrai UID e contador da URL gravada na NTAG213 (?m=UIDxCTR ou ?u=&c=). */
export function lerUrlNtag213(url: string | null | undefined): { uid: string; counter: number } | null {
  if (!url) return null;
  let q: URLSearchParams;
  try {
    q = new URL(url).searchParams;
  } catch {
    return null;
  }
  let uidTxt: string | null = null;
  let ctrTxt: string | null = null;
  const m = q.get("m");
  if (m) {
    const partes = m.toUpperCase().split("X");
    if (partes.length !== 2) return null;
    [uidTxt, ctrTxt] = partes;
  } else {
    uidTxt = q.get("u")?.toUpperCase() ?? null;
    ctrTxt = q.get("c")?.toUpperCase() ?? null;
  }
  if (!uidTxt || !ctrTxt || !UID_RE.test(uidTxt) || !CTR_RE.test(ctrTxt)) return null;
  return { uid: uidTxt, counter: parseInt(ctrTxt, 16) };
}

export const ntag213: TagValidator = {
  id: "ntag213",
  async validate({ url, serialNumber }) {
    const base = { implementacao: "ntag213" };
    const lido = lerUrlNtag213(url);
    if (!lido) return { ...base, valid: false, tagUid: null, counter: null, flags: [], motivo: "payload_invalido" };
    const flags: FlagLeitura[] = [];
    const serial = normalizarUid(serialNumber);
    if (!serial) {
      flags.push("uid_nao_confirmado");
    } else if (serial !== lido.uid) {
      // UID da URL ≠ chip encostado: URL copiada/forjada ou tag regravada.
      return { ...base, valid: false, tagUid: lido.uid, counter: lido.counter, flags, motivo: "uid_divergente" };
    }
    return { ...base, valid: true, tagUid: lido.uid, counter: lido.counter, flags, motivo: null };
  },
};

/** Ponto único de validação. Trocar a implementação aqui (ex.: ntag424). */
export const VALIDADOR_ATIVO: TagValidator = ntag213;

export function validateTagRead(payload: TagReadPayload, validador: TagValidator = VALIDADOR_ATIVO): Promise<TagReadResult> {
  return validador.validate(payload);
}
