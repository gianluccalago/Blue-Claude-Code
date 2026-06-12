import type { LinhaDemonstrativo } from "@/hooks/useDemonstrativo";
import type { Upselling } from "@/types/database";
import { formatarMesReferencia, formatarMoeda } from "@/lib/mensalidade";
import { formatarDataBR } from "@/lib/utils";

function nomeSanitizado(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

/**
 * Exporta o demonstrativo consolidado do mês (todos os hóspedes) em .xlsx,
 * com uma aba "Consolidado" e — se houver lançamentos — uma aba "Upselling"
 * com o detalhamento. Não lança erro: se a geração falhar, simplesmente não
 * baixa o arquivo.
 */
export async function exportarDemonstrativoConsolidadoExcel(
  mes: string,
  linhas: LinhaDemonstrativo[],
  upsellingTodos: Upselling[],
): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const consolidado = linhas.map((l) => ({
      "Hóspede": l.residente.nome,
      "Quarto": l.residente.quarto ?? "Não informado",
      "Tipo de suíte": l.residente.tipo_suite ?? "Não informado",
      "Grau": l.residente.grau_dependencia ?? "Não informado",
      "Mensalidade (R$)": l.mensalidade,
      "Upselling (R$)": l.upselling,
      "Total (R$)": l.total,
      "Status mensalidade": l.pago ? "Pago" : "Pendente",
    }));
    const wsConsolidado = XLSX.utils.json_to_sheet(consolidado);
    XLSX.utils.book_append_sheet(wb, wsConsolidado, "Consolidado");

    const nomePorResidente = new Map(linhas.map((l) => [l.residente.id, l.residente.nome]));
    if (upsellingTodos.length > 0) {
      const detalhamento = upsellingTodos
        .slice()
        .sort((a, b) => (nomePorResidente.get(a.residente_id) ?? "").localeCompare(nomePorResidente.get(b.residente_id) ?? ""))
        .map((u) => ({
          "Hóspede": nomePorResidente.get(u.residente_id) ?? "Não informado",
          "Data": formatarDataBR(u.data),
          "Categoria": u.categoria,
          "Descrição": u.descricao ?? "Não informado",
          "Valor (R$)": u.valor,
        }));
      const wsDetalhe = XLSX.utils.json_to_sheet(detalhamento);
      XLSX.utils.book_append_sheet(wb, wsDetalhe, "Upselling");

      // 3ª aba: subtotais por categoria (mantenedor não precisa de tabela dinâmica).
      const porCategoria = new Map<string, { total: number; qtd: number }>();
      for (const u of upsellingTodos) {
        const cat = u.categoria || "Não informado";
        const reg = porCategoria.get(cat) ?? { total: 0, qtd: 0 };
        reg.total += u.valor;
        reg.qtd += 1;
        porCategoria.set(cat, reg);
      }
      const totalGeral = upsellingTodos.reduce((s, u) => s + u.valor, 0);
      const subtotais = [...porCategoria.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([categoria, { total, qtd }]) => ({
          "Categoria": categoria,
          "Lançamentos": qtd,
          "Total (R$)": total,
        }));
      subtotais.push({ "Categoria": "TOTAL", "Lançamentos": upsellingTodos.length, "Total (R$)": totalGeral });
      const wsCategoria = XLSX.utils.json_to_sheet(subtotais);
      XLSX.utils.book_append_sheet(wb, wsCategoria, "Upselling por categoria");
    }

    XLSX.writeFile(wb, `demonstrativo_${mes}.xlsx`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Exporta o demonstrativo individual de um hóspede (resumo + detalhamento de
 * upselling) em .xlsx — pronto para envio ao mantenedor.
 */
export async function exportarDemonstrativoIndividualExcel(
  mes: string,
  linha: LinhaDemonstrativo,
  itensUpselling: Upselling[],
): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const resumo = [
      {
        "Hóspede": linha.residente.nome,
        "Quarto": linha.residente.quarto ?? "Não informado",
        "Mês de referência": formatarMesReferencia(mes),
        "Mensalidade (R$)": linha.mensalidade,
        "Upselling (R$)": linha.upselling,
        "Total (R$)": linha.total,
        "Status mensalidade": linha.pago ? "Pago" : "Pendente",
      },
    ];
    const wsResumo = XLSX.utils.json_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");

    if (itensUpselling.length > 0) {
      const itens = itensUpselling.map((u) => ({
        "Data": formatarDataBR(u.data),
        "Categoria": u.categoria,
        "Descrição": u.descricao ?? "Não informado",
        "Valor (R$)": u.valor,
      }));
      const wsItens = XLSX.utils.json_to_sheet(itens);
      XLSX.utils.book_append_sheet(wb, wsItens, "Upselling");
    }

    XLSX.writeFile(wb, `demonstrativo_${nomeSanitizado(linha.residente.nome)}_${mes}.xlsx`);
    return true;
  } catch {
    return false;
  }
}

/** Texto corrido do demonstrativo individual, pronto para envio ao mantenedor. */
export function gerarTextoDemonstrativoIndividual(
  mes: string,
  linha: LinhaDemonstrativo,
  itensUpselling: Upselling[],
): string {
  const partes = [
    `Demonstrativo mensal — ${linha.residente.nome}`,
    `Mês de referência: ${formatarMesReferencia(mes)}`,
    "",
    `Mensalidade: ${formatarMoeda(linha.mensalidade)} (${linha.pago ? "Pago" : "Pendente"})`,
    `Upselling do mês: ${formatarMoeda(linha.upselling)}`,
    `Total do mês: ${formatarMoeda(linha.total)}`,
    "",
  ];

  if (itensUpselling.length > 0) {
    partes.push("Detalhamento de upselling:");
    for (const u of itensUpselling) {
      const desc = u.descricao ? ` — ${u.descricao}` : "";
      partes.push(`- ${formatarDataBR(u.data)} · ${u.categoria}${desc}: ${formatarMoeda(u.valor)}`);
    }
  } else {
    partes.push("Sem lançamentos de upselling no mês.");
  }

  return partes.join("\n");
}

/** Baixa o demonstrativo individual como arquivo .txt. */
export function exportarDemonstrativoIndividualTexto(
  mes: string,
  linha: LinhaDemonstrativo,
  itensUpselling: Upselling[],
): boolean {
  try {
    const texto = gerarTextoDemonstrativoIndividual(mes, linha, itensUpselling);
    const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `demonstrativo_${nomeSanitizado(linha.residente.nome)}_${mes}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
