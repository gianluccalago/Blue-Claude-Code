import type { jsPDF } from "jspdf";
import type { GrupoPrescricao } from "@/hooks/useMedico";
import type { Residente } from "@/types/database";
import { formatarDataBR, hojeISO } from "@/lib/utils";
import { usuarioAtual } from "@/auth/usuarioAtual";

/** Quem assina a receita: nome + registro profissional (CRM). */
export type AssinanteReceita = { nome: string; crm: string };

/** Assinatura da receita: médico LOGADO (nome + registro profissional/CRM). */
function medicoAssinante(): AssinanteReceita {
  return { nome: usuarioAtual.nome, crm: usuarioAtual.registro ?? "" };
}

// Dados fixos da instituição (cabeçalho da receita).
const INSTITUICAO = {
  nome: "Blue Senior Living",
  endereco: "R. Eduardo Sprada, 2387 - Campo Comprido",
  cidade: "Curitiba - PR, 81210-350",
};

// ─── Constantes de exibição ───────────────────────────────────────────────────

// Sem acentos: as fontes padrão do jsPDF não renderizam bem caracteres acentuados.
const VIA_EXTENSO: Record<string, string> = {
  oral: "VO",
  injetavel: "Injetavel",
  insulina: "Insulina (SC)",
  sonda: "Sonda",
};

const PERIODO_LABEL_UTF8: Record<string, string> = {
  jejum: "Jejum",
  manha: "Manhã",
  almoco: "Almoço",
  apos_almoco: "Após almoço",
  tarde: "Tarde",
  noite: "Noite",
};

// Texto da frequência para a frase de posologia do texto copiável
// (ex: "Tomar 1 comprimido ao dia" / "Tomar 1 comprimido de 12/12h").
const POSOLOGIA_TEXTO: Record<string, string> = {
  "1x/dia": "ao dia",
  "12/12h": "de 12/12h",
  "8/8h": "de 8/8h",
  "6/6h": "de 6/6h",
  "1x/dia em jejum": "ao dia, em jejum",
  "1x/dia à noite": "ao dia, à noite",
};

// Unidades que não variam no plural (abreviações de medida).
const UNIDADES_INVARIAVEIS = new Set(["ml", "mg", "mcg", "g", "kg", "l", "ui", "meq"]);

const PERIODO_LABEL: Record<string, string> = {
  jejum: "Jejum",
  manha: "Manha",
  almoco: "Almoco",
  apos_almoco: "Apos almoco",
  tarde: "Tarde",
  noite: "Noite",
};

const PERIODO_HORARIO: Record<string, string> = {
  jejum: "06h",
  manha: "08h",
  almoco: "12h",
  apos_almoco: "13h",
  tarde: "16h",
  noite: "20h",
};

