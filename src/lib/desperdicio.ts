import type { RefeicaoDesperdicio } from "@/types/database";
import { formatarMoeda } from "@/lib/mensalidade";

// ===========================================================================
// Desperdício (N4) — estimativa APROXIMADA do valor descartado.
//
// FÓRMULA (documentada e aproximada — NÃO é dado contábil):
//   custo médio por kg = custo/porção do cardápio do dia (N3) ÷ peso médio
//                        por porção.
//   custo estimado     = peso_kg descartado × custo médio por kg.
//   Sem cardápio/custo no dia → usa um custo médio por kg de FALLBACK e marca
//   o método como estimativa de fallback.
//
// As duas constantes abaixo são CALIBRÁVEIS pela Nutri (ajuste aqui):
//   • PESO_MEDIO_POR_PORCAO_KG: quanto pesa, em média, uma porção servida.
//   • CUSTO_MEDIO_KG_FALLBACK:  custo médio por kg quando não há cardápio.
// ===========================================================================

export const PESO_MEDIO_POR_PORCAO_KG = 0.4; // kg por porção (calibrável)
export const CUSTO_MEDIO_KG_FALLBACK = 18.0; // R$/kg (calibrável)

export const REFEICOES_DESPERDICIO: { value: RefeicaoDesperdicio; label: string }[] = [
  { value: "geral_dia", label: "Geral do dia" },
  { value: "cafe_manha", label: "Café da manhã" },
  { value: "lanche_manha", label: "Lanche da manhã" },
  { value: "almoco", label: "Almoço" },
  { value: "lanche_tarde", label: "Lanche da tarde" },
  { value: "jantar", label: "Jantar" },
  { value: "ceia", label: "Ceia" },
];

export const REFEICAO_DESPERDICIO_LABEL: Record<string, string> = Object.fromEntries(
  REFEICOES_DESPERDICIO.map((r) => [r.value, r.label]),
);

export interface EstimativaDesperdicio {
  custoMedioKg: number;
  custoEstimado: number;
  fallback: boolean;
  metodo: string;
}

/**
 * Estima o custo do desperdício. `custoPorcaoDia` = soma do custo/porção dos
 * pratos do cardápio do dia (N3); se 0/ausente, usa o fallback.
 */
export function estimarDesperdicio(pesoKg: number, custoPorcaoDia: number): EstimativaDesperdicio {
  const temCardapio = custoPorcaoDia > 0;
  const custoMedioKg = temCardapio
    ? custoPorcaoDia / PESO_MEDIO_POR_PORCAO_KG
    : CUSTO_MEDIO_KG_FALLBACK;
  const custoEstimado = pesoKg * custoMedioKg;
  const metodo = temCardapio
    ? `${pesoKg.toLocaleString("pt-BR")} kg × ${formatarMoeda(custoMedioKg)}/kg ` +
      `(custo/porção do cardápio do dia ${formatarMoeda(custoPorcaoDia)} ÷ ${PESO_MEDIO_POR_PORCAO_KG} kg/porção)`
    : `${pesoKg.toLocaleString("pt-BR")} kg × ${formatarMoeda(custoMedioKg)}/kg (fallback — sem cardápio no dia)`;
  return { custoMedioKg, custoEstimado, fallback: !temCardapio, metodo };
}
