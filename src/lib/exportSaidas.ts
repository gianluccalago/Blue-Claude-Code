import { formatarDataBR } from "@/lib/utils";
import { tempoPermanencia } from "@/lib/cicloVida";
import type { Residente } from "@/types/database";

// ===========================================================================
// Exporta a Análise de Saídas (churn) em .xlsx — saídas detalhadas do período.
// Não lança erro: se falhar, apenas não baixa.
// ===========================================================================

export async function exportarSaidasExcel(saidas: Residente[], periodoLabel: string): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const dados = saidas.map((r) => ({
      "Hóspede": r.nome,
      "Número": r.numero_hospede ?? "Não informado",
      "Entrada": r.data_admissao ? formatarDataBR(r.data_admissao) : "Não informado",
      "Saída": r.data_saida ? formatarDataBR(r.data_saida) : "Não informado",
      "Tempo de permanência": tempoPermanencia(r.data_admissao, r.data_saida),
      "Motivo": r.motivo_saida ?? "Não informado",
      "Tipo de suíte": r.tipo_suite ?? "Não informado",
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Saídas");
    XLSX.writeFile(wb, `analise_saidas_${periodoLabel}.xlsx`);
    return true;
  } catch {
    return false;
  }
}
