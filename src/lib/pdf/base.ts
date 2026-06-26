import type { jsPDF } from "jspdf";

// ===========================================================================
// Primitivos compartilhados de PDF (logo, fontes, cores, selo de assinatura,
// QR, hash) — mesma identidade visual da Receita Médica. Extraídos para reuso
// pelo Relatório Sanitário SEM alterar o gerador da receita.
//
// HONESTIDADE: a assinatura é ELETRÔNICA institucional (carimbo + hash de
// verificação interno). NÃO é assinatura digital ICP-Brasil / MP 2.200-2.
// ===========================================================================

export type RGB = [number, number, number];
export const NAVY: RGB = [28, 74, 110];
export const CELESTE: RGB = [92, 191, 229];
export const INK: RGB = [52, 64, 80];
export const GRAY: RGB = [120, 132, 146];
export const LIGHT: RGB = [238, 247, 252];
export const BORDER: RGB = [200, 222, 236];

export const W = 210;
export const H = 297;
export const ML = 20;
export const MR = 190;
export const COL = MR - ML;

// viewBox do logo.svg: 255.3 x 399.
export const LOGO_ASPECTO = 255.3 / 399;

let logoCache: { navy: string | null; branco: string | null } | null = null;

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
      img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
      img.src = url;
    } catch {
      resolve(null);
    }
  });
}

export async function obterLogos(): Promise<{ navy: string | null; branco: string | null }> {
  if (logoCache) return logoCache;
  try {
    if (typeof document === "undefined") throw new Error("sem DOM");
    const svg = await (await fetch("/logo.svg")).text();
    const svgBranco = svg.replace(/fill="#1b3a5c"/gi, 'fill="#ffffff"');
    const [navy, branco] = await Promise.all([rasterizarSvg(svg, 600), rasterizarSvg(svgBranco, 300)]);
    logoCache = { navy, branco };
  } catch {
    logoCache = { navy: null, branco: null };
  }
  return logoCache;
}

export async function registrarFontes(doc: jsPDF): Promise<void> {
  const { LATO_REGULAR, LATO_BOLD, LATO_ITALIC } = await import("@/lib/pdf/fontesLato");
  doc.addFileToVFS("Lato-Regular.ttf", LATO_REGULAR);
  doc.addFont("Lato-Regular.ttf", "Lato", "normal");
  doc.addFileToVFS("Lato-Bold.ttf", LATO_BOLD);
  doc.addFont("Lato-Bold.ttf", "Lato", "bold");
  doc.addFileToVFS("Lato-Italic.ttf", LATO_ITALIC);
  doc.addFont("Lato-Italic.ttf", "Lato", "italic");
}

/** Hash de verificação DETERMINÍSTICO do conteúdo (FNV-1a, 16 hex em blocos). */
export function hashConteudo(texto: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let h2 = (h ^ 0x9e3779b9) >>> 0;
  for (let i = texto.length - 1; i >= 0; i--) {
    h2 ^= texto.charCodeAt(i);
    h2 = Math.imul(h2, 0x01000193);
  }
  const hex = ((h >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0")).toUpperCase();
  return hex.replace(/(.{4})(?=.)/g, "$1-");
}

/** Desenha um QR vetorial (módulos navy) no documento. */
export async function desenharQr(doc: jsPDF, texto: string, x: number, y: number, size: number): Promise<void> {
  const { default: qrcode } = await import("qrcode-generator");
  const qr = qrcode(0, "M");
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const cell = size / n;
  doc.setFillColor(...NAVY);
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) doc.rect(x + c * cell, y + r * cell, cell, cell, "F");
    }
  }
}

/** Selo navy de "assinatura eletrônica" (logo branco + check). */
export function desenharSeloAssinatura(doc: jsPDF, logoBranco: string | null, x: number, y: number, largura = 86): void {
  const seloH = 13;
  doc.setFillColor(...NAVY);
  doc.roundedRect(x, y, largura, seloH, 1.5, 1.5, "F");
  if (logoBranco) {
    const lh = 8.5;
    doc.addImage(logoBranco, "PNG", x + 3, y + 2.2, lh * LOGO_ASPECTO, lh);
  }
  const ckX = x + 12;
  const ckY = y + seloH / 2;
  doc.setDrawColor(...CELESTE);
  doc.setLineWidth(0.9);
  doc.line(ckX, ckY + 0.4, ckX + 1.7, ckY + 2.1);
  doc.line(ckX + 1.7, ckY + 2.1, ckX + 5, ckY - 2.1);
  doc.setFont("Lato", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text("ASSINATURA ELETRÔNICA", ckX + 8, y + 5.4, { charSpace: 0.4 });
  doc.setFont("Lato", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...CELESTE);
  doc.text("Sistema Blue Senior Living", ckX + 8, y + 9.6);
}
