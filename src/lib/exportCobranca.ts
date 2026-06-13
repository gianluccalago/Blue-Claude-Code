import type { GrupoCobranca } from "@/hooks/useFechamentoCobranca";
import { STATUS_COBRANCA_LABEL } from "@/lib/cobranca";
import { formatarDataBR } from "@/lib/utils";

// ===========================================================================
// Exporta o FECHAMENTO DE COBRANÇA do mês em .xlsx — a "fatura por responsável"
// que a Administração usa para cobrar por fora hoje (e que amanhã alimentaria a
// cobrança automática). Duas abas: por responsável e detalhe por hóspede.
// Não lança erro: se falhar, apenas não baixa.
// ===========================================================================

export async function exportarFechamentoCobrancaExcel(
  mes: string,
  grupos: GrupoCobranca[],
): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Aba 1 — fatura consolidada por responsável financeiro.
    const porResponsavel = grupos.map((g) => ({
      "Responsável financeiro": g.respNome,
      "Relação": g.respRelacao ?? "Não informado",
      "CPF": g.respCpf ?? "Não informado",
      "E-mail": g.respEmail ?? "Não informado",
      "Telefone": g.respTelefone ?? "Não informado",
      "Hóspede(s)": g.hospedes.map((h) => h.residente.nome).join("; "),
      "Vencimento": g.vencimento ? formatarDataBR(g.vencimento) : "Não informado",
      "Valor a cobrar (R$)": g.valorACobrar,
    }));
    const ws1 = XLSX.utils.json_to_sheet(porResponsavel);
    XLSX.utils.book_append_sheet(wb, ws1, "Fatura por responsável");

    // Aba 2 — detalhe por hóspede (mensalidade + upselling + status).
    const detalhe = grupos.flatMap((g) =>
      g.hospedes.map((h) => ({
        "Responsável financeiro": g.respNome,
        "Hóspede": h.residente.nome,
        "Quarto": h.residente.quarto ?? "Não informado",
        "Mensalidade (R$)": h.mensalidade,
        "Upselling (R$)": h.upselling,
        "Valor a cobrar (R$)": h.valorACobrar,
        "Vencimento": h.vencimento ? formatarDataBR(h.vencimento) : "Não informado",
        "Status": STATUS_COBRANCA_LABEL[h.statusEfetivo],
      })),
    );
    const ws2 = XLSX.utils.json_to_sheet(detalhe);
    XLSX.utils.book_append_sheet(wb, ws2, "Detalhe por hóspede");

    XLSX.writeFile(wb, `cobranca_${mes}.xlsx`);
    return true;
  } catch {
    return false;
  }
}
