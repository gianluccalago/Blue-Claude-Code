import type { AgravoEpidemiologico, Residente, TipoAgravo } from "@/types/database";

// ===========================================================================
// INDICADORES OBRIGATÓRIOS DA RDC 502/2021 (Art. 58-60 + Anexo).
//
// São 6 indicadores epidemiológicos, calculados MENSALMENTE. A população de
// referência do mês = nº de idosos residentes no DIA 15 daquele mês (nota do
// Anexo). O consolidado do ano anterior é enviado à Vigilância Sanitária todo
// mês de JANEIRO (Art. 60).
//
// FÓRMULAS (exatamente como o Anexo):
//   1. Taxa de mortalidade
//        = (nº de óbitos de residentes no mês / população no dia 15) × 100
//   2. Taxa de incidência de diarreia aguda
//        = (nº de casos novos de diarreia aguda no mês / população no dia 15) × 100
//   3. Taxa de incidência de escabiose
//        = (nº de casos novos de escabiose no mês / população no dia 15) × 100
//   4. Taxa de incidência de desidratação
//        = (nº de idosos que apresentaram desidratação no mês / população no dia 15) × 100
//   5. Taxa de prevalência de úlcera de decúbito
//        = (nº de idosos com úlcera de decúbito no mês / população no dia 15) × 100
//   6. Taxa de prevalência de desnutrição
//        = (nº de idosos com diagnóstico de desnutrição no mês / população no dia 15) × 100
//
// Estes indicadores são REGULATÓRIOS (clínicos/epidemiológicos) e vivem na aba
// Vigilância Sanitária — separados dos indicadores de gestão (INDICADORES.md).
// ===========================================================================

export interface DefIndicador {
  key: TipoAgravo;
  numero: number;
  label: string;
  medida: "mortalidade" | "incidência" | "prevalência";
}

export const INDICADORES_RDC: DefIndicador[] = [
  { key: "obito", numero: 1, label: "Taxa de mortalidade", medida: "mortalidade" },
  { key: "diarreia_aguda", numero: 2, label: "Incidência de diarreia aguda", medida: "incidência" },
  { key: "escabiose", numero: 3, label: "Incidência de escabiose", medida: "incidência" },
  { key: "desidratacao", numero: 4, label: "Incidência de desidratação", medida: "incidência" },
  { key: "ulcera_decubito", numero: 5, label: "Prevalência de úlcera de decúbito", medida: "prevalência" },
  { key: "desnutricao", numero: 6, label: "Prevalência de desnutrição", medida: "prevalência" },
];

export const AGRAVO_LABEL: Record<TipoAgravo, string> = {
  obito: "Óbito",
  diarreia_aguda: "Diarreia aguda",
  escabiose: "Escabiose",
  desidratacao: "Desidratação",
  ulcera_decubito: "Úlcera de decúbito",
  desnutricao: "Desnutrição",
};

/** Incidência = caso novo no mês; prevalência = caso presente no mês. */
export const TIPO_REGISTRO_DE: Record<TipoAgravo, "incidencia" | "prevalencia"> = {
  obito: "incidencia",
  diarreia_aguda: "incidencia",
  escabiose: "incidencia",
  desidratacao: "incidencia",
  ulcera_decubito: "prevalencia",
  desnutricao: "prevalencia",
};

export const MESES_CURTOS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function dois(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * População de referência: residentes presentes no DIA 15 do mês (mes = 1..12).
 * Presente = admitido até o dia 15 e ainda não saíra antes dele. data_admissao
 * nula é tratada como "admitido antes" (não subnotifica o denominador).
 */
export function populacaoDia15(residentes: Residente[], ano: number, mes: number): number {
  const dia15 = `${ano}-${dois(mes)}-15`;
  return residentes.filter((r) => {
    const entrouAte = !r.data_admissao || r.data_admissao <= dia15;
    const aindaPresente = !r.data_saida || r.data_saida >= dia15;
    return entrouAte && aindaPresente;
  }).length;
}

export interface ResultadoIndicador {
  key: TipoAgravo;
  numero: number;
  label: string;
  medida: "mortalidade" | "incidência" | "prevalência";
  numerador: number;
  denominador: number;
  /** Taxa em % (num/den × 100); null quando não há população (denominador 0). */
  taxa: number | null;
}

export interface IndicadoresMes {
  ano: number;
  mes: number; // 1..12
  populacao: number;
  indicadores: ResultadoIndicador[];
}

/**
 * Calcula os 6 indicadores de um mês. O numerador conta IDOSOS DISTINTOS com o
 * agravo no mês (evita duplicidade de registro). A mortalidade une duas fontes
 * sem duplicar: agravos de óbito + saídas por "Falecimento" no mês.
 */
export function calcularIndicadoresMes(
  ano: number,
  mes: number,
  agravos: AgravoEpidemiologico[],
  residentes: Residente[],
): IndicadoresMes {
  const prefixo = `${ano}-${dois(mes)}`;
  const populacao = populacaoDia15(residentes, ano, mes);

  // Falecimentos pela saída (ciclo de inativação) no mês.
  const obitosPorSaida = new Set(
    residentes
      .filter((r) => r.motivo_saida === "Falecimento" && (r.data_saida ?? "").startsWith(prefixo))
      .map((r) => r.id),
  );

  const indicadores = INDICADORES_RDC.map((def): ResultadoIndicador => {
    // Idosos distintos com o agravo no mês.
    const idosos = new Set(
      agravos
        .filter((a) => a.tipo === def.key && a.data_ocorrencia.startsWith(prefixo))
        .map((a) => a.residente_id),
    );
    // Mortalidade: une agravo de óbito com saída por falecimento (dedup).
    if (def.key === "obito") for (const id of obitosPorSaida) idosos.add(id);

    const numerador = idosos.size;
    return {
      key: def.key,
      numero: def.numero,
      label: def.label,
      medida: def.medida,
      numerador,
      denominador: populacao,
      taxa: populacao > 0 ? (numerador / populacao) * 100 : null,
    };
  });

  return { ano, mes, populacao, indicadores };
}

/** Os 12 meses do ano, cada um com os 6 indicadores. */
export function calcularAno(
  ano: number,
  agravos: AgravoEpidemiologico[],
  residentes: Residente[],
): IndicadoresMes[] {
  return Array.from({ length: 12 }, (_, i) => calcularIndicadoresMes(ano, i + 1, agravos, residentes));
}

/** "0,0%" / "12,5%" / "—" (sem população). Zero é um resultado VÁLIDO. */
export function formatarTaxa(taxa: number | null): string {
  if (taxa === null) return "—";
  return `${taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
