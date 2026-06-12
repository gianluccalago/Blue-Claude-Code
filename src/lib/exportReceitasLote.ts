import type { Residente } from "@/types/database";
import type { GrupoPrescricao } from "@/hooks/useMedico";
import {
  gerarReceitasDoHospede,
  baixarBlob,
  PrescricaoSemMedicoError,
  MSG_SEM_MEDICO,
} from "@/lib/exportPrescricao";
import { hojeISO } from "@/lib/utils";

// ===========================================================================
// Emissão EM LOTE das receitas (Farmácia) — reúsa a MESMA função de geração do
// Médico (gerarReceitasDoHospede) e empacota os PDFs num único .zip via JSZip.
//
// AUTORIA: a Farmácia apenas EXTRAI — cada receita sai assinada pelo MÉDICO
// PRESCRITOR registrado na prescrição, nunca por quem dispara o lote. Hóspede
// com prescrições de médicos diferentes gera um PDF por médico. Prescrição sem
// médico identificado NÃO é emitida (entra na lista de falhas com o motivo).
// ===========================================================================

export type ItemReceita = { hospede: Residente; grupos: GrupoPrescricao[] };

export type FalhaReceita = { hospede: string; motivo: string };

export type ResultadoLote = {
  /** Quantos PDFs foram gerados com sucesso e entraram no arquivo. */
  gerados: number;
  /** Hóspedes cujas receitas falharam (o lote seguiu sem eles), com o motivo. */
  falhas: FalhaReceita[];
};

function motivoDe(e: unknown): string {
  if (e instanceof PrescricaoSemMedicoError) return MSG_SEM_MEDICO;
  return "erro ao gerar o PDF";
}

/**
 * Gera os PDFs de cada hóspede (um por médico prescritor) e baixa um único
 * .zip. Falha de um hóspede NÃO interrompe o lote.
 */
export async function exportarReceitasLoteZip(itens: ItemReceita[]): Promise<ResultadoLote> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const falhas: FalhaReceita[] = [];
  let gerados = 0;

  for (const { hospede, grupos } of itens) {
    // Pula quem não tem prescrição ativa — não gera PDF vazio.
    if (grupos.length === 0) continue;
    try {
      const receitas = await gerarReceitasDoHospede(hospede, grupos);
      for (const r of receitas) {
        zip.file(r.nomeArquivo, r.blob);
        gerados++;
      }
    } catch (e) {
      falhas.push({ hospede: hospede.nome, motivo: motivoDe(e) });
    }
  }

  if (gerados > 0) {
    const zipBlob = await zip.generateAsync({ type: "blob" });
    baixarBlob(zipBlob, `receitas_${hojeISO()}.zip`);
  }

  return { gerados, falhas };
}

/**
 * Baixa direto (sem zipar) as receitas de um único hóspede — uma por médico
 * prescritor. Retorna quantos PDFs foram baixados.
 */
export async function exportarReceitaUnica(item: ItemReceita): Promise<number> {
  const receitas = await gerarReceitasDoHospede(item.hospede, item.grupos);
  for (const r of receitas) baixarBlob(r.blob, r.nomeArquivo);
  return receitas.length;
}
