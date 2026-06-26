import type { jsPDF } from "jspdf";
import {
  NAVY, CELESTE, INK, GRAY, LIGHT, BORDER, W, H, ML, MR, COL, LOGO_ASPECTO,
  obterLogos, registrarFontes, hashConteudo, desenharQr, desenharSeloAssinatura,
} from "@/lib/pdf/base";
import {
  RT_ASSINATURA, INSTITUICAO_RELATORIO, fmtTaxa, rotuloPeriodo,
  type ValoresRelatorio, type PeriodoTipo,
} from "@/lib/relatorioSanitario";

// ===========================================================================
// RELATÓRIO SANITÁRIO (PDF) — Indicadores RDC 502/2021. Mesma identidade da
// Receita Médica. Documento de VALIDAÇÃO do RT (assinatura eletrônica
// institucional + hash de verificação interno). NÃO há trilha de edição no PDF.
// ===========================================================================

export interface MetaRelatorio {
  tipo: PeriodoTipo;
  inicio: string;
  fim: string;
  extraidoEm: Date;
}

function dataHora(d: Date): string {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export interface RelatorioGerado {
  blob: Blob;
  hash: string;
  nomeArquivo: string;
}

export async function gerarRelatorioSanitarioPdf(valores: ValoresRelatorio, meta: MetaRelatorio): Promise<RelatorioGerado> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registrarFontes(doc);
  const logos = await obterLogos();

  const periodoTxt = rotuloPeriodo(meta.tipo, meta.inicio, meta.fim);
  const extraidoTxt = dataHora(meta.extraidoEm);
  const hash = hashConteudo(JSON.stringify(valores) + `|${meta.inicio}|${meta.fim}|${meta.extraidoEm.toISOString()}`);

  // ── Cabeçalho ─────────────────────────────────────────────────────────────
  doc.setFillColor(...CELESTE); doc.rect(0, 0, W, 2.2, "F");
  doc.setFillColor(...NAVY); doc.rect(0, 2.2, W, 0.7, "F");

  const topo = 13;
  const logoH = 21;
  const logoW = logoH * LOGO_ASPECTO;
  if (logos.navy) doc.addImage(logos.navy, "PNG", ML, topo, logoW, logoH);
  const tx = ML + (logos.navy ? logoW + 5 : 0);
  doc.setFont("Lato", "bold"); doc.setFontSize(17); doc.setTextColor(...NAVY);
  doc.text("BLUE", tx, topo + 8.5, { charSpace: 1.2 });
  doc.setFont("Lato", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY);
  doc.text("SENIOR LIVING", tx, topo + 12.5, { charSpace: 1.6 });
  doc.setFontSize(7.5);
  doc.text(INSTITUICAO_RELATORIO.endereco, tx, topo + 18);
  doc.text(INSTITUICAO_RELATORIO.cidade, tx, topo + 21.5);

  doc.setFont("Lato", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
  doc.text("RELATÓRIO SANITÁRIO", MR, topo + 8, { align: "right", charSpace: 0.4 });
  doc.setFont("Lato", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
  doc.text("Indicadores RDC 502/2021", MR, topo + 12.5, { align: "right" });

  // Faixa de período/extração.
  let y = topo + 27;
  doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, COL, 11, 1.5, 1.5, "FD");
  doc.setFillColor(...CELESTE); doc.rect(ML, y, 1.6, 11, "F");
  doc.setFont("Lato", "bold"); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
  doc.text(`Período: ${periodoTxt}`, ML + 5.5, y + 7);
  doc.setFont("Lato", "normal"); doc.setFontSize(8); doc.setTextColor(...INK);
  doc.text(`Extraído em: ${extraidoTxt}`, MR - 4, y + 7, { align: "right" });
  y += 18;

  // ── Tabela de indicadores ─────────────────────────────────────────────────
  const xNum = MR - 66, xDen = MR - 33, xTaxa = MR;

  function tituloSecao(txt: string) {
    doc.setFont("Lato", "bold"); doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text(txt.toUpperCase(), ML, y, { charSpace: 0.8 });
    const wTxt = doc.getTextWidth(txt.toUpperCase()) + (txt.length - 1) * 0.8;
    doc.setDrawColor(...CELESTE); doc.setLineWidth(0.5);
    doc.line(ML + wTxt + 3, y - 1, MR, y - 1);
    y += 6;
  }
  function cabecalhoTabela() {
    doc.setFont("Lato", "bold"); doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text("Numerador", xNum, y, { align: "right" });
    doc.text("Denominador", xDen, y, { align: "right" });
    doc.text("Taxa", xTaxa, y, { align: "right" });
    y += 4.5;
  }
  function linhaTaxa(label: string, num: number, den: number, taxa: number) {
    doc.setFont("Lato", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK);
    doc.text(label, ML, y, { maxWidth: xNum - ML - 6 });
    doc.setTextColor(...NAVY);
    doc.text(String(num), xNum, y, { align: "right" });
    doc.text(String(den), xDen, y, { align: "right" });
    doc.setFont("Lato", "bold");
    doc.text(`${fmtTaxa(taxa)}%`, xTaxa, y, { align: "right" });
    y += 6;
  }
  function linhaValor(label: string, valor: string) {
    doc.setFont("Lato", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK);
    doc.text(label, ML, y);
    doc.setFont("Lato", "bold"); doc.setTextColor(...NAVY);
    doc.text(valor, MR, y, { align: "right" });
    y += 5.6;
  }

  tituloSecao("Indicadores obrigatórios (RDC 502 — Anexo)");
  doc.setFont("Lato", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY);
  doc.text("Denominador = nº de residentes no dia 15 (população de referência).", ML, y);
  y += 4.5;
  cabecalhoTabela();
  for (const ind of valores.obrigatorios) linhaTaxa(ind.label, ind.numerador, ind.denominador, ind.taxa);
  y += 3;

  tituloSecao("Indicadores complementares");
  linhaTaxa("Taxa de ocupação", valores.ocupacao.numerador, valores.ocupacao.denominador, valores.ocupacao.taxa);
  linhaValor("Nº de residentes (dia 15)", String(valores.residentesDia15));
  linhaValor("Entradas no período", String(valores.entradas));
  linhaValor("Saídas no período", String(valores.saidas));
  linhaValor("Grau de dependência (I / II / III / sem grau)", `${valores.grauI} / ${valores.grauII} / ${valores.grauIII} / ${valores.grauSemGrau}`);
  y += 2;
  tituloSecao("Eventos sentinela (período)");
  linhaValor("Quedas com lesão (notificadas)", `${valores.sentinelaQuedaTotal} (${valores.sentinelaQuedaNotif})`);
  linhaValor("Tentativas de suicídio (notificadas)", `${valores.sentinelaSuicidioTotal} (${valores.sentinelaSuicidioNotif})`);
  linhaValor("Doenças de notificação compulsória (notificadas)", `${valores.sentinelaDoencaTotal} (${valores.sentinelaDoencaNotif})`);

  // ── Rodapé: assinatura do RT ──────────────────────────────────────────────
  const ALT = 62;
  const sy0 = H - 14 - ALT;
  let sy = sy0;
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.roundedRect(ML - 3, sy, COL + 6, ALT, 2, 2, "S");
  doc.setFillColor(...CELESTE); doc.rect(ML - 3, sy, COL + 6, 0.8, "F");

  sy += 14;
  const cx = W / 2;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.4);
  doc.line(cx - 42, sy, cx + 42, sy);
  sy += 5;
  doc.setFont("Lato", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY);
  doc.text(RT_ASSINATURA.nome, cx, sy, { align: "center" });
  sy += 4.3;
  doc.setFont("Lato", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK);
  doc.text(`Responsável Técnico · ${RT_ASSINATURA.crm} · CPF ${RT_ASSINATURA.cpf}`, cx, sy, { align: "center" });
  sy += 4.2;
  doc.setFont("Lato", "italic"); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
  doc.text("Relatório consolidado, revisado e validado pelo Responsável Técnico.", cx, sy, { align: "center" });

  // Selo + hash + QR.
  sy += 6;
  desenharSeloAssinatura(doc, logos.branco, ML, sy, 86);
  doc.setFont("Lato", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY);
  const verif = doc.splitTextToSize(
    `Documento gerado eletronicamente pelo sistema Blue Senior Living em ${extraidoTxt}. ` +
      `Hash de verificação: ${hash}. Assinatura eletrônica institucional (sem certificação digital qualificada).`,
    86,
  );
  doc.text(verif, ML, sy + 17);

  const qrSize = 20;
  const qrX = MR - qrSize, qrY = sy - 1;
  await desenharQr(doc, `BSL-RELSAN|${hash}|${meta.inicio}|${meta.fim}`, qrX, qrY, qrSize);
  doc.setFont("Lato", "normal"); doc.setFontSize(6); doc.setTextColor(...GRAY);
  doc.text(hash.slice(0, 19), qrX + qrSize / 2, qrY + qrSize + 3, { align: "center" });

  const nomeArquivo = `relatorio_sanitario_${meta.inicio}_a_${meta.fim}.pdf`;
  return { blob: (doc as jsPDF).output("blob"), hash, nomeArquivo };
}
