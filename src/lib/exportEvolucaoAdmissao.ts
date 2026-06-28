import type { jsPDF } from "jspdf";
import {
  NAVY, CELESTE, INK, GRAY, LIGHT, BORDER, W, H, ML, MR, COL, LOGO_ASPECTO,
  obterLogos, registrarFontes, hashConteudo, desenharQr, desenharSeloAssinatura,
} from "@/lib/pdf/base";
import { montarTextoAdmissao, type DadosAdmissao } from "@/lib/evolucaoAdmissao";
import { INSTITUICAO_RELATORIO } from "@/lib/relatorioSanitario";

// ===========================================================================
// EVOLUÇÃO DE ADMISSÃO (PDF) — documento clínico. Mesma identidade da Receita.
// Assinatura ELETRÔNICA institucional do MÉDICO autor + hash. Sem alegação de
// certificação digital qualificada (ICP-Brasil/MP 2.200-2).
// ===========================================================================

export interface MetaAdmissaoPdf {
  hospedeNome: string;
  idadeTexto: string; // já formatada (nunca "XX")
  sexo: string;
  quarto: string;
  medicoNome: string;
  medicoCrm: string | null;
  dataAvaliacao: string;
}

export interface AdmissaoPdfGerada { blob: Blob; hash: string; nomeArquivo: string; }

