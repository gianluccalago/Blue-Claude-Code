import { ehCuidadosIntensivos, nomeAcomodacao } from "@/lib/mensalidade";
import type { CrmContato, CrmOportunidade, OpcaoSimulacao } from "@/types/database";

// ===========================================================================
// MINUTA DO CONTRATO (Word) preenchida pelo CRM.
// O modelo (src/assets/minuta-contrato.docx) é o contrato da Blue com campos
// {{...}} grifados em amarelo e as caixas de marcar nomeadas (chk_*). O app
// troca os campos pelo que já sabe da oportunidade; o que não sabe fica
// "[●]", grifado, para completar no Word.
// ===========================================================================

export const CAMPOS_MINUTA = [
  "residente_nome", "mantenedor_nome", "mantenedor_telefone", "mantenedor_email",
  "mensalidade_valor", "mensalidade_extenso", "desconto_pct", "acomodacao", "grau", "curta_valor",
] as const;
export type CampoMinuta = (typeof CAMPOS_MINUTA)[number];

export const CAIXAS_MINUTA = ["chk_cp", "chk_lp", "chk_individual", "chk_duplo", "chk_mensalidade", "chk_curta"] as const;
export type CaixaMinuta = (typeof CAIXAS_MINUTA)[number];

const VAZIO = "[●]";
const COR_MARCADA = "F79646"; // laranja das caixas do contrato

// --- Valor por extenso (reais) ---------------------------------------------

const UNIDADES = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove",
  "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const DEZENAS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const CENTENAS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

/** 0–999 por extenso ("" para 0). */
function ate999(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c]);
  if (r) partes.push(r < 20 ? UNIDADES[r] : DEZENAS[Math.floor(r / 10)] + (r % 10 ? ` e ${UNIDADES[r % 10]}` : ""));
  return partes.join(" e ");
}

/** Inteiro por extenso, até 999.999.999. */
export function numeroPorExtenso(n: number): string {
  n = Math.floor(Math.abs(n));
  if (n === 0) return "zero";
  const milhoes = Math.floor(n / 1_000_000);
  const milhares = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const grupos: { texto: string; valor: number }[] = [];
  if (milhoes) grupos.push({ texto: milhoes === 1 ? "um milhão" : `${ate999(milhoes)} milhões`, valor: milhoes * 1_000_000 });
  if (milhares) grupos.push({ texto: milhares === 1 ? "mil" : `${ate999(milhares)} mil`, valor: milhares * 1000 });
  if (resto) grupos.push({ texto: ate999(resto), valor: resto });
  // "e" antes do último grupo quando ele é menor que 100 ou centena redonda
  // (dois mil e quinhentos, mil e vinte); senão, só espaço (mil cento e dez).
  return grupos.map((g, i) => {
    if (i === 0) return g.texto;
    const ultimo = i === grupos.length - 1;
    const liga = ultimo && (g.valor < 100 || g.valor % 100 === 0);
    return `${liga ? " e " : " "}${g.texto}`;
  }).join("");
}

