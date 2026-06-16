import { formatarMesReferencia } from "@/lib/mensalidade";
import type { MetricasCobertura } from "@/lib/paineisRh";

// ===========================================================================
// Exporta a cobertura de escala (métricas mensais) em .xlsx. Não lança erro.
// ===========================================================================
export async function exportarCoberturaExcel(metricas: MetricasCobertura[], anoLabel: string): Promise<boolean> {
  try {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();
    const dados = metricas.map((m) => ({
      "Mês": formatarMesReferencia(m.mes),
      "Funcionários": m.funcionarios,
      "Plantões": m.plantoes,
      "Descobertos": m.descobertos,
      "Cob. atestado": m.coberturasPorTipo.atestado,
      "Cob. licença mat.": m.coberturasPorTipo.licenca_maternidade,
      "Cob. licença INSS": m.coberturasPorTipo.licenca_inss,
      "Cob. falta": m.coberturasPorTipo.falta_sem_atestado,
      "Cob. férias": m.coberturasPorTipo.ferias,
      "Cob. evento": m.coberturasPorTipo.evento,
      "Total coberturas": m.totalCoberturas,
      "% Atestados/plantões": m.pctAtestadosSobrePlantoes == null ? "—" : `${m.pctAtestadosSobrePlantoes.toFixed(1)}%`,
      "% Coberturas/plantões": m.pctCoberturasSobrePlantoes == null ? "—" : `${m.pctCoberturasSobrePlantoes.toFixed(1)}%`,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dados), "Cobertura de escala");
    XLSX.writeFile(wb, `rh_cobertura_${anoLabel}.xlsx`);
    return true;
  } catch {
    return false;
  }
}
