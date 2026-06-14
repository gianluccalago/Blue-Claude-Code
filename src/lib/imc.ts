import type { RegistroPeso } from "@/types/database";

// ===========================================================================
// IMC e classificação GERIÁTRICA. A faixa do idoso é deslocada para CIMA em
// relação ao adulto jovem (proteção contra desnutrição): baixo peso < 22;
// adequado 22–27; excesso > 27. Usamos a referência geriátrica.
//
// Perda de peso em idoso é gatilho de atenção clínica: sinalizamos queda ≥ 5%
// vs. a pesagem anterior e tendência de queda em 3 medições.
// ===========================================================================

export const IMC_LIMITE_BAIXO = 22;
export const IMC_LIMITE_EXCESSO = 27;
/** Perda relevante: queda percentual (vs. medição anterior) a partir deste limiar. */
export const PERDA_RELEVANTE_PCT = 5;

export type ClassificacaoIMC = "baixo_peso" | "adequado" | "excesso";

export function calcularIMC(pesoKg: number, alturaM: number | null | undefined): number | null {
  if (!alturaM || alturaM <= 0 || !pesoKg || pesoKg <= 0) return null;
  return Math.round((pesoKg / (alturaM * alturaM)) * 10) / 10;
}

export function classificarIMC(imc: number | null): ClassificacaoIMC | null {
  if (imc === null) return null;
  if (imc < IMC_LIMITE_BAIXO) return "baixo_peso";
  if (imc > IMC_LIMITE_EXCESSO) return "excesso";
  return "adequado";
}

export const CLASSIFICACAO_IMC_LABEL: Record<ClassificacaoIMC, string> = {
  baixo_peso: "Baixo peso",
  adequado: "Adequado",
  excesso: "Excesso de peso",
};

export const CLASSIFICACAO_IMC_VARIANTE: Record<ClassificacaoIMC, "destructive" | "success" | "warning"> = {
  baixo_peso: "destructive",
  adequado: "success",
  excesso: "warning",
};

export interface ResumoPeso {
  ultimo: RegistroPeso | null;
  anterior: RegistroPeso | null;
  /** Variação absoluta (kg) vs. a pesagem anterior. */
  variacaoKg: number | null;
  /** Variação percentual vs. a anterior. */
  variacaoPct: number | null;
  classificacao: ClassificacaoIMC | null;
  /** Perda ≥ 5% vs. a anterior. */
  perdaRelevante: boolean;
  /** 3+ medições em queda contínua. */
  tendenciaQueda: boolean;
  /** IMC baixo (< 22). */
  baixoPeso: boolean;
  /** Algum gatilho de atenção clínica. */
  emRisco: boolean;
}

/** Resumo de peso a partir do histórico (ordem qualquer; ordenamos por data). */
export function resumoPeso(registros: RegistroPeso[]): ResumoPeso {
  const ord = [...registros].sort((a, b) => a.data.localeCompare(b.data)); // antigo → recente
  const ultimo = ord.at(-1) ?? null;
  const anterior = ord.length >= 2 ? ord[ord.length - 2] : null;

  const variacaoKg = ultimo && anterior ? Math.round((ultimo.peso_kg - anterior.peso_kg) * 10) / 10 : null;
  const variacaoPct =
    ultimo && anterior && anterior.peso_kg > 0
      ? Math.round(((ultimo.peso_kg - anterior.peso_kg) / anterior.peso_kg) * 1000) / 10
      : null;

  const classificacao = classificarIMC(ultimo?.imc ?? null);
  const perdaRelevante = variacaoPct !== null && variacaoPct <= -PERDA_RELEVANTE_PCT;

  // Tendência de queda: as 3 últimas medições estritamente decrescentes.
  const u3 = ord.slice(-3);
  const tendenciaQueda = u3.length === 3 && u3[0].peso_kg > u3[1].peso_kg && u3[1].peso_kg > u3[2].peso_kg;

  const baixoPeso = classificacao === "baixo_peso";
  return {
    ultimo,
    anterior,
    variacaoKg,
    variacaoPct,
    classificacao,
    perdaRelevante,
    tendenciaQueda,
    baixoPeso,
    emRisco: perdaRelevante || tendenciaQueda || baixoPeso,
  };
}
