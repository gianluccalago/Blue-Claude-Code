import { MESES_CURTOS, type IndicadoresMes } from "@/lib/indicadoresRdc";

// ===========================================================================
// Exporta o CONSOLIDADO ANUAL dos indicadores RDC 502 em .xlsx — no formato do
// Anexo (indicador × 12 meses), para envio à Vigilância Sanitária em janeiro
// (Art. 60). Duas abas: taxas (%) e casos (numeradores). Não lança erro.
// ===========================================================================

export async function exportarIndicadoresRdcExcel(ano: number, meses: IndicadoresMes[]): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const defs = meses[0]?.indicadores ?? [];

    // Aba 1 — taxas (%) por mês.
    const taxas: Record<string, string | number>[] = [];
    taxas.push({
      Indicador: "População de referência (dia 15)",
      ...Object.fromEntries(MESES_CURTOS.map((m, i) => [m, meses[i]?.populacao ?? 0])),
    });
    defs.forEach((_, idx) => {
      const def = defs[idx];
      taxas.push({
        Indicador: `${def.numero}. ${def.label} (%)`,
        ...Object.fromEntries(
          MESES_CURTOS.map((m, i) => {
            const t = meses[i]?.indicadores[idx]?.taxa;
            return [m, t === null || t === undefined ? "—" : Number(t.toFixed(1))];
          }),
        ),
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(taxas), `Taxas ${ano}`);

    // Aba 2 — casos (numeradores) por mês.
    const casos: Record<string, string | number>[] = [];
    defs.forEach((_, idx) => {
      const def = defs[idx];
      casos.push({
        Indicador: `${def.numero}. ${def.label}`,
        ...Object.fromEntries(MESES_CURTOS.map((m, i) => [m, meses[i]?.indicadores[idx]?.numerador ?? 0])),
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(casos), "Casos");

    XLSX.writeFile(wb, `indicadores_rdc502_${ano}.xlsx`);
    return true;
  } catch {
    return false;
  }
}
