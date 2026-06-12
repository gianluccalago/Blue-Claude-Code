import type { jsPDF } from "jspdf";
import type { GrupoPrescricao } from "@/hooks/useMedico";
import type { Residente } from "@/types/database";
import { supabase } from "@/lib/supabase";
import { formatarDataBR, hojeISO, calcularIdade } from "@/lib/utils";

// ===========================================================================
// RECEITUÁRIO MÉDICO (PDF) — Blue Senior Living
//
// REGRA DE AUTORIA (inegociável): receita é DOCUMENTO MÉDICO. O PDF assina
// SEMPRE com o MÉDICO PRESCRITOR registrado na prescrição (prescrito_por),
// nunca com quem clicou em exportar. A Farmácia apenas EXTRAI o documento já
// assinado pelo médico. Se o hóspede tem prescrições de médicos diferentes,
// sai UMA receita por médico (cada um assina o que prescreveu). Prescrição
// sem médico identificado BLOQUEIA a emissão.
//
// O documento usa assinatura ELETRÔNICA simples do sistema (carimbo + código
// de verificação + QR) — sem alegação de certificação digital qualificada.
// ===========================================================================

export const MSG_SEM_MEDICO =
  "Prescrição sem médico responsável — atribua o prescritor antes de emitir.";

/** Erro de autoria: algum grupo de prescrição não tem médico prescritor válido. */
export class PrescricaoSemMedicoError extends Error {
  constructor() {
    super(MSG_SEM_MEDICO);
    this.name = "PrescricaoSemMedicoError";
  }
}

/** Médico que assina a receita (autor da prescrição). */
export type MedicoPrescritor = {
  id: string;
  nome: string;
  /** registro_profissional do cadastro (ex: "CRM-PR 45120"); null = não informado. */
  crm: string | null;
};

/** Uma receita pronta: o PDF e o médico que a assinou (transparência na UI). */
export type ReceitaGerada = {
  blob: Blob;
  nomeArquivo: string;
  medico: MedicoPrescritor;
};

// Dados fixos da instituição (cabeçalho da receita).
const INSTITUICAO = {
  nome: "Blue Senior Living",
  endereco: "R. Eduardo Sprada, 2387 - Campo Comprido",
  cidade: "Curitiba - PR, 81210-350",
};

/** Dias de validade da receita a partir da emissão. */
const VALIDADE_DIAS = 30;

// ─── Posologia por extenso ────────────────────────────────────────────────────

