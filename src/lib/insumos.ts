import type { CategoriaInsumo, UnidadeInsumo } from "@/types/database";

// ===========================================================================
// Insumos (Nutricionista) — categorias e unidades. Estes insumos vão alimentar
// as fichas técnicas de pratos (N2), o cálculo de cardápio e o valor estimado
// de desperdício nos blocos seguintes.
// ===========================================================================

export const CATEGORIAS_INSUMO: { value: CategoriaInsumo; label: string }[] = [
  { value: "supermercado", label: "Supermercado" },
  { value: "hortifruti", label: "Hortifruti" },
  { value: "carnes", label: "Carnes" },
  { value: "panificacao", label: "Panificação" },
];

export const CATEGORIA_INSUMO_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS_INSUMO.map((c) => [c.value, c.label]),
);

export const UNIDADES_INSUMO: UnidadeInsumo[] = ["kg", "g", "L", "ml", "unidade", "duzia", "pacote"];
