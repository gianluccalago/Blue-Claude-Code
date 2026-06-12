import type { Residente } from "@/types/database";
import type { GrupoPrescricao } from "@/hooks/useMedico";
import { gerarPrescricaoBlob, type AssinanteReceita } from "@/lib/exportPrescricao";
import { hojeISO } from "@/lib/utils";

// ===========================================================================
// Emissão EM LOTE das receitas (Farmácia) — reúsa o MESMO gerador de PDF do
// Médico (gerarPrescricaoBlob → layout idêntico) e empacota os PDFs num único
// .zip via JSZip (carregado sob demanda). Falha de um hóspede NÃO interrompe o
// lote: o nome do hóspede que falhou é reportado.
// ===========================================================================

export type ItemReceita = { hospede: Residente; grupos: GrupoPrescricao[] };

export type ResultadoLote = {
  /** Quantos PDFs foram gerados com sucesso e entraram no arquivo. */
  gerados: number;
  /** Nomes dos hóspedes cujo PDF falhou (o lote seguiu sem eles). */
  falhas: string[];
};

/** Dispara o download de um Blob no navegador. */
function baixarBlob(blob: Blob, nomeArquivo: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Gera o PDF de cada hóspede e baixa um único .zip com todos. Se houver apenas
 * um item, ainda assim zipa (use `exportarReceitaUnica` para baixar o PDF solto).
 */
export async function exportarReceitasLoteZip(
  itens: ItemReceita[],
  assinante: AssinanteReceita,
): Promise<ResultadoLote> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const falhas: string[] = [];
  let gerados = 0;

  for (const { hospede, grupos } of itens) {
    // Pula quem não tem prescrição ativa — não gera PDF vazio.
    if (grupos.length === 0) continue;
    try {
      const { blob, nomeArquivo } = await gerarPrescricaoBlob(hospede, grupos, assinante);
      zip.file(nomeArquivo, blob);
      gerados++;
    } catch {
      falhas.push(hospede.nome);
    }
  }

  if (gerados > 0) {
    const zipBlob = await zip.generateAsync({ type: "blob" });
    baixarBlob(zipBlob, `receitas_${hojeISO()}.zip`);
  }

  return { gerados, falhas };
}

/** Baixa o PDF de um único hóspede direto (sem zipar). */
export async function exportarReceitaUnica(
  item: ItemReceita,
  assinante: AssinanteReceita,
): Promise<void> {
  const { blob, nomeArquivo } = await gerarPrescricaoBlob(item.hospede, item.grupos, assinante);
  baixarBlob(blob, nomeArquivo);
}