function dataHora(d: Date): string {
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export async function gerarEvolucaoAdmissaoPdf(dados: DadosAdmissao, meta: MetaAdmissaoPdf): Promise<AdmissaoPdfGerada> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await registrarFontes(doc);
  const logos = await obterLogos();
  const agora = new Date();
  const extraidoTxt = dataHora(agora);
  const hash = hashConteudo(JSON.stringify(dados) + `|${meta.hospedeNome}|${agora.toISOString()}`);
  const crmTexto = meta.medicoCrm?.trim() ? meta.medicoCrm.trim() : "CRM não informado";
  const LIMITE_Y = 250;

  function topoPagina(continuacao: boolean) {
    doc.setFillColor(...CELESTE); doc.rect(0, 0, W, 2.2, "F");
    doc.setFillColor(...NAVY); doc.rect(0, 2.2, W, 0.7, "F");
    const topo = continuacao ? 9 : 13;
    const logoH = continuacao ? 9 : 21;
    if (logos.navy) doc.addImage(logos.navy, "PNG", ML, topo - (continuacao ? 1 : 0), logoH * LOGO_ASPECTO, logoH);
    if (continuacao) {
      doc.setFont("Lato", "bold"); doc.setFontSize(9.5); doc.setTextColor(...NAVY);
      doc.text("Evolução de Admissão (continuação)", ML + 9, 13.5);
      doc.setFont("Lato", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
      doc.text(meta.hospedeNome, MR, 13.5, { align: "right" });
      doc.setDrawColor(...BORDER); doc.setLineWidth(0.3); doc.line(ML, 18, MR, 18);
      return 26;
    }
    const tx = ML + (logos.navy ? logoH * LOGO_ASPECTO + 5 : 0);
    doc.setFont("Lato", "bold"); doc.setFontSize(17); doc.setTextColor(...NAVY);
    doc.text("BLUE", tx, topo + 8.5, { charSpace: 1.2 });
    doc.setFont("Lato", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY);
    doc.text("SENIOR LIVING", tx, topo + 12.5, { charSpace: 1.6 });
    doc.setFontSize(7.5); doc.text(INSTITUICAO_RELATORIO.endereco, tx, topo + 18);
    doc.text(INSTITUICAO_RELATORIO.cidade, tx, topo + 21.5);
    doc.setFont("Lato", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY);
    doc.text("EVOLUÇÃO DE ADMISSÃO", MR, topo + 8, { align: "right", charSpace: 0.4 });
    doc.setFont("Lato", "normal"); doc.setFontSize(8); doc.setTextColor(...GRAY);
    doc.text("Avaliação geriátrica inicial", MR, topo + 12.5, { align: "right" });
    return topo + 27;
  }

  let y = topoPagina(false);

  // Identificação do hóspede.
  doc.setFillColor(...LIGHT); doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.roundedRect(ML, y, COL, 15, 1.5, 1.5, "FD");
  doc.setFillColor(...CELESTE); doc.rect(ML, y, 1.6, 15, "F");
  doc.setFont("Lato", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY);
  doc.text(meta.hospedeNome, ML + 5.5, y + 6);
  doc.setFont("Lato", "normal"); doc.setFontSize(8); doc.setTextColor(...INK);
  doc.text(`${meta.idadeTexto} · ${meta.sexo} · Quarto ${meta.quarto}`, ML + 5.5, y + 11);
  doc.setTextColor(...GRAY);
  doc.text(`Admissão: ${meta.dataAvaliacao}`, MR - 4, y + 6, { align: "right" });
  doc.text(`Dr(a). ${meta.medicoNome}`, MR - 4, y + 11, { align: "right" });
  y += 21;

  // Corpo (narrativa por seções).
  for (const ln of montarTextoAdmissao(dados).split("\n")) {
    if (y > LIMITE_Y) { doc.addPage(); y = topoPagina(true); }
    if (ln.trim() === "") { y += 2; continue; }
    const ehSecao = /^\d+\.\s/.test(ln);
    if (ehSecao) {
      y += 2;
      doc.setFont("Lato", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY);
      doc.text(ln, ML, y);
      doc.setDrawColor(...CELESTE); doc.setLineWidth(0.4); doc.line(ML, y + 1.5, MR, y + 1.5);
      y += 6;
      continue;
    }
    // "Rótulo: valor" → rótulo em bold.
    const idx = ln.indexOf(": ");
    const linhas: string[] = doc.splitTextToSize(ln, COL);
    doc.setFont("Lato", "normal"); doc.setFontSize(8.3); doc.setTextColor(...INK);
    if (idx > 0 && linhas.length === 1) {
      const rotulo = ln.slice(0, idx + 1);
      doc.setFont("Lato", "bold"); doc.setTextColor(...GRAY);
      doc.text(rotulo, ML, y);
      const wR = doc.getTextWidth(rotulo) + 1.5;
      doc.setFont("Lato", "normal"); doc.setTextColor(...INK);
      doc.text(ln.slice(idx + 2), ML + wR, y);
      y += 4.6;
    } else {
      for (const l of linhas) {
        if (y > LIMITE_Y) { doc.addPage(); y = topoPagina(true); }
        doc.text(l, ML, y);
        y += 4.6;
      }
    }
  }

  // ── Rodapé: assinatura do médico ──────────────────────────────────────────
  const ALT = 58;
  if (y > H - 14 - ALT) { doc.addPage(); topoPagina(true); }
  let sy = H - 14 - ALT;
  doc.setDrawColor(...BORDER); doc.setLineWidth(0.3);
  doc.roundedRect(ML - 3, sy, COL + 6, ALT, 2, 2, "S");
  doc.setFillColor(...CELESTE); doc.rect(ML - 3, sy, COL + 6, 0.8, "F");
  sy += 13;
  const cx = W / 2;
  doc.setDrawColor(...NAVY); doc.setLineWidth(0.4); doc.line(cx - 42, sy, cx + 42, sy);
  sy += 5;
  doc.setFont("Lato", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY);
  doc.text(`Dr(a). ${meta.medicoNome}`, cx, sy, { align: "center" });
  sy += 4.3;
  doc.setFont("Lato", "normal"); doc.setFontSize(8.5); doc.setTextColor(...INK);
  doc.text(crmTexto, cx, sy, { align: "center" });

  sy += 7;
  desenharSeloAssinatura(doc, logos.branco, ML, sy, 86);
  doc.setFont("Lato", "normal"); doc.setFontSize(7); doc.setTextColor(...GRAY);
  const verif = doc.splitTextToSize(
    `Documento gerado eletronicamente pelo sistema Blue Senior Living em ${extraidoTxt}. ` +
      `Hash de verificação: ${hash}. Assinatura eletrônica institucional (sem certificação digital qualificada).`,
    86,
  );
  doc.text(verif, ML, sy + 17);
  const qrSize = 20;
  await desenharQr(doc, `BSL-ADMISSAO|${hash}`, MR - qrSize, sy - 1, qrSize);
  doc.setFontSize(6); doc.setTextColor(...GRAY);
  doc.text(hash.slice(0, 19), MR - qrSize / 2, sy + qrSize + 2, { align: "center" });

  const nomeArquivo = `evolucao_admissao_${meta.hospedeNome.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_").toLowerCase()}.pdf`;
  return { blob: (doc as jsPDF).output("blob"), hash, nomeArquivo };
}
