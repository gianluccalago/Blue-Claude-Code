import * as XLSX from "xlsx";
import type { LinhaPagamentoPessoal } from "@/hooks/usePagamentoPessoal";

/**
 * Exporta o pagamento da equipe do mês (.xlsx) — base para pagamento por
 * fora / acerto com PJ.
 */
export function exportarPagamentoPessoalExcel(mes: string, linhas: LinhaPagamentoPessoal[]): boolean {
  try {
    const wb = XLSX.utils.book_new();

    const dados = linhas.map((l) => ({
      "Profissional": l.profissional.nome,
      "Função": l.profissional.funcao ?? "Não informado",
      "Tipo de remuneração": l.tipoRemuneracao === "mensal_fixo" ? "Mensal fixo" : "Por plantão",
      "Diurno previsto": l.tipoRemuneracao === "por_plantao" ? l.previstoDiurno : "",
      "Diurno realizado": l.tipoRemuneracao === "por_plantao" ? l.realizadoDiurno : "",
      "Noturno previsto": l.tipoRemuneracao === "por_plantao" ? l.previstoNoturno : "",
      "Noturno realizado": l.tipoRemuneracao === "por_plantao" ? l.realizadoNoturno : "",
      "Valor calculado (R$)": l.valorCalculado,
      "Valor final (R$)": l.valorFinal,
      "Status": l.status === "pago" ? "Pago" : "Pendente",
      "Observação": l.observacao || "",
    }));
    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Pagamento pessoal");

    XLSX.writeFile(wb, `pagamento_pessoal_${mes}.xlsx`);
    return true;
  } catch {
    return false;
  }
}
