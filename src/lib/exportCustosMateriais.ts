import { formatarDataBR } from "@/lib/utils";
import type { CustoMaterial } from "@/types/database";

const CATEGORIA_LABEL: Record<string, string> = { limpeza: "Limpeza", manutencao: "Manutenção" };

// ===========================================================================
// Exporta os custos de materiais do mês em .xlsx. Não lança erro: se falhar,
// apenas não baixa.
// ===========================================================================

export async function exportarCustosMateriaisExcel(lista: CustoMaterial[], mes: string): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const dados = lista.map((m) => ({
      "Categoria": CATEGORIA_LABEL[m.categoria] ?? m.categoria,
      "Descrição": m.descricao,
      "Fornecedor": m.fornecedor ?? "Não informado",
      "Data": formatarDataBR(m.data),
      "Valor (R$)": m.valor,
    }));
    const limpeza = lista.filter((m) => m.categoria === "limpeza").reduce((s, m) => s + m.valor, 0);
    const manut = lista.filter((m) => m.categoria === "manutencao").reduce((s, m) => s + m.valor, 0);
    dados.push({ "Categoria": "", "Descrição": "Subtotal Limpeza", "Fornecedor": "", "Data": "", "Valor (R$)": limpeza });
    dados.push({ "Categoria": "", "Descrição": "Subtotal Manutenção", "Fornecedor": "", "Data": "", "Valor (R$)": manut });
    dados.push({ "Categoria": "", "Descrição": "TOTAL", "Fornecedor": "", "Data": "", "Valor (R$)": limpeza + manut });

    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Custos de materiais");
    XLSX.writeFile(wb, `custos_materiais_${mes}.xlsx`);
    return true;
  } catch {
    return false;
  }
}