/** R$ por extenso: "dezessete mil e cem reais", "um real e cinco centavos". */
export function valorPorExtenso(valor: number): string {
  const centavosTotal = Math.round(Math.abs(valor) * 100);
  const reais = Math.floor(centavosTotal / 100);
  const centavos = centavosTotal % 100;
  const partes: string[] = [];
  if (reais) {
    const exatoMilhao = reais % 1_000_000 === 0;
    partes.push(`${numeroPorExtenso(reais)}${exatoMilhao ? " de" : ""} ${reais === 1 ? "real" : "reais"}`);
  }
  if (centavos) partes.push(`${numeroPorExtenso(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  return partes.length ? partes.join(" e ") : "zero reais";
}

// --- Campos a partir da oportunidade ------------------------------------------

/** Nome da acomodação como está no contrato ("Suíte Luxo individual", "Long Stay Cuidados Intensivos"). */
export function acomodacaoContrato(tipoSuite: string | null, ocupacao: string | null): string | null {
  const nome = nomeAcomodacao(tipoSuite, ocupacao);
  if (!nome) return null;
  if (ehCuidadosIntensivos(tipoSuite, ocupacao)) return nome;
  const ocup = ocupacao === "simples" ? "individual" : ocupacao === "duplo" ? "dupla" : ocupacao === "triplo" ? "tripla" : null;
  return ocup ? `${nome} ${ocup}` : nome;
}

const moedaSemSimbolo = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface DadosMinuta {
  residente: string | null;
  mantenedor: string | null;
  telefone: string | null;
  email: string | null;
  /** Opção 1 da simulação. */
  opcao: OpcaoSimulacao | null;
  /** Grau estimado do contato (quando a opção é Memory Care). */
  grauEstimado: string | null;
}

export function dadosDaMinuta(op: Pick<CrmOportunidade, "simulacao">, contato: Pick<CrmContato, "nome" | "nome_idoso" | "telefones" | "emails" | "grau_estimado"> | null): DadosMinuta {
  return {
    residente: contato?.nome_idoso ?? null,
    mantenedor: contato?.nome ?? null,
    telefone: contato?.telefones?.[0] ?? null,
    email: contato?.emails?.[0] ?? null,
    opcao: op.simulacao?.opcoes?.[0] ?? null,
    grauEstimado: contato?.grau_estimado ?? null,
  };
}

/**
 * O que preencher e o que marcar. Longa permanência: LP + Mensalidade pelo
 * valor CHEIO da tabela e o desconto (vitalício: se o grau mudar, vale sobre a
 * tabela do novo grau — item 9.1.2). Reabilitação: igual, com a modalidade em
 * aberto (o contrato só tem CP e LP, e reabilitação não é curta permanência).
 * Curta permanência: CP + diária, sem desconto.
 */
export function camposDaMinuta(d: DadosMinuta): { campos: Partial<Record<CampoMinuta, string>>; marcar: CaixaMinuta[] } {
  const campos: Partial<Record<CampoMinuta, string>> = {
    residente_nome: d.residente ?? undefined,
    mantenedor_nome: d.mantenedor ?? undefined,
    mantenedor_telefone: d.telefone ?? undefined,
    mantenedor_email: d.email ?? undefined,
  };
  const marcar: CaixaMinuta[] = [];
  const o = d.opcao;
  const grau = o?.grau && ["I", "II", "III"].includes(o.grau) ? o.grau : d.grauEstimado;
  if (grau) campos.grau = grau;
  if (!o || o.modalidade === "day_use") return { campos, marcar };

  const acomodacao = acomodacaoContrato(o.tipo_suite, o.ocupacao);
  if (acomodacao) campos.acomodacao = acomodacao;
  if (o.ocupacao === "simples") marcar.push("chk_individual");
  if (o.ocupacao === "duplo") marcar.push("chk_duplo");

  if (o.modalidade === "curta_permanencia") {
    marcar.push("chk_cp", "chk_curta");
    if (o.valor_final != null) campos.curta_valor = `R$ ${moedaSemSimbolo(o.valor_final)} ${o.unidade === "/dia" ? "por dia" : o.unidade === "/mês" ? "por mês" : o.unidade}`;
    return { campos, marcar };
  }
  if (o.modalidade === "longa_permanencia") marcar.push("chk_lp");
  marcar.push("chk_mensalidade");
  const cheio = o.valor_tabela ?? o.valor_final;
  if (cheio != null) {
    campos.mensalidade_valor = moedaSemSimbolo(cheio);
    campos.mensalidade_extenso = valorPorExtenso(cheio);
  }
  if (o.desconto_pct > 0) campos.desconto_pct = String(o.desconto_pct);
  return { campos, marcar };
}

// --- XML ------------------------------------------------------------------

const escaparXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Pinta a caixa (forma do Word) de laranja; também no desenho alternativo (VML). */
export function marcarCaixa(xml: string, nome: CaixaMinuta): string {
  const i = xml.indexOf(`name="${nome}"`);
  if (i < 0) return xml;
  const geo = xml.indexOf("</a:prstGeom>", i);
  if (geo < 0) return xml;
  const pos = geo + "</a:prstGeom>".length;
  let out = `${xml.slice(0, pos)}<a:solidFill><a:srgbClr val="${COR_MARCADA}"/></a:solidFill>${xml.slice(pos)}`;
  const fimAlt = out.indexOf("</mc:AlternateContent>", i);
  const fill = out.indexOf('fillcolor="', i);
  if (fill > 0 && fimAlt > 0 && fill < fimAlt) {
    const fimAttr = out.indexOf('"', fill + 'fillcolor="'.length);
    out = `${out.slice(0, fill)}fillcolor="#${COR_MARCADA.toLowerCase()}${out.slice(fimAttr)}`;
  }
  return out;
}

/** Troca os campos {{...}} (ausentes viram "[●]") e marca as caixas. */
export function preencherMinutaXml(xml: string, campos: Partial<Record<CampoMinuta, string>>, marcar: readonly CaixaMinuta[]): string {
  let out = xml;
  for (const c of CAMPOS_MINUTA) {
    const v = campos[c]?.trim();
    out = out.split(`{{${c}}}`).join(escaparXml(v ? v : VAZIO));
  }
  for (const m of marcar) out = marcarCaixa(out, m);
  return out;
}

export function nomeArquivoMinuta(d: DadosMinuta): string {
  const base = (d.residente || d.mantenedor || "familia")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return `Minuta_Contrato_Blue_${base}.docx`;
}

/** Gera o .docx preenchido (no navegador) e baixa. */
export async function baixarMinuta(d: DadosMinuta): Promise<void> {
  const [{ default: JSZip }, { default: modeloUrl }] = await Promise.all([
    import("jszip"),
    import("@/assets/minuta-contrato.docx?url"),
  ]);
  const resp = await fetch(modeloUrl);
  if (!resp.ok) throw new Error("Não foi possível carregar o modelo da minuta.");
  const zip = await JSZip.loadAsync(await resp.arrayBuffer());
  const arquivo = zip.file("word/document.xml");
  if (!arquivo) throw new Error("Modelo da minuta inválido.");
  const { campos, marcar } = camposDaMinuta(d);
  zip.file("word/document.xml", preencherMinutaXml(await arquivo.async("string"), campos, marcar));
  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivoMinuta(d);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