const PERIODO_ORDER: Record<string, number> = {
  jejum: 0,
  manha: 1,
  almoco: 2,
  apos_almoco: 3,
  tarde: 4,
  noite: 5,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gerarHash(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 36 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function nomeSanitizado(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function nomeArquivo(nomeHospede: string, ext: string): string {
  const data = hojeISO(); // dia civil LOCAL (toISOString direto seria UTC)
  return `prescricao_${nomeSanitizado(nomeHospede)}_${data}.${ext}`;
}

function parsearQuantidade(qtd: string | null | undefined): { numero: number; unidade: string } | null {
  if (!qtd) return null;
  const match = qtd.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (!match) return null;
  return {
    numero: parseFloat(match[1].replace(",", ".")),
    unidade: match[2].trim() || "unidade",
  };
}

/** Formata um número para exibição (sem casas decimais quando inteiro). */
function formatarNumero(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1).replace(".", ",");
}

/** Pluraliza a unidade quando a quantidade for diferente de 1. */
function pluralizar(numero: number, unidade: string): string {
  if (!unidade || numero === 1) return unidade;
  if (UNIDADES_INVARIAVEIS.has(unidade.toLowerCase())) return unidade;
  if (/s$/i.test(unidade)) return unidade;
  return `${unidade}s`;
}

/** Soma, por todos os períodos ativos, (quantidade por administração x 30 dias). */
function calcularMensalDetalhado(grupo: GrupoPrescricao): { valor: number; unidade: string } | null {
  let total = 0;
  let unidade = "";
  for (const l of grupo.linhas) {
    const p = parsearQuantidade(l.quantidade);
    if (p) {
      total += p.numero;
      if (!unidade) unidade = p.unidade;
    }
  }
  if (total === 0) return null;
  return { valor: total * 30, unidade };
}

function calcularMensal(grupo: GrupoPrescricao): string {
  const r = calcularMensalDetalhado(grupo);
  return r ? `${formatarNumero(r.valor)} ${pluralizar(r.valor, r.unidade)}` : "—";
}

function linhasOrdenadas(grupo: GrupoPrescricao) {
  return [...grupo.linhas].sort(
    (a, b) => (PERIODO_ORDER[a.periodo] ?? 99) - (PERIODO_ORDER[b.periodo] ?? 99),
  );
}

function dataHoraEmissao(d: Date): string {
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

type RGB = [number, number, number];

async function construirPrescricaoDoc(
  hospede: Residente,
  grupos: GrupoPrescricao[],
  assinante: AssinanteReceita,
): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const agora = new Date();
  const emissao = dataHoraEmissao(agora);
  const hash = gerarHash();

  // Paleta clara e profissional, pensada para impressão (sem fundos escuros).
  const NAVY: RGB = [37, 78, 117]; // texto de destaque (azul navy)
  const CELESTE: RGB = [92, 191, 229]; // detalhes / linhas finas
  const LIGHT: RGB = [240, 248, 252]; // preenchimentos suaves
  const BORDER: RGB = [205, 225, 238]; // bordas finas
  const INK: RGB = [55, 71, 90]; // corpo de texto
  const GRAY: RGB = [125, 138, 150]; // texto secundário
  const WHITE: RGB = [255, 255, 255];

  const W = 210;
  const L = 20;
  const R = W - 20;
  const COL = R - L;

  let y = 0;

  // ── Cabeçalho (fundo branco, faixa celeste fina no topo) ───────────────────
  doc.setFillColor(...CELESTE);
  doc.rect(0, 0, W, 2.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...NAVY);
  doc.text(INSTITUICAO.nome, L, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...GRAY);
  doc.text(INSTITUICAO.endereco, L, 22);
  doc.text(INSTITUICAO.cidade, L, 26.5);

  // Título à direita
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...CELESTE);
  doc.text("PRESCRICAO MEDICA", R, 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Emitida em ${emissao}`, R, 22, { align: "right" });

  // Linha separadora
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.line(L, 31, R, 31);

  y = 41;

  // ── Dados do paciente ─────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(L, y, COL, 30, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...NAVY);
  doc.text("DADOS DO PACIENTE", L + 5, y + 6.5);

  const cpf = (hospede as Residente & { cpf?: string | null }).cpf;
  const dataNasc = hospede.data_nascimento ? formatarDataBR(hospede.data_nascimento) : "Nao informado";

  const dadosLinhas: [string, string, string, string][] = [
    ["Paciente:", hospede.nome, "CPF:", cpf || "Nao informado"],
    ["Nascimento:", dataNasc, "Quarto:", hospede.quarto || "Nao informado"],
  ];

  dadosLinhas.forEach(([k1, v1, k2, v2], idx) => {
    const ly = y + 14 + idx * 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    doc.text(k1, L + 5, ly);
    doc.setFont("helvetica", "normal");
    doc.text(v1, L + 26, ly);
    doc.setFont("helvetica", "bold");
    doc.text(k2, L + 110, ly);
    doc.setFont("helvetica", "normal");
    doc.text(v2, L + 128, ly);
  });

  y += 40;

  // ── Título da seção ───────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("MEDICAMENTOS PRESCRITOS", L, y);

  doc.setDrawColor(...CELESTE);
  doc.setLineWidth(0.4);
  doc.line(L, y + 2, R, y + 2);

  y += 10;

  // ── Itens ─────────────────────────────────────────────────────────────────
  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i];
    const lins = linhasOrdenadas(g);
    const mensal = calcularMensal(g);
    const via = VIA_EXTENSO[g.via] || g.via;

    // Altura estimada do bloco: cabeçalho (18mm) + períodos (6mm cada) + rodapé (7mm)
    const altBloco = 18 + lins.length * 6 + 7;

    if (y + altBloco > 270) {
      doc.addPage();
      y = 20;
    }

    // Fundo do bloco (branco com borda fina)
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.25);
    doc.roundedRect(L, y, COL, altBloco, 2, 2, "FD");

    // Barra lateral celeste fina
    doc.setFillColor(...CELESTE);
    doc.roundedRect(L, y, 2.5, altBloco, 2, 2, "F");

    // Número do medicamento (badge claro)
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...CELESTE);
    doc.setLineWidth(0.3);
    doc.roundedRect(L + 6, y + 4, 7, 6, 1, 1, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text(String(i + 1), L + 9.5, y + 8.2, { align: "center" });

    // Nome + dose
    const nomeMed = g.medicamento + (g.dose ? ` ${g.dose}` : "");
    const nomeSplit = doc.splitTextToSize(nomeMed, COL - 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(nomeSplit, L + 16, y + 8.5);

    // Via + posologia
    const viaPos = [via, g.posologia].filter(Boolean).join("  |  ");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(viaPos, L + 16, y + 15);

    // Linha divisória fina
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.15);
    doc.line(L + 5, y + 18, R - 5, y + 18);

    // Períodos
    let py = y + 24;
    for (const l of lins) {
      const pLabel = PERIODO_LABEL[l.periodo] ?? l.periodo;
      const pHora = PERIODO_HORARIO[l.periodo] ?? "";
      const qtd = l.quantidade || "—";

      doc.setFillColor(...LIGHT);
      doc.roundedRect(L + 6, py - 4, 38, 5.5, 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...NAVY);
      doc.text(`${pLabel} (${pHora})`, L + 7.5, py);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...INK);
      doc.text(qtd, L + 48, py);

      py += 6;
    }

    // Quantidade mensal
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...NAVY);
    doc.text(`Qtd. mensal (x30): ${mensal}`, R - 4, py, { align: "right" });

    y += altBloco + 4;
  }

  if (grupos.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text("Nenhuma prescricao ativa.", L, y);
    y += 12;
  }

  // ── Rodapé / assinatura ───────────────────────────────────────────────────
  if (y > 242) {
    doc.addPage();
    y = 20;
  }

  y += 6;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.line(L, y, R, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Assinatura eletronica do medico assistente", L, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(`${assinante.nome}${assinante.crm ? `  —  ${assinante.crm}` : ""}`, L, y);

  y += 6;
  doc.setFont("courier", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...GRAY);
  doc.text(`Hash: ${hash}`, L, y);

  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Emitida em: ${emissao}`, L, y);

  return doc;
}

/** Médico: gera e BAIXA o PDF, assinado pelo usuário logado (comportamento atual). */
export async function exportarPrescricaoPDF(
  hospede: Residente,
  grupos: GrupoPrescricao[],
): Promise<void> {
  const doc = await construirPrescricaoDoc(hospede, grupos, medicoAssinante());
  doc.save(nomeArquivo(hospede.nome, "pdf"));
}

/**
 * Gera o MESMO PDF (layout idêntico ao do Médico) e devolve o Blob + o nome do
 * arquivo "prescricao_[nome]_[AAAA-MM-DD].pdf", SEM baixar — base para a
 * emissão em lote da Farmácia. O assinante é informado explicitamente (médico
 * geriatra escolhido), para a receita sair assinada pelo médico, e não por
 * quem dispara o lote.
 */
export async function gerarPrescricaoBlob(
  hospede: Residente,
  grupos: GrupoPrescricao[],
  assinante: AssinanteReceita,
): Promise<{ blob: Blob; nomeArquivo: string }> {
  const doc = await construirPrescricaoDoc(hospede, grupos, assinante);
  return { blob: doc.output("blob"), nomeArquivo: nomeArquivo(hospede.nome, "pdf") };
}

// ─── Texto copiável (pronto para colar no site do CFM) ─────────────────────────

/**
 * Frase de posologia do medicamento (ex: "Tomar 1 comprimido ao dia" ou
 * "Tomar 1 comprimido de 12/12h"). Quando a quantidade varia por período,
 * detalha cada período separadamente.
 */
function gerarPosologiaTexto(g: GrupoPrescricao): string {
  const lins = linhasOrdenadas(g);
  const freq = POSOLOGIA_TEXTO[g.posologia ?? ""] ?? g.posologia ?? "";
  const parsed = lins.map((l) => parsearQuantidade(l.quantidade));

  const primeira = parsed[0];
  const todasIguais =
    primeira !== null &&
    parsed.every((p) => p && p.numero === primeira.numero && p.unidade === primeira.unidade);

  if (todasIguais && primeira) {
    const partes = ["Tomar", formatarNumero(primeira.numero), pluralizar(primeira.numero, primeira.unidade)];
    if (freq) partes.push(freq);
    return partes.join(" ");
  }

  // Quantidades diferentes por período: detalha cada uma.
  const detalhes = lins
    .map((l) => `${PERIODO_LABEL_UTF8[l.periodo] ?? l.periodo}: ${l.quantidade || "—"}`)
    .join(", ");
  return freq ? `${detalhes} (${freq})` : detalhes;
}

/**
 * Gera o texto corrido de todas as medicações ativas, formatado para colar
 * na prescrição eletrônica do CFM. Uma linha por medicamento, no formato
 * "NOME DOSE ------------ X unidade", seguida da posologia em texto.
 * X = quantidade mensal total = soma, por todos os períodos ativos, de
 * (quantidade por administração x 30 dias).
 */
export function gerarTextoPrescricao(grupos: GrupoPrescricao[]): string {
  if (grupos.length === 0) return "Nenhuma prescrição ativa.";

  return grupos
    .map((g) => {
      const nomeDose = g.medicamento + (g.dose ? ` ${g.dose}` : "");
      const mensal = calcularMensalDetalhado(g);
      const qtdTexto = mensal ? `${formatarNumero(mensal.valor)} ${pluralizar(mensal.valor, mensal.unidade)}` : "—";

      return `${nomeDose} ------------ ${qtdTexto}\n${gerarPosologiaTexto(g)}`;
    })
    .join("\n\n");
}

/**
 * Copia o texto da prescrição para a área de transferência.
 * Retorna true se a cópia foi bem-sucedida.
 */
export async function copiarPrescricao(grupos: GrupoPrescricao[]): Promise<boolean> {
  const texto = gerarTextoPrescricao(grupos);
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texto);
      return true;
    }
    // Fallback para contextos sem Clipboard API (ex: http).
    const ta = document.createElement("textarea");
    ta.value = texto;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