const PERIODO_FRASE: Record<string, string> = {
  jejum: "em jejum",
  manha: "pela manhã",
  almoco: "no almoço",
  apos_almoco: "após o almoço",
  tarde: "à tarde",
  noite: "à noite",
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

// Texto da frequência para a frase do texto copiável (site do CFM).
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Código de verificação legível (4 blocos de 4), ex: "K7QX-29MD-PL4A-Z8WT". */
function gerarCodigoVerificacao(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I/L (legibilidade)
  const bloco = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${bloco()}-${bloco()}-${bloco()}-${bloco()}`;
}

function nomeSanitizado(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

/** Sobrenome do médico para sufixar o arquivo quando há mais de um prescritor. */
function sobrenome(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes[partes.length - 1] ?? nome;
}

function nomeArquivoReceita(nomeHospede: string, sufixoMedico: string | null): string {
  const base = `prescricao_${nomeSanitizado(nomeHospede)}_${hojeISO()}`;
  return sufixoMedico ? `${base}_${nomeSanitizado(sufixoMedico)}.pdf` : `${base}.pdf`;
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

function formatarNumero(n: number): string {
  return Number.isInteger(n) ? n.toString() : n.toFixed(1).replace(".", ",");
}

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
  return r ? `${formatarNumero(r.valor)} ${pluralizar(r.valor, r.unidade)}` : "uso contínuo";
}

function linhasOrdenadas(grupo: GrupoPrescricao) {
  return [...grupo.linhas].sort(
    (a, b) => (PERIODO_ORDER[a.periodo] ?? 99) - (PERIODO_ORDER[b.periodo] ?? 99),
  );
}

function horaDaLinha(l: GrupoPrescricao["linhas"][number]): string {
  if (l.horario) return l.horario.slice(0, 5).replace(":00", "h").replace(":", "h");
  return PERIODO_HORARIO[l.periodo] ?? "";
}

/**
 * Posologia por extenso para o receituário, ex:
 *  "Tomar 1 comprimido pela manhã (08h) e 1 comprimido à noite (20h). Uso contínuo."
 *  "Uso subcutâneo — aplicar 10UI no almoço (12h). Uso contínuo."
 */
function posologiaPorExtenso(g: GrupoPrescricao): string {
  const lins = linhasOrdenadas(g);
  const partes = lins.map((l) => {
    const qtd = l.quantidade?.trim() || "1 dose";
    const periodo = PERIODO_FRASE[l.periodo] ?? l.periodo;
    const hora = horaDaLinha(l);
    return `${qtd} ${periodo}${hora ? ` (${hora})` : ""}`;
  });
  const lista =
    partes.length > 1 ? `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}` : partes[0] ?? "";

  switch (g.via) {
    case "insulina":
      return `Uso subcutâneo — aplicar ${lista}. Uso contínuo.`;
    case "injetavel":
      return `Uso injetável — aplicar ${lista}. Uso contínuo.`;
    case "sonda":
      return `Administrar via sonda: ${lista}. Uso contínuo.`;
    default:
      return `Tomar ${lista}. Uso contínuo.`;
  }
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

function dataValidade(emissao: Date): string {
  const v = new Date(emissao);
  v.setDate(v.getDate() + VALIDADE_DIAS);
  return v.toLocaleDateString("pt-BR");
}

// ─── Autoria: resolver e validar o médico prescritor ──────────────────────────

/**
 * Agrupa as prescrições por médico prescritor e resolve cada médico no
 * cadastro. VALIDAÇÃO DURA: grupo sem prescritor, prescritor inexistente ou
 * com perfil não-médico (exceto Master, que também é médico) bloqueia a
 * emissão com PrescricaoSemMedicoError.
 */
export async function separarPorMedicoPrescritor(
  grupos: GrupoPrescricao[],
): Promise<{ medico: MedicoPrescritor; grupos: GrupoPrescricao[] }[]> {
  const ids = [...new Set(grupos.map((g) => g.prescritoPor))];
  if (ids.some((id) => !id)) {
    console.error("Receita bloqueada: grupo(s) de prescrição sem prescrito_por.");
    throw new PrescricaoSemMedicoError();
  }

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, perfil, registro_profissional")
    .in("id", ids as string[]);
  if (error) throw error;

  const porId = new Map((data ?? []).map((u) => [u.id, u]));
  const lotes: { medico: MedicoPrescritor; grupos: GrupoPrescricao[] }[] = [];

  for (const id of ids as string[]) {
    const u = porId.get(id);
    // Só médico (ou Master, que também é médico) pode assinar receita.
    if (!u || (u.perfil !== "medico" && u.perfil !== "master")) {
      console.error(
        `Receita bloqueada: prescritor ${id} ${u ? `tem perfil "${u.perfil}"` : "não encontrado"} — não é médico.`,
      );
      throw new PrescricaoSemMedicoError();
    }
    if (!u.registro_profissional) {
      console.warn(
        `CRM não informado para o médico "${u.nome}" — corrija o cadastro (registro_profissional).`,
      );
    }
    lotes.push({
      medico: { id: u.id, nome: u.nome, crm: u.registro_profissional },
      grupos: grupos.filter((g) => g.prescritoPor === id),
    });
  }

  return lotes;
}

// ─── Logotipo (SVG oficial → PNG em alta resolução) ───────────────────────────

let logoCache: { navy: string | null; branco: string | null } | null = null;

// viewBox do logo.svg: 255.3 x 399 (emblema vertical).
const LOGO_ASPECTO = 255.3 / 399;

function rasterizarSvg(svgTexto: string, alturaPx: number): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const blob = new Blob([svgTexto], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.height = alturaPx;
          canvas.width = Math.round(alturaPx * LOGO_ASPECTO);
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/png"));
        } catch {
          resolve(null);
        } finally {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

/** Carrega o logo oficial em duas cores (navy p/ fundo claro, branco p/ selo). */
async function obterLogos(): Promise<{ navy: string | null; branco: string | null }> {
  if (logoCache) return logoCache;
  try {
    if (typeof document === "undefined") throw new Error("sem DOM");
    const svg = await (await fetch("/logo.svg")).text();
    const svgBranco = svg.replace(/fill="#1b3a5c"/gi, 'fill="#ffffff"');
    const [navy, branco] = await Promise.all([
      rasterizarSvg(svg, 600), // alta resolução para impressão nítida
      rasterizarSvg(svgBranco, 300),
    ]);
    logoCache = { navy, branco };
  } catch {
    logoCache = { navy: null, branco: null };
  }
  return logoCache;
}

// ─── Fontes (Lato, UTF-8/acentuação completa) ────────────────────────────────

async function registrarFontes(doc: jsPDF): Promise<void> {
  const { LATO_REGULAR, LATO_BOLD, LATO_ITALIC } = await import("./pdf/fontesLato");
  doc.addFileToVFS("Lato-Regular.ttf", LATO_REGULAR);
  doc.addFont("Lato-Regular.ttf", "Lato", "normal");
  doc.addFileToVFS("Lato-Bold.ttf", LATO_BOLD);
  doc.addFont("Lato-Bold.ttf", "Lato", "bold");
  doc.addFileToVFS("Lato-Italic.ttf", LATO_ITALIC);
  doc.addFont("Lato-Italic.ttf", "Lato", "italic");
}

// ─── Construção do PDF ────────────────────────────────────────────────────────

type RGB = [number, number, number];
const NAVY: RGB = [28, 74, 110]; // #1C4A6E
const CELESTE: RGB = [92, 191, 229]; // #5CBFE5
const INK: RGB = [52, 64, 80];
const GRAY: RGB = [120, 132, 146];
const LIGHT: RGB = [238, 247, 252];
const BORDER: RGB = [200, 222, 236];

const W = 210;
const H = 297;
const ML = 20; // margem esquerda
const MR = 190; // borda direita útil
const COL = MR - ML;

/**
 * Monta o documento de UMA receita (um hóspede, um médico prescritor).
 * Exportada para pré-visualização/testes; o fluxo normal passa por
 * gerarReceitasDoHospede, que valida a autoria e separa por médico.
 */
export async function construirReceitaDoc(
  hospede: Residente,
  grupos: GrupoPrescricao[],
  medico: MedicoPrescritor,
): Promise<jsPDF> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registrarFontes(doc);
  const logos = await obterLogos();

  const agora = new Date();
  const emissaoCurta = agora.toLocaleDateString("pt-BR");
  const emissaoLonga = dataHoraEmissao(agora);
  const validade = dataValidade(agora);
  const codigo = gerarCodigoVerificacao();
  const crmTexto = medico.crm?.trim() ? `CRM: ${medico.crm.trim()}` : "CRM não informado";

  // ── Cabeçalho da 1ª página ──────────────────────────────────────────────
  function cabecalhoPrincipal(): number {
    // Faixa celeste fina no topo + filete navy.
    doc.setFillColor(...CELESTE);
    doc.rect(0, 0, W, 2.2, "F");
    doc.setFillColor(...NAVY);
    doc.rect(0, 2.2, W, 0.7, "F");

    const topo = 13;
    // Logo oficial (emblema) em alta resolução.
    const logoH = 21;
    const logoW = logoH * LOGO_ASPECTO;
    if (logos.navy) doc.addImage(logos.navy, "PNG", ML, topo, logoW, logoH);

    // Lockup "BLUE / SENIOR LIVING" ao lado do emblema.
    const tx = ML + (logos.navy ? logoW + 5 : 0);
    doc.setFont("Lato", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...NAVY);
    doc.text("BLUE", tx, topo + 8.5, { charSpace: 1.2 });
    doc.setFont("Lato", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text("SENIOR LIVING", tx, topo + 12.5, { charSpace: 1.6 });

    doc.setFontSize(7.5);
    doc.text(INSTITUICAO.endereco, tx, topo + 18);
    doc.text(INSTITUICAO.cidade, tx, topo + 21.5);

    // Título e datas à direita.
    doc.setFont("Lato", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...NAVY);
    doc.text("RECEITUÁRIO", MR, topo + 8.5, { align: "right", charSpace: 0.8 });
    doc.setFont("Lato", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    doc.text(`Emissão: ${emissaoCurta}`, MR, topo + 14.5, { align: "right" });
    doc.setTextColor(...GRAY);
    doc.text(`Válida até: ${validade}`, MR, topo + 18.5, { align: "right" });

    // Identificação do MÉDICO PRESCRITOR (linha destacada).
    const my = topo + 26;
    doc.setFillColor(...LIGHT);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(ML, my, COL, 11, 1.5, 1.5, "FD");
    doc.setFillColor(...CELESTE);
    doc.rect(ML, my, 1.6, 11, "F");
    doc.setFont("Lato", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...NAVY);
    doc.text(`Dr(a). ${medico.nome}`, ML + 5.5, my + 7);
    doc.setFont("Lato", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text(crmTexto, MR - 4, my + 7, { align: "right" });

    return my + 17;
  }

  // ── Cabeçalho compacto das páginas seguintes ────────────────────────────
  function cabecalhoContinuacao(): number {
    doc.setFillColor(...CELESTE);
    doc.rect(0, 0, W, 1.6, "F");
    const logoH = 9;
    if (logos.navy) doc.addImage(logos.navy, "PNG", ML, 8, logoH * LOGO_ASPECTO, logoH);
    doc.setFont("Lato", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text("Blue Senior Living — Receituário (continuação)", ML + (logos.navy ? 9 : 0), 13.5);
    doc.setFont("Lato", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`${hospede.nome}  ·  Dr(a). ${medico.nome}`, MR, 13.5, { align: "right" });
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.line(ML, 18, MR, 18);
    return 26;
  }

  let y = cabecalhoPrincipal();

  // ── Dados do paciente ─────────────────────────────────────────────────────
  doc.setFont("Lato", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  doc.text("PACIENTE", ML, y, { charSpace: 0.8 });
  y += 4.5;

  doc.setFont("Lato", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(hospede.nome, ML, y);

  const cpf = (hospede as Residente & { cpf?: string | null }).cpf;
  const idade = calcularIdade(hospede.data_nascimento);
  const nasc = hospede.data_nascimento
    ? `${formatarDataBR(hospede.data_nascimento)}${idade !== null ? ` (${idade} anos)` : ""}`
    : "Não informado";

  y += 6;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.2);
  doc.line(ML, y, MR, y);
  y += 4.5;

  doc.setFontSize(8.5);
  const campo = (rotulo: string, valor: string, x: number) => {
    doc.setFont("Lato", "bold");
    doc.setTextColor(...GRAY);
    doc.text(rotulo, x, y);
    doc.setFont("Lato", "normal");
    doc.setTextColor(...INK);
    doc.text(valor, x + doc.getTextWidth(rotulo) + 2, y);
  };
  campo("Nascimento:", nasc, ML);
  campo("CPF:", cpf || "Não informado", ML + 72);
  campo("Quarto:", hospede.quarto || "Não informado", ML + 128);

  y += 4;
  doc.setDrawColor(...BORDER);
  doc.line(ML, y, MR, y);
  y += 9;

  // ── Medicamentos (formato clássico de receituário) ───────────────────────
  doc.setFont("Lato", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  const ROTULO_MEDS = "MEDICAMENTOS";
  doc.text(ROTULO_MEDS, ML, y, { charSpace: 0.8 });
  // getTextWidth não inclui o charSpace — soma os espaçamentos entre letras.
  const rotuloW = doc.getTextWidth(ROTULO_MEDS) + (ROTULO_MEDS.length - 1) * 0.8;
  doc.setDrawColor(...CELESTE);
  doc.setLineWidth(0.5);
  doc.line(ML + rotuloW + 3, y - 1, MR, y - 1);
  y += 7;

  const LIMITE_Y = 262; // abaixo disso, quebra de página (reserva p/ rodapé leve)

  for (let i = 0; i < grupos.length; i++) {
    const g = grupos[i];
    const nomeMed = `${g.medicamento.toUpperCase()}${g.dose ? ` ${g.dose}` : ""}`;
    const qtdMensal = calcularMensal(g);
    const posologia = posologiaPorExtenso(g);

    doc.setFont("Lato", "bold");
    doc.setFontSize(10);
    const qtdW = doc.getTextWidth(qtdMensal);
    const nomeMaxW = COL - 10 - qtdW - 8;
    const nomeLinhas: string[] = doc.splitTextToSize(nomeMed, nomeMaxW);

    doc.setFont("Lato", "normal");
    doc.setFontSize(8.5);
    const posLinhas: string[] = doc.splitTextToSize(posologia, COL - 10);

    const altura = nomeLinhas.length * 5 + posLinhas.length * 4.2 + 7;
    if (y + altura > LIMITE_Y) {
      doc.addPage();
      y = cabecalhoContinuacao();
    }

    // Número do item.
    doc.setFont("Lato", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...CELESTE);
    doc.text(`${i + 1}.`, ML, y);

    // Nome em caixa alta + linha pontilhada até a quantidade mensal.
    doc.setTextColor(...NAVY);
    nomeLinhas.forEach((ln, idx) => {
      doc.text(ln, ML + 7, y + idx * 5);
    });
    const ultimaY = y + (nomeLinhas.length - 1) * 5;
    const fimNome = ML + 7 + doc.getTextWidth(nomeLinhas[nomeLinhas.length - 1]);
    const inicioQtd = MR - qtdW;

    // Pontilhado (folga de 2mm de cada lado).
    const pontoW = doc.getTextWidth(".");
    const espaco = inicioQtd - 3 - (fimNome + 2);
    if (espaco > pontoW * 3) {
      doc.setTextColor(...BORDER);
      doc.text(".".repeat(Math.floor(espaco / pontoW)), fimNome + 2, ultimaY);
    }
    doc.setTextColor(...NAVY);
    doc.text(qtdMensal, MR, ultimaY, { align: "right" });

    // Posologia por extenso.
    doc.setFont("Lato", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...INK);
    posLinhas.forEach((ln, idx) => {
      doc.text(ln, ML + 7, ultimaY + 4.8 + idx * 4.2);
    });

    y = ultimaY + 4.8 + posLinhas.length * 4.2 + 6;
  }

  // ── Bloco de assinatura (sempre ao pé da última página) ──────────────────
  const ALT_ASSINATURA = 64;
  const sigTop = H - 16 - ALT_ASSINATURA;
  if (y > sigTop) {
    doc.addPage();
    cabecalhoContinuacao();
  }

  let sy = sigTop;

  // Moldura sutil do rodapé.
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(ML - 3, sy, COL + 6, ALT_ASSINATURA, 2, 2, "S");
  doc.setFillColor(...CELESTE);
  doc.rect(ML - 3, sy, COL + 6, 0.8, "F");

  // Linha de assinatura centralizada (nome + CRM do MÉDICO PRESCRITOR).
  sy += 16;
  const cx = W / 2;
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.4);
  doc.line(cx - 42, sy, cx + 42, sy);
  sy += 5;
  doc.setFont("Lato", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(`Dr(a). ${medico.nome}`, cx, sy, { align: "center" });
  sy += 4.5;
  doc.setFont("Lato", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(crmTexto, cx, sy, { align: "center" });

  // Selo de assinatura eletrônica (caixa navy discreta, com logo e check).
  sy += 8;
  const seloW = 86;
  const seloH = 13;
  const seloX = ML;
  doc.setFillColor(...NAVY);
  doc.roundedRect(seloX, sy, seloW, seloH, 1.5, 1.5, "F");
  if (logos.branco) {
    const lh = 8.5;
    doc.addImage(logos.branco, "PNG", seloX + 3, sy + 2.2, lh * LOGO_ASPECTO, lh);
  }
  // Check de assinatura (vetorial).
  const ckX = seloX + 12;
  const ckY = sy + seloH / 2;
  doc.setDrawColor(...CELESTE);
  doc.setLineWidth(0.9);
  doc.line(ckX, ckY + 0.4, ckX + 1.7, ckY + 2.1);
  doc.line(ckX + 1.7, ckY + 2.1, ckX + 5, ckY - 2.1);
  doc.setFont("Lato", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("ASSINATURA ELETRÔNICA", ckX + 8, sy + 5.4, { charSpace: 0.4 });
  doc.setFont("Lato", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...CELESTE);
  doc.text("Sistema Blue Senior Living", ckX + 8, sy + 9.6);

  // Texto de verificação (honesto: sem alegar certificação digital qualificada).
  doc.setFont("Lato", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...GRAY);
  const verif = doc.splitTextToSize(
    `Documento gerado eletronicamente pelo sistema Blue Senior Living em ${emissaoLonga}. ` +
      `Código de verificação: ${codigo}.`,
    seloW,
  );
  doc.text(verif, seloX, sy + seloH + 4.5);

  // QR code de verificação (vetorial, canto inferior direito).
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "M");
  qr.addData(`BSL-RECEITA|${codigo}|${hojeISO()}|${nomeSanitizado(medico.nome)}`);
  qr.make();
  const modulos = qr.getModuleCount();
  const qrSize = 20;
  const cell = qrSize / modulos;
  const qrX = MR - qrSize;
  const qrY = sy - 2;
  doc.setFillColor(...NAVY);
  for (let r = 0; r < modulos; r++) {
    for (let c = 0; c < modulos; c++) {
      if (qr.isDark(r, c)) doc.rect(qrX + c * cell, qrY + r * cell, cell, cell, "F");
    }
  }
  doc.setFont("Lato", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...GRAY);
  doc.text(codigo, qrX + qrSize / 2, qrY + qrSize + 3.2, { align: "center" });

  return doc;
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Gera as receitas do hóspede como Blobs — UMA POR MÉDICO PRESCRITOR (cada
 * médico assina o que prescreveu). Função ÚNICA de geração, usada pelo botão
 * do Médico e pelo lote da Farmácia. Lança PrescricaoSemMedicoError se algum
 * grupo não tiver médico válido (a receita NÃO é emitida).
 */
export async function gerarReceitasDoHospede(
  hospede: Residente,
  grupos: GrupoPrescricao[],
): Promise<ReceitaGerada[]> {
  const porMedico = await separarPorMedicoPrescritor(grupos);
  const varios = porMedico.length > 1;
  const receitas: ReceitaGerada[] = [];
  for (const lote of porMedico) {
    const doc = await construirReceitaDoc(hospede, lote.grupos, lote.medico);
    receitas.push({
      blob: doc.output("blob"),
      nomeArquivo: nomeArquivoReceita(hospede.nome, varios ? sobrenome(lote.medico.nome) : null),
      medico: lote.medico,
    });
  }
  return receitas;
}

/** Dispara o download de um Blob no navegador. */
export function baixarBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Botão do Médico: gera e BAIXA as receitas do hóspede (uma por médico
 * prescritor). Retorna quantos PDFs foram baixados.
 */
export async function exportarReceitasPDF(
  hospede: Residente,
  grupos: GrupoPrescricao[],
): Promise<number> {
  const receitas = await gerarReceitasDoHospede(hospede, grupos);
  for (const r of receitas) baixarBlob(r.blob, r.nomeArquivo);
  return receitas.length;
}

// ─── Texto copiável (pronto para colar no site do CFM) ─────────────────────────

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

  const detalhes = lins
    .map((l) => `${PERIODO_FRASE[l.periodo] ?? l.periodo}: ${l.quantidade || "—"}`)
    .join(", ");
  return freq ? `${detalhes} (${freq})` : detalhes;
}

/**
 * Texto corrido de todas as medicações ativas, formatado para colar na
 * prescrição eletrônica do CFM. "NOME DOSE ------------ X unidade" + posologia.
 */
export function gerarTextoPrescricao(grupos: GrupoPrescricao[]): string {
  if (grupos.length === 0) return "Nenhuma prescrição ativa.";

  return grupos
    .map((g) => {
      const nomeDose = g.medicamento + (g.dose ? ` ${g.dose}` : "");
      const mensal = calcularMensalDetalhado(g);
      const qtdTexto = mensal
        ? `${formatarNumero(mensal.valor)} ${pluralizar(mensal.valor, mensal.unidade)}`
        : "—";

      return `${nomeDose} ------------ ${qtdTexto}\n${gerarPosologiaTexto(g)}`;
    })
    .join("\n\n");
}

/** Copia o texto da prescrição para a área de transferência. */
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
