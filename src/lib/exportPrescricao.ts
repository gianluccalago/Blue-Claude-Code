import { jsPDF } from "jspdf";
import type { GrupoPrescricao } from "@/hooks/useMedico";
import type { Residente } from "@/types/database";
import { formatarDataBR } from "@/lib/utils";

// TODO: quando houver autenticação, substituir pelo médico logado via auth context
//       (buscar usuario logado, verificar perfil "medico", usar nome + registro_profissional)
const MEDICO_FIXO = { nome: "Dr. Gianlucca Lagomarsino", crm: "CRM-PR 54.260" };

// ─── Constantes de exibição ───────────────────────────────────────────────────

const VIA_EXTENSO: Record<string, string> = {
  oral: "VO",
  injetavel: "Injetavel",
  insulina: "Insulina (SC)",
  sonda: "Sonda",
};

// Versão com acentos para TXT (UTF-8 perfeito)
const VIA_EXTENSO_UTF8: Record<string, string> = {
  oral: "VO",
  injetavel: "Injetável",
  insulina: "Insulina (SC)",
  sonda: "Sonda",
};

const PERIODO_LABEL: Record<string, string> = {
  jejum: "Jejum",
  manha: "Manha",
  almoco: "Almoco",
  apos_almoco: "Apos almoco",
  tarde: "Tarde",
  noite: "Noite",
};

const PERIODO_LABEL_UTF8: Record<string, string> = {
  jejum: "Jejum",
  manha: "Manhã",
  almoco: "Almoço",
  apos_almoco: "Após almoço",
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
  const data = new Date().toISOString().slice(0, 10);
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

function calcularMensal(grupo: GrupoPrescricao): string {
  let total = 0;
  let unidade = "";
  for (const l of grupo.linhas) {
    const p = parsearQuantidade(l.quantidade);
    if (p) {
      total += p.numero;
      if (!unidade) unidade = p.unidade;
    }
  }
  if (total === 0) return "—";
  const mensal = total * 30;
  const valor = Number.isInteger(mensal) ? mensal.toString() : mensal.toFixed(1);
  return `${valor} ${unidade}`;
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

export function exportarPrescricaoPDF(
  hospede: Residente,
  grupos: GrupoPrescricao[],
): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const agora = new Date();
  const emissao = dataHoraEmissao(agora);
  const hash = gerarHash();

  const NAVY: RGB = [32, 82, 121];
  const CELESTE: RGB = [92, 191, 229];
  const LIGHT_BLUE: RGB = [236, 246, 251];
  const GRAY: RGB = [107, 114, 128];
  const DARK: RGB = [28, 50, 70];
  const WHITE: RGB = [255, 255, 255];
  const BORDER: RGB = [200, 220, 235];

  const W = 210;
  const L = 20;
  const R = W - 20;
  const COL = R - L;

  let y = 0;

  // ── Cabeçalho navy ────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 44, "F");

  // Linha de destaque esquerda (celeste)
  doc.setFillColor(...CELESTE);
  doc.rect(0, 0, 4, 44, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(...WHITE);
  doc.text("BLUE SENIOR LIVING", L + 1, 17);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...CELESTE);
  doc.text("Prescricao Medica", L + 1, 27);

  doc.setDrawColor(...CELESTE);
  doc.setLineWidth(0.4);
  doc.line(L, 32, R, 32);

  doc.setFontSize(8.5);
  doc.setTextColor(180, 210, 230);
  doc.text(`Emitida em: ${emissao}`, R, 38, { align: "right" });

  y = 54;

  // ── Dados do paciente ─────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT_BLUE);
  doc.setDrawColor(...CELESTE);
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
    doc.setTextColor(...DARK);
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

    // Fundo do bloco
    doc.setFillColor(...WHITE);
    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.2);
    doc.roundedRect(L, y, COL, altBloco, 2, 2, "FD");

    // Barra lateral colorida (celeste ou navy dependendo da via)
    const barraColor: RGB = g.via === "oral" ? CELESTE : NAVY;
    doc.setFillColor(...barraColor);
    doc.roundedRect(L, y, 3, altBloco, 2, 2, "F");

    // Número do medicamento
    doc.setFillColor(...NAVY);
    doc.setDrawColor(...NAVY);
    doc.roundedRect(L + 6, y + 4, 7, 6, 1, 1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...WHITE);
    doc.text(String(i + 1), L + 9.5, y + 8.2, { align: "center" });

    // Nome + dose
    const nomeMed = g.medicamento + (g.dose ? ` ${g.dose}` : "");
    const nomeSplit = doc.splitTextToSize(nomeMed, COL - 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...DARK);
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

      doc.setFillColor(...LIGHT_BLUE);
      doc.roundedRect(L + 6, py - 4, 38, 5.5, 1, 1, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...NAVY);
      doc.text(`${pLabel} (${pHora})`, L + 7.5, py);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...DARK);
      doc.text(qtd, L + 48, py);

      py += 6;
    }

    // Quantidade mensal
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(...CELESTE);
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
  doc.setLineWidth(0.5);
  doc.line(L, y, R, y);
  y += 7;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("Assinatura eletronica do medico assistente", L, y);

  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK);
  doc.text(`${MEDICO_FIXO.nome}  —  ${MEDICO_FIXO.crm}`, L, y);

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

  doc.save(nomeArquivo(hospede.nome, "pdf"));
}

