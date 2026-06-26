import type { GrauDependencia, Residente } from "@/types/database";

// ===========================================================================
// PROPORÇÃO MÍNIMA DE CUIDADORES — RDC 502/2021, Art. 16, II.
//
// Proporção mínima por grau de dependência (1 cuidador para cada N idosos,
// "ou fração" = arredondar para CIMA):
//   • Grau I   : 1 : 20  (carga de 8h/dia)
//   • Grau II  : 1 : 10  (por turno)
//   • Grau III : 1 : 6   (por turno)
//
// MÍNIMO LEGAL POR TURNO = teto(grauI/20) + teto(grauII/10) + teto(grauIII/6).
//
// INTERPRETAÇÃO (ajustável): o Grau I é definido por DIA/8h e o II/III por
// TURNO. Aqui aplicamos a regra de forma CONSERVADORA — exigindo a parcela do
// Grau I em todos os turnos. É uma verificação de APOIO baseada na proporção da
// RDC; o dimensionamento final é responsabilidade da gestão/RT. Para mudar a
// leitura (ex.: ratear o Grau I só no turno diurno), ajuste `incluirGrauIPorTurno`.
// ===========================================================================

export const PROPORCAO_RDC: Record<GrauDependencia, number> = { I: 20, II: 10, III: 6 };

/** Conservador: contar a parcela do Grau I em todos os turnos. */
export const incluirGrauIPorTurno = true;

export interface ContagemGrau {
  I: number;
  II: number;
  III: number;
  semGrau: number; // hóspedes sem grau definido — NÃO entram no cálculo legal
}

export function contarPorGrau(residentes: Pick<Residente, "grau_dependencia">[]): ContagemGrau {
  const c: ContagemGrau = { I: 0, II: 0, III: 0, semGrau: 0 };
  for (const r of residentes) {
    if (r.grau_dependencia === "I" || r.grau_dependencia === "II" || r.grau_dependencia === "III") {
      c[r.grau_dependencia] += 1;
    } else {
      c.semGrau += 1;
    }
  }
  return c;
}

/** Mínimo legal de cuidadores no turno (arredondamento para cima por grau). */
export function minimoCuidadores(c: ContagemGrau): number {
  const grauI = incluirGrauIPorTurno ? Math.ceil(c.I / PROPORCAO_RDC.I) : 0;
  return grauI + Math.ceil(c.II / PROPORCAO_RDC.II) + Math.ceil(c.III / PROPORCAO_RDC.III);
}

export type StatusProporcao = "adequado" | "abaixo";

export function statusProporcao(escalado: number, minimo: number): StatusProporcao {
  return escalado >= minimo ? "adequado" : "abaixo";
}

export const STATUS_PROPORCAO_LABEL: Record<StatusProporcao, string> = {
  adequado: "Adequado",
  abaixo: "Abaixo do mínimo legal",
};

export const STATUS_PROPORCAO_VARIANTE: Record<StatusProporcao, "success" | "destructive"> = {
  adequado: "success",
  abaixo: "destructive",
};

/**
 * Residentes PRESENTES num turno de uma data: ocupam leito (longa/curta) em
 * todos os turnos; day care só no turno diurno. Para datas passadas, usa as
 * datas de admissão/saída (não o status atual). Grau usado = o REAL atual
 * (grau_dependencia) — para histórico é uma aproximação (documentada).
 */
export function residentesPresentesNoTurno(
  residentes: Residente[],
  dataISO: string,
  tag: "diurno" | "noturno",
): Residente[] {
  return residentes.filter((r) => {
    const entrou = !r.data_admissao || r.data_admissao <= dataISO;
    const presente = !r.data_saida || r.data_saida >= dataISO;
    if (!entrou || !presente) return false;
    if (r.modalidade === "day_care" && tag !== "diurno") return false;
    return true;
  });
}
