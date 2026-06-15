/**
 * Enxoval da casa (patrimônio) — Lavanderia interna.
 * Rótulos e cálculos de apoio. O foco é patrimônio e reposição, não o rastreio
 * diário de lavagem (resolvido fora do app).
 */
import type { Enxoval, EnxovalCategoria, EnxovalMovimento, EnxovalMovimentoTipo } from "@/types/database";

export const CATEGORIAS_ENXOVAL: { value: EnxovalCategoria; label: string }[] = [
  { value: "roupa_cama", label: "Roupa de cama" },
  { value: "fronha", label: "Fronha" },
  { value: "toalha_banho", label: "Toalha de banho" },
  { value: "toalha_rosto", label: "Toalha de rosto" },
  { value: "cobertor_manta", label: "Cobertor/manta" },
  { value: "outro", label: "Outro" },
];

export const CATEGORIA_ENXOVAL_LABEL: Record<EnxovalCategoria, string> = {
  roupa_cama: "Roupa de cama",
  fronha: "Fronha",
  toalha_banho: "Toalha de banho",
  toalha_rosto: "Toalha de rosto",
  cobertor_manta: "Cobertor/manta",
  outro: "Outro",
};

export const MOVIMENTO_ENXOVAL_LABEL: Record<EnxovalMovimentoTipo, string> = {
  entrada: "Entrada/reposição",
  baixa_perda: "Baixa por perda/descarte",
  ajuste: "Ajuste de inventário",
};

/** Disponível (limpo) abaixo do mínimo → risco de faltar. */
export function abaixoDoMinimo(i: Enxoval): boolean {
  return i.quantidade_disponivel < i.estoque_minimo;
}

/** Peças em circulação (em uso/lavando) = total − disponível limpo. */
export function emCirculacao(i: Enxoval): number {
  return Math.max(0, i.quantidade_total - i.quantidade_disponivel);
}

/** Resumo das baixas por perda/descarte no mês (peças e nº de lançamentos). */
export function baixasPerdaDoMes(
  movimentos: EnxovalMovimento[],
  ref: Date = new Date(),
): { pecas: number; lancamentos: number } {
  const ano = ref.getFullYear();
  const mes = ref.getMonth();
  const doMes = movimentos.filter((m) => {
    if (m.tipo !== "baixa_perda") return false;
    const d = new Date(m.registrado_em);
    return d.getFullYear() === ano && d.getMonth() === mes;
  });
  return {
    pecas: doMes.reduce((s, m) => s + m.quantidade, 0),
    lancamentos: doMes.length,
  };
}
