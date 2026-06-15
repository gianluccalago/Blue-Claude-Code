import { formatarDataBR } from "@/lib/utils";
import { formatarQuarto } from "@/lib/quarto";
import type { Residente } from "@/types/database";

// ===========================================================================
// Exporta o Mapa das Suítes (hóspedes ativos) em .xlsx. Uma aba com a tabela
// e uma linha de totais. Não lança erro: se falhar, apenas não baixa.
// ===========================================================================

export interface LinhaMapa {
  residente: Residente;
  upsellFixo: number;
  total: number;
}

const SEXO_LABEL: Record<string, string> = { masculino: "Homem", feminino: "Mulher" };
const OCUPACAO_LABEL: Record<string, string> = {
  simples: "Individual",
  duplo: "Duplo",
  triplo: "Triplo",
};

function grauLabel(g: string | null): string {
  return g ? `Grau ${g}` : "Não informado";
}

export async function exportarMapaSuitesExcel(linhas: LinhaMapa[], mesLabel: string): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const dados = linhas.map(({ residente: r, upsellFixo, total }) => ({
      "Número": r.numero_hospede ?? "Não informado",
      "Hóspede": r.nome,
      "Sexo": r.sexo ? SEXO_LABEL[r.sexo] : "Não informado",
      "Suíte": formatarQuarto(r.quarto) ?? "Não informado",
      "Tipo": r.tipo_suite ?? "Não informado",
      "Ocupação": r.ocupacao ? OCUPACAO_LABEL[r.ocupacao] : "Não informado",
      "Entrada": r.data_admissao ? formatarDataBR(r.data_admissao) : "Não informado",
      "Grau (ingresso)": grauLabel(r.grau_contratual),
      "Grau (atual)": grauLabel(r.grau_dependencia),
      "Mensalidade (R$)": r.mensalidade_valor ?? 0,
      "Upsell fixo (R$)": upsellFixo,
      "Total (R$)": total,
    }));

    // Linha de totais.
    const totMensalidade = linhas.reduce((s, l) => s + (l.residente.mensalidade_valor ?? 0), 0);
    const totUpsell = linhas.reduce((s, l) => s + l.upsellFixo, 0);
    const totGeral = linhas.reduce((s, l) => s + l.total, 0);
    dados.push({
      "Número": "",
      "Hóspede": `TOTAL (${linhas.length} ativos)`,
      "Sexo": "",
      "Suíte": "",
      "Tipo": "",
      "Ocupação": "",
      "Entrada": "",
      "Grau (ingresso)": "",
      "Grau (atual)": "",
      "Mensalidade (R$)": totMensalidade,
      "Upsell fixo (R$)": totUpsell,
      "Total (R$)": totGeral,
    });

    const ws = XLSX.utils.json_to_sheet(dados);
    XLSX.utils.book_append_sheet(wb, ws, "Mapa das Suítes");
    XLSX.writeFile(wb, `mapa_suites_${mesLabel}.xlsx`);
    return true;
  } catch {
    return false;
  }
}
