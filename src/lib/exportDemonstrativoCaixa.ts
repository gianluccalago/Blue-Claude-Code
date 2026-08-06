import type { jsPDF } from "jspdf";
import {
  NAVY, CELESTE, INK, GRAY, LIGHT, BORDER, W, H, ML, MR, COL, LOGO_ASPECTO,
  obterLogos, registrarFontes, hashConteudo, desenharQr, desenharSeloAssinatura,
} from "@/lib/pdf/base";
import { INSTITUICAO_RELATORIO } from "@/lib/relatorioSanitario";
import {
  SOCIO_ASSINATURA, rotuloMesExtenso, type ConsolidadoAno, type ResumoMesExtrato,
} from "@/lib/extratoSocios";

// ===========================================================================
// DEMONSTRATIVO DE CAIXA (PDF) — contas Seniors Care, SEMPRE regime de caixa.
// Mesma identidade visual (papel timbrado) da Receita Médica e do Relatório
// Sanitário; assinatura eletrônica institucional do SÓCIO-DIRETOR + hash.
// Mensal: saldo inicial → entradas/movimentações societárias → saídas →
// saldo final. Anual: resumo mês a mês + consolidado por rubrica.
// ===========================================================================

const VERMELHO: [number, number, number] = [176, 58, 58];

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function dataHora(d: Date): string {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export interface DemonstrativoGerado {
  blob: Blob;
  hash: string;
  nomeArquivo: string;
}

interface Ctx { doc: jsPDF; y: number; pagina: number; periodoTxt: string }

function cabecalhoPagina(ctx: Ctx, logoNavy: string | null, continuacao: boolean) {
  const { doc } = ctx;
  doc.setFillColor(...CELESTE); doc.rect(0, 0, W, 2.2, "F");
  doc.setFillColor(...NAVY); doc.rect(0, 2.2, W, 0.7, "F");
  const topo = 13;
  const logoH = continuacao ? 13 : 21;
  const logoW = logoH * LOGO_ASPECTO;
  if (logoNavy) doc.addImage(logoNavy, "PNG", ML, topo, logoW, logoH);
  const tx = ML + (logoNavy ? logoW + 5 : 0);
  doc.setFont("Lato", "bold"); doc.setFontSize(continuacao ? 13 : 17); doc.setTextColor(...NAVY);
  doc.text("BLUE", tx, topo + (continuacao ? 6.5 : 8.5), { charSpace: 1.2 });
  doc.setFont("Lato", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY);
  doc.text("SENIOR LIVING", tx, topo + (continuacao ? 10.5 : 12.5), { charSpace: 1.6 });
  if (!continuacao) {
    doc.setFontSize(7.5);
    doc.text(INSTITUICAO_RELATORIO.endereco, tx, topo + 18);
    doc.text(INSTITUICAO_RELATORIO.cidade, tx, topo + 21.5);
  }
  doc.setFont("Lato", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
  doc.text("DEMONSTRATIVO DE CAIXA", MR, topo + 8, { align: "right", charSpace: 0.4 });
  doc.setFont("Lato", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("Seniors Care Ltda. · regime de caixa", MR, topo + 12.5, { align: "right" });
  if (continuacao) {
    doc.setFontSize(7.5);
    doc.text(`${ctx.periodoTxt} — continuação (pág. ${ctx.pagina})`, MR, topo + 16.5, { align: "right" });
  }
  ctx.y = topo + (continuacao ? 22 : 27);
}

function quebraSePreciso(ctx: Ctx, logoNavy: string | null, alturaNecessaria: number, limite = H - 20) {
  if (ctx.y + alturaNecessaria <= limite) return;
  ctx.doc.addPage();
  ctx.pagina += 1;
  cabecalhoPagina(ctx, logoNavy, true);
}

function faixaPeriodo(ctx: Ctx, extraidoTxt: string) {
  const { doc } = ctx;
  doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.roundedRect(ML, ctx.y, COL, 11, 1.5, 1.5, "FD");
  doc.setFillColor(...CELESTE); doc.rect(ML, ctx.y, 1.6, 11, "F");
  doc.setFont("Lato", "bold"); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
  doc.text(`Período: ${ctx.periodoTxt}`, ML + 5.5, ctx.y + 7);
  doc.setFont("Lato", "normal"); doc.setFontSize(8); doc.setTextColor(...INK);
  doc.text(`Extraído em: ${extraidoTxt}`, MR - 4, ctx.y + 7, { align: "right" });
  ctx.y += 18;
}

function tituloSecao(ctx: Ctx, txt: string) {
  const { doc } = ctx;
  doc.setFont("Lato", "bold"); doc.setFontSize(7); doc.setTextColor(...GRAY);
  doc.text(txt.toUpperCase(), ML, ctx.y, { charSpace: 0.8 });
  const wTxt = doc.getTextWidth(txt.toUpperCase()) + (txt.length - 1) * 0.8;
  doc.setDrawColor(...CELESTE); doc.setLineWidth(0.5);
  doc.line(ML + wTxt + 3, ctx.y - 1, MR, ctx.y - 1);
  ctx.y += 6;
}

function linhaValor(ctx: Ctx, rotulo: string, valor: number, opts: { negrito?: boolean; recuo?: number } = {}) {
  const { doc } = ctx;
  doc.setFont("Lato", opts.negrito ? "bold" : "normal");
  doc.setFontSize(8.6);
  doc.setTextColor(...INK);
  doc.text(rotulo, ML + (opts.recuo ?? 0), ctx.y, { maxWidth: COL - 40 });
  doc.setFont("Lato", opts.negrito ? "bold" : "normal");
  doc.setTextColor(...(valor < 0 ? VERMELHO : NAVY));
  doc.text(fmtBRL(valor), MR, ctx.y, { align: "right" });
  ctx.y += 5.4;
}

function linhaSubtotal(ctx: Ctx, rotulo: string, valor: number) {
  const { doc } = ctx;
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.line(ML, ctx.y - 3.4, MR, ctx.y - 3.4);
  doc.setFont("Lato", "bold"); doc.setFontSize(8.8); doc.setTextColor(...INK);
  doc.text(rotulo, ML, ctx.y);
  doc.setTextColor(...(valor < 0 ? VERMELHO : NAVY));
  doc.text(fmtBRL(valor), MR, ctx.y, { align: "right" });
  ctx.y += 7;
}

function caixaDestaque(ctx: Ctx, rotulo: string, valor: number) {
  const { doc } = ctx;
  doc.setFillColor(...NAVY);
  doc.roundedRect(ML, ctx.y - 4.5, COL, 10.5, 1.5, 1.5, "F");
  doc.setFont("Lato", "bold"); doc.setFontSize(9.5); doc.setTextColor(255, 255, 255);
  doc.text(rotulo, ML + 5, ctx.y + 2);
  doc.setTextColor(...CELESTE);
  doc.text(fmtBRL(valor), MR - 5, ctx.y + 2, { align: "right" });
  ctx.y += 13;
}

function blocoMes(ctx: Ctx, logoNavy: string | null, r: ResumoMesExtrato, comTitulos = true) {
  quebraSePreciso(ctx, logoNavy, 20);
  linhaValor(ctx, `Saldo inicial de caixa (${rotuloMesExtenso(r.mes)})`, r.saldoInicial, { negrito: true });
  ctx.y += 2;
  if (comTitulos) tituloSecao(ctx, "Entradas e movimentações societárias");
  for (const l of r.entradas) {
    quebraSePreciso(ctx, logoNavy, 8);
    linhaValor(ctx, l.rotulo, l.valor, { recuo: 3 });
  }
  quebraSePreciso(ctx, logoNavy, 10);
  linhaSubtotal(ctx, "Total de entradas e movimentações", r.totalEntradas);
  if (comTitulos) tituloSecao(ctx, "Saídas");
  for (const l of r.saidas) {
    quebraSePreciso(ctx, logoNavy, 8);
    linhaValor(ctx, l.rotulo, l.valor, { recuo: 3 });
  }
  quebraSePreciso(ctx, logoNavy, 10);
  linhaSubtotal(ctx, "Total de saídas", r.totalSaidas);
  quebraSePreciso(ctx, logoNavy, 14);
  caixaDestaque(ctx, "SALDO FINAL DE CAIXA (banco + aplicações)", r.saldoFinal);
}

function assinatura(ctx: Ctx, logoBranco: string | null, extraidoTxt: string, hash: string, chaveQr: string) {
  const { doc } = ctx;
  const ALT = 58;
  // Garante espaço na página atual; senão, nova página.
  if (ctx.y > H - 14 - ALT) { doc.addPage(); ctx.pagina += 1; ctx.y = 20; }
  const sy0 = H - 14 - ALT;
  let sy = sy0;
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.roundedRect(ML - 3, sy, COL + 6, ALT, 2, 2, "S");
  doc.setFillColor(...CELESTE); doc.rect(ML - 3, sy, COL + 6, 0.8, "F");

  sy += 12;
  const cx = W / 2;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.4);
  doc.line(cx - 48, sy, cx + 48, sy);
  sy += 5;
  doc.setFont("Lato", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY);
  doc.text(SOCIO_ASSINATURA.nome, cx, sy, { align: "center" });
  sy += 4.3;
  doc.setFont("Lato", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK);
  doc.text(`${SOCIO_ASSINATURA.cargo} · CPF ${SOCIO_ASSINATURA.cpf}`, cx, sy, { align: "center" });
  sy += 4;
  doc.setFont("Lato", "italic"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
  doc.text(SOCIO_ASSINATURA.empresa, cx, sy, { align: "center" });

  sy += 5.5;
  desenharSeloAssinatura(doc, logoBranco, ML, sy, 86);
  doc.setFont("Lato", "normal"); doc.setFontSize(6.8); doc.setTextColor(...GRAY);
  const verif = doc.splitTextToSize(
    `Documento gerado eletronicamente pelo sistema Blue Senior Living em ${extraidoTxt}. ` +
      `Hash de verificação: ${hash}. Assinatura eletrônica institucional (sem certificação digital qualificada).`,
    86,
  );
  doc.text(verif, ML, sy + 16.5);
  return { qrX: MR - 20, qrY: sy - 1, qrSize: 20, chaveQr };
}

// ── MENSAL ──────────────────────────────────────────────────────────────────
export async function gerarDemonstrativoMensalPdf(r: ResumoMesExtrato, extraidoEm: Date): Promise<DemonstrativoGerado> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registrarFontes(doc);
  const logos = await obterLogos();
  const periodoTxt = rotuloMesExtenso(r.mes);
  const extraidoTxt = dataHora(extraidoEm);
  const hash = hashConteudo(JSON.stringify(r) + `|${extraidoEm.toISOString()}`);

  const ctx: Ctx = { doc, y: 0, pagina: 1, periodoTxt };
  cabecalhoPagina(ctx, logos.navy, false);
  faixaPeriodo(ctx, extraidoTxt);
  blocoMes(ctx, logos.navy, r);

  const qr = assinatura(ctx, logos.branco, extraidoTxt, hash, `BSL-CAIXA|${hash}|${r.mes}`);
  await desenharQr(doc, qr.chaveQr, qr.qrX, qr.qrY, qr.qrSize);
  doc.setFont("Lato", "normal"); doc.setFontSize(6); doc.setTextColor(...GRAY);
  doc.text(hash.slice(0, 19), qr.qrX + qr.qrSize / 2, qr.qrY + qr.qrSize + 3, { align: "center" });

  return { blob: doc.output("blob"), hash, nomeArquivo: `demonstrativo_caixa_${r.mes}.pdf` };
}

// ── ANUAL ───────────────────────────────────────────────────────────────────
export async function gerarDemonstrativoAnualPdf(c: ConsolidadoAno, extraidoEm: Date): Promise<DemonstrativoGerado> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registrarFontes(doc);
  const logos = await obterLogos();
  const periodoTxt = `Ano de ${c.ano}`;
  const extraidoTxt = dataHora(extraidoEm);
  const hash = hashConteudo(JSON.stringify(c) + `|${extraidoEm.toISOString()}`);

  const ctx: Ctx = { doc, y: 0, pagina: 1, periodoTxt };
  cabecalhoPagina(ctx, logos.navy, false);
  faixaPeriodo(ctx, extraidoTxt);

  // Resumo mês a mês
  tituloSecao(ctx, "Resumo mês a mês");
  const xIni = ML + 42, xEnt = xIni + 33, xSai = xEnt + 33, xFim = MR;
  doc.setFont("Lato", "bold"); doc.setFontSize(7); doc.setTextColor(...GRAY);
  doc.text("Mês", ML, ctx.y);
  doc.text("Saldo inicial", xIni, ctx.y, { align: "right" });
  doc.text("Entradas/mov.", xEnt, ctx.y, { align: "right" });
  doc.text("Saídas", xSai, ctx.y, { align: "right" });
  doc.text("Saldo final", xFim, ctx.y, { align: "right" });
  ctx.y += 4.5;
  const num = (v: number, x: number, cor: [number, number, number]) => {
    doc.setTextColor(...cor);
    doc.text(v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), x, ctx.y, { align: "right" });
  };
  for (const m of c.meses) {
    quebraSePreciso(ctx, logos.navy, 8);
    doc.setFont("Lato", "normal"); doc.setFontSize(8); doc.setTextColor(...INK);
    doc.text(rotuloMesExtenso(m.mes), ML, ctx.y);
    num(m.saldoInicial, xIni, INK);
    num(m.totalEntradas, xEnt, m.totalEntradas < 0 ? VERMELHO : NAVY);
    num(m.totalSaidas, xSai, VERMELHO);
    doc.setFont("Lato", "bold");
    num(m.saldoFinal, xFim, m.saldoFinal < 0 ? VERMELHO : NAVY);
    ctx.y += 5.2;
  }
  ctx.y += 2;
  quebraSePreciso(ctx, logos.navy, 26);
  linhaSubtotal(ctx, "Total de entradas e movimentações do ano", c.totalEntradas);
  linhaSubtotal(ctx, "Total de saídas do ano", c.totalSaidas);
  caixaDestaque(ctx, `SALDO FINAL DE CAIXA — ${c.meses[c.meses.length - 1] ? rotuloMesExtenso(c.meses[c.meses.length - 1].mes) : c.ano}`, c.saldoFinal);
  ctx.y += 2;

  // Consolidado por rubrica
  quebraSePreciso(ctx, logos.navy, 24);
  tituloSecao(ctx, "Consolidado do ano — entradas e movimentações societárias");
  for (const r of c.porRubricaEntrada) {
    quebraSePreciso(ctx, logos.navy, 8);
    linhaValor(ctx, r.rotulo, r.valor, { recuo: 3 });
  }
  ctx.y += 2;
  quebraSePreciso(ctx, logos.navy, 16);
  tituloSecao(ctx, "Consolidado do ano — saídas");
  for (const r of c.porRubricaSaida) {
    quebraSePreciso(ctx, logos.navy, 8);
    linhaValor(ctx, r.rotulo, r.valor, { recuo: 3 });
  }

  const qr = assinatura(ctx, logos.branco, extraidoTxt, hash, `BSL-CAIXA|${hash}|${c.ano}`);
  await desenharQr(doc, qr.chaveQr, qr.qrX, qr.qrY, qr.qrSize);
  doc.setFont("Lato", "normal"); doc.setFontSize(6); doc.setTextColor(...GRAY);
  doc.text(hash.slice(0, 19), qr.qrX + qr.qrSize / 2, qr.qrY + qr.qrSize + 3, { align: "center" });

  return { blob: doc.output("blob"), hash, nomeArquivo: `demonstrativo_caixa_${c.ano}.pdf` };
}
