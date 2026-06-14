import type { CategoriaPrato } from "@/types/database";

// ===========================================================================
// Pratos / fichas técnicas (Nutricionista, N2). O custo é calculado a partir
// dos insumos (N1) com o custo ATUAL — alimentará os cardápios (N3) e o cálculo
// de desperdício por porção (N4).
// ===========================================================================

export const CATEGORIAS_PRATO: { value: CategoriaPrato; label: string }[] = [
  { value: "prato_principal", label: "Prato principal" },
  { value: "guarnicao", label: "Guarnição" },
  { value: "salada", label: "Salada" },
  { value: "sobremesa", label: "Sobremesa" },
  { value: "cafe_lanche", label: "Café / lanche" },
  { value: "outro", label: "Outro" },
];

export const CATEGORIA_PRATO_LABEL: Record<string, string> = Object.fromEntries(
  CATEGORIAS_PRATO.map((c) => [c.value, c.label]),
);
