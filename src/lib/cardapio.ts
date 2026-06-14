import type {
  Insumo,
  Prato,
  PratoInsumo,
  RefeicaoCardapio,
  TipoRestricaoCardapio,
} from "@/types/database";

// ===========================================================================
// Cardápios (N3) — restrições, refeições e cálculo de custo por porção. O custo
// por porção do cardápio (soma do custo/porção dos pratos) é base para o valor
// estimado de desperdício (N4) e o custo da refeição dos funcionários (N7).
// ===========================================================================

export const TIPOS_RESTRICAO: { value: TipoRestricaoCardapio; label: string }[] = [
  { value: "livre", label: "Livre" },
  { value: "diabetico", label: "Diabético" },
  { value: "celiaco", label: "Celíaco" },
  { value: "hipossodica", label: "Hipossódica" },
  { value: "pastosa", label: "Pastosa / disfagia" },
  { value: "outro", label: "Outro" },
];

export const RESTRICAO_LABEL: Record<string, string> = Object.fromEntries(
  TIPOS_RESTRICAO.map((r) => [r.value, r.label]),
);

export const REFEICOES: { value: RefeicaoCardapio; label: string }[] = [
  { value: "cafe_manha", label: "Café da manhã" },
  { value: "lanche_manha", label: "Lanche da manhã" },
  { value: "almoco", label: "Almoço" },
  { value: "lanche_tarde", label: "Lanche da tarde" },
  { value: "jantar", label: "Jantar" },
  { value: "ceia", label: "Ceia" },
];

export const REFEICAO_LABEL: Record<string, string> = Object.fromEntries(
  REFEICOES.map((r) => [r.value, r.label]),
);

/** Custo por porção de cada prato (custoLote ÷ rendimento), com custo ATUAL. */
export function custoPorcaoPorPrato(
  pratos: Prato[],
  pratoInsumos: PratoInsumo[],
  insumos: Insumo[],
): Map<string, number> {
  const custoInsumo = new Map(insumos.map((i) => [i.id, i.custo_unitario]));
  const lotePorPrato = new Map<string, number>();
  for (const l of pratoInsumos) {
    const add = l.quantidade * (custoInsumo.get(l.insumo_id) ?? 0);
    lotePorPrato.set(l.prato_id, (lotePorPrato.get(l.prato_id) ?? 0) + add);
  }
  const out = new Map<string, number>();
  for (const p of pratos) {
    const lote = lotePorPrato.get(p.id) ?? 0;
    out.set(p.id, p.rendimento_porcoes > 0 ? lote / p.rendimento_porcoes : 0);
  }
  return out;
}
