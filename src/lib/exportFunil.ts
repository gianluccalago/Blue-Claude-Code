import { formatarMesReferencia } from "@/lib/mensalidade";
import type { LinhaFunil } from "@/lib/funilVendas";

// ===========================================================================
// Exporta o Funil de Vendas histórico em .xlsx. Não lança erro: se falhar,
// apenas não baixa.
// ===========================================================================

const ouTraco = (v: number | null) => (v == null ? "—" : v);

export async function exportarFunilExcel(linhas: LinhaFunil[], periodoLabel: string): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const dados = linhas.map((l) => ({
      "Mês/Ano": formatarMesReferencia(l.mes),
      "Leads": l.leads,
      "Qualificados": l.qualificados,
      "Visitas": l.visitas,
      "Vendas": l.vendas,
      "% Visitas/Leads": l.pctVisitasLeads == null ? "—" : `${l.pctVisitasLeads}%`,
      "% Vendas/Visitas": l.pctVendasVisitas == null ? "—" : `${l.pctVendasVisitas}%`,
      "% Vendas/Leads": l.pctVendasLeads == null ? "—" : `${l.pctVendasLeads}%`,
      "Receita (R$)": l.receita,
      "Ticket médio (R$)": ouTraco(l.ticketMedio),
    }));

    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Funil de Vendas");
    XLSX.writeFile(wb, `funil_vendas_${periodoLabel}.xlsx`);
    return true;
  } catch {
    return false;
  }
}
