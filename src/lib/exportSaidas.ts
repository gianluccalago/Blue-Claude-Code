import { formatarDataBR } from "@/lib/utils";
import { tempoPermanencia, MOTIVOS_SAIDA } from "@/lib/cicloVida";
import { matrizTempoMotivo, resumoMacro } from "@/lib/analiseSaidas";
import type { Residente } from "@/types/database";

// ===========================================================================
// Exporta a Análise de Saídas (churn) em .xlsx — saídas detalhadas + matriz
// (tempo × motivo) + macro-grupos. Não lança erro: se falhar, apenas não baixa.
// ===========================================================================

export async function exportarSaidasExcel(saidas: Residente[], periodoLabel: string): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Aba 1 — saídas detalhadas.
    const dados = saidas.map((r) => ({
      "Hóspede": r.nome,
      "Número": r.numero_hospede ?? "Não informado",
      "Entrada": r.data_admissao ? formatarDataBR(r.data_admissao) : "Não informado",
      "Saída": r.data_saida ? formatarDataBR(r.data_saida) : "Não informado",
      "Tempo de permanência": tempoPermanencia(r.data_admissao, r.data_saida),
      "Motivo": r.motivo_saida ?? "Não informado",
      "Tipo de suíte": r.tipo_suite ?? "Não informado",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), "Saídas");

    // Aba 2 — matriz tempo de casa × motivo.
    const motivos = [...MOTIVOS_SAIDA];
    const matriz = matrizTempoMotivo(saidas, motivos).map((l) => {
      const linha: Record<string, string | number> = { "Tempo de casa": l.faixa };
      for (const m of motivos) linha[m] = l.porMotivo[m];
      linha["Total"] = l.total;
      linha["% do total"] = `${l.pct}%`;
      return linha;
    });
    if (matriz.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(matriz), "Matriz tempo x motivo");
    }

    // Aba 3 — macro-grupos.
    const macro = resumoMacro(saidas).map((g) => ({
      "Macro-grupo": g.label,
      "Saídas": g.count,
      "% do total": `${g.pct}%`,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(macro), "Macro-grupos");

    XLSX.writeFile(wb, `analise_saidas_${periodoLabel}.xlsx`);
    return true;
  } catch {
    return false;
  }
}
