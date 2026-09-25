import { parseQuarto } from "@/lib/quarto";
import type { Ocupacao, Residente } from "@/types/database";

// ===========================================================================
// OCUPAÇÃO — leitos × suítes × Day Care (FIN-03).
//
// Antes, a taxa dividia HÓSPEDES por SUÍTES (capacidade `total_suites`): uma
// suíte dupla com dois hóspedes contava como "200%" daquela suíte, e a casa
// inteira parecia mais cheia do que está. Aqui as três grandezas ficam
// separadas e a taxa é LEITOS OCUPADOS ÷ LEITOS TOTAIS:
//   • leito ocupado  = 1 por hóspede ativo em longa/curta permanência;
//   • suíte ocupada  = suíte distinta (bloco+andar+suíte do nº do quarto);
//   • Day Care       = contado à parte; NUNCA entra na ocupação de leito.
// Leitos totais vêm da configuração `total_leitos`. Se só `total_suites` estiver
// cadastrado, os leitos são DERIVADOS da ocupação cadastrada (simples=1,
// duplo=2, triplo=3) das suítes ocupadas + 1 leito por suíte vazia — e a
// estimativa é sinalizada (`capacidadeLeitosEstimada`) para a tela avisar.
// ===========================================================================

export const LEITOS_POR_OCUPACAO: Record<Ocupacao, number> = { simples: 1, duplo: 2, triplo: 3 };

type ResidenteOcupacao = Pick<Residente, "id" | "quarto" | "ocupacao" | "modalidade">;

/** Chave da suíte (sem a letra do leito). Quarto ilegível → o próprio texto; sem quarto → o hóspede. */
export function chaveSuite(r: Pick<Residente, "id" | "quarto">): string {
  const p = parseQuarto(r.quarto);
  if (p.bloco != null && p.andar != null && p.suite != null) return `${p.bloco}-${p.andar}-${String(p.suite).padStart(2, "0")}`;
  const bruto = r.quarto?.trim();
  return bruto ? `quarto:${bruto}` : `sem-quarto:${r.id}`;
}

export interface OcupacaoLeitos {
  /** Hóspedes ativos que ocupam leito (longa + curta permanência) — 1 leito cada. */
  leitosOcupados: number;
  /** Suítes distintas ocupadas. */
  suitesOcupadas: number;
  /** Leitos oferecidos pelas suítes ocupadas (ocupação cadastrada: simples/duplo/triplo). */
  leitosDasSuitesOcupadas: number;
  /** Frequentadores de Day Care ativos — à parte, sem leito. */
  dayCare: number;
  capacidadeSuites: number | null;
  capacidadeLeitos: number | null;
  /** true quando `capacidadeLeitos` foi derivada de `total_suites` (sem `total_leitos`). */
  capacidadeLeitosEstimada: boolean;
  /** % leitos ocupados ÷ leitos totais (arredondado); null sem capacidade. */
  taxaOcupacao: number | null;
}

function inteiroPositivo(v: string | number | null | undefined): number | null {
  const n = typeof v === "number" ? v : v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Calcula a ocupação a partir dos hóspedes que ocupam leito (SEM Day Care —
 * quem passar Day Care na lista é ignorado) e das capacidades configuradas.
 */
export function calcularOcupacaoLeitos(
  residentesLeito: ResidenteOcupacao[],
  dayCare: number,
  totalSuites: string | number | null | undefined,
  totalLeitos: string | number | null | undefined,
): OcupacaoLeitos {
  const comLeito = residentesLeito.filter((r) => r.modalidade !== "day_care");
  const leitosOcupados = comLeito.length;

  // Leitos por suíte ocupada: a ocupação cadastrada (maior entre os hóspedes
  // da suíte) — nunca menor que o nº de hóspedes que estão nela.
  const suites = new Map<string, { hospedes: number; leitos: number }>();
  for (const r of comLeito) {
    const k = chaveSuite(r);
    const s = suites.get(k) ?? { hospedes: 0, leitos: 0 };
    s.hospedes += 1;
    s.leitos = Math.max(s.leitos, r.ocupacao ? LEITOS_POR_OCUPACAO[r.ocupacao] : 1);
    suites.set(k, s);
  }
  let leitosDasSuitesOcupadas = 0;
  for (const s of suites.values()) leitosDasSuitesOcupadas += Math.max(s.leitos, s.hospedes);
  const suitesOcupadas = suites.size;

  const capacidadeSuites = inteiroPositivo(totalSuites);
  let capacidadeLeitos = inteiroPositivo(totalLeitos);
  let capacidadeLeitosEstimada = false;
  if (capacidadeLeitos == null && capacidadeSuites != null) {
    // Derivado: suítes ocupadas valem a ocupação cadastrada; as vazias, 1 leito.
    capacidadeLeitos = leitosDasSuitesOcupadas + Math.max(0, capacidadeSuites - suitesOcupadas);
    capacidadeLeitosEstimada = true;
  }
  // Nunca mostrar mais de 100%: a capacidade cadastrada não pode ser menor que o ocupado.
  if (capacidadeLeitos != null && capacidadeLeitos < leitosOcupados) capacidadeLeitos = leitosOcupados;

  return {
    leitosOcupados,
    suitesOcupadas,
    leitosDasSuitesOcupadas,
    dayCare,
    capacidadeSuites,
    capacidadeLeitos,
    capacidadeLeitosEstimada,
    taxaOcupacao: capacidadeLeitos ? Math.round((leitosOcupados / capacidadeLeitos) * 100) : null,
  };
}