// ─── TXT ─────────────────────────────────────────────────────────────────────

export function exportarPrescricaoTXT(
  hospede: Residente,
  grupos: GrupoPrescricao[],
): void {
  const agora = new Date();
  const emissao = dataHoraEmissao(agora);
  const hash = gerarHash();
  const cpf = (hospede as Residente & { cpf?: string | null }).cpf;
  const dataNasc = hospede.data_nascimento ? formatarDataBR(hospede.data_nascimento) : "Não informado";
  const sep = "=".repeat(60);
  const subSep = "-".repeat(60);

  const linhas: string[] = [
    sep,
    "BLUE SENIOR LIVING",
    "PRESCRIÇÃO MÉDICA",
    sep,
    `Paciente:    ${hospede.nome}`,
    `CPF:         ${cpf || "Não informado"}`,
    `Nascimento:  ${dataNasc}`,
    `Quarto:      ${hospede.quarto || "Não informado"}`,
    `Emissão:     ${emissao}`,
    sep,
    "",
    "MEDICAMENTOS PRESCRITOS",
    subSep,
    "",
  ];

  grupos.forEach((g, i) => {
    const lins = linhasOrdenadas(g);
    const mensal = calcularMensal(g);
    const via = VIA_EXTENSO_UTF8[g.via] || g.via;

    const periodos = lins
      .map((l) => {
        const label = PERIODO_LABEL_UTF8[l.periodo] ?? l.periodo;
        const hora = PERIODO_HORARIO[l.periodo] ?? "";
        const qtd = l.quantidade || "—";
        return `${label} (${hora}): ${qtd}`;
      })
      .join(", ");

    linhas.push(
      `${i + 1}. ${g.medicamento}${g.dose ? ` ${g.dose}` : ""} — ${via} — ${g.posologia || "—"}`,
    );
    linhas.push(`   Períodos: ${periodos}`);
    linhas.push(`   Quantidade mensal (x30): ${mensal}`);
    linhas.push("");
  });

  if (grupos.length === 0) {
    linhas.push("Nenhuma prescrição ativa.");
    linhas.push("");
  }

  linhas.push(sep);
  linhas.push("Assinatura eletrônica do médico assistente");
  linhas.push(`${MEDICO_FIXO.nome} — ${MEDICO_FIXO.crm}`);
  linhas.push(`Hash: ${hash}`);
  linhas.push(`Emitida em: ${emissao}`);
  linhas.push(sep);

  const blob = new Blob([linhas.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo(hospede.nome, "txt");
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
