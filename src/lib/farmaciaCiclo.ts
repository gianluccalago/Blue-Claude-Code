/**
 * Ciclo ÚNICO mensal da farmácia + cálculos de entrada proporcional e viagem.
 *
 * A casa renova/pede no MESMO período (referência: dia 20). Hóspede que entra no
 * meio do mês NÃO ganha um ciclo deslocado: ele entra no próximo pedido cheio,
 * junto com todos. Os primeiros dias (até o próximo ciclo) são, por padrão,
 * cobertos pela família (em geral já têm a medicação em casa) — por isso o app
 * não gera pedido de compra proporcional automático; é uma ação OPCIONAL e
 * discreta da farmácia.
 */
import type { ItemDispensacaoJson, Prescricao } from "@/types/database";

/** Dia de referência do ciclo único (pedido/provisionamento mensal). */
export const DIA_REFERENCIA_CICLO = 20;

// ─── Detecção de entrada no meio do mês ──────────────────────────────────────

/** "YYYY-MM-DD" → "YYYY-MM". */
function mesDe(dataISO: string): string {
  return dataISO.slice(0, 7);
}

/** O hóspede foi admitido no mês de referência ("YYYY-MM")? */
export function entrouNoMes(dataAdmissao: string | null | undefined, mesRef: string): boolean {
  if (!dataAdmissao) return false;
  return mesDe(dataAdmissao) === mesRef;
}

// ─── Próximo ciclo / dias restantes ──────────────────────────────────────────

/** Data do próximo ciclo (dia 20) a partir de hoje (meia-noite local). */
export function proximoCiclo(hoje: Date = new Date()): Date {
  const dia = hoje.getDate();
  if (dia < DIA_REFERENCIA_CICLO) {
    return new Date(hoje.getFullYear(), hoje.getMonth(), DIA_REFERENCIA_CICLO);
  }
  // Já passou (ou é) o dia 20 → próximo ciclo é dia 20 do mês seguinte.
  return new Date(hoje.getFullYear(), hoje.getMonth() + 1, DIA_REFERENCIA_CICLO);
}

/** Quantos dias até o próximo ciclo (mínimo 1). Sugestão para a cobertura inicial. */
export function diasAteProximoCiclo(hoje: Date = new Date()): number {
  const alvo = proximoCiclo(hoje);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((alvo.getTime() - base.getTime()) / 86_400_000);
  return Math.max(1, dias);
}

// ─── Cálculo por dias (entrada proporcional e viagem) ────────────────────────

export interface ItemCalculadoPorDias {
  medicamento: string;
  /** Soma da quantidade diária somando todos os períodos do medicamento. */
  doseDiaria: number;
  unidade: string;
  /** doseDiaria × dias (arredondado p/ cima). Editável na UI. */
  quantidade: number;
  /** Texto "X/dia × N dias". */
  detalhes: string;
}

/** Extrai número + unidade de um campo de quantidade textual ("1 comprimido"). */
export function parsearQuantidadeMed(q: string | null): { numero: number; unidade: string } {
  if (!q) return { numero: 1, unidade: "unidade" };
  const m = q.trim().match(/^(\d+(?:[.,]\d+)?)\s*(.*)/);
  if (!m) return { numero: 1, unidade: q.trim() };
  const numero = parseFloat(m[1].replace(",", "."));
  return { numero: isNaN(numero) ? 1 : numero, unidade: m[2].trim() || "unidade" };
}

/**
 * Agrupa as prescrições por medicamento (somando a dose diária de todos os
 * períodos) e multiplica por `dias`. `apenasOral` filtra via === "oral" (usado
 * na baixa de viagem; o hóspede leva os comprimidos de boca).
 */
export function calcularPorDias(
  prescricoes: Prescricao[],
  dias: number,
  opts: { apenasOral?: boolean } = {},
): ItemCalculadoPorDias[] {
  const grupos = new Map<string, { doseDiaria: number; unidade: string }>();

  for (const p of prescricoes) {
    if (opts.apenasOral && p.via !== "oral") continue;
    const { numero, unidade } = parsearQuantidadeMed(p.quantidade);
    if (!grupos.has(p.medicamento)) grupos.set(p.medicamento, { doseDiaria: 0, unidade });
    grupos.get(p.medicamento)!.doseDiaria += numero;
  }

  const diasSeguro = Math.max(0, Math.floor(dias));
  return Array.from(grupos.entries())
    .map(([medicamento, { doseDiaria, unidade }]) => {
      const doseFmt = Number.isInteger(doseDiaria)
        ? String(doseDiaria)
        : doseDiaria.toFixed(1).replace(".", ",");
      return {
        medicamento,
        doseDiaria,
        unidade,
        quantidade: Math.ceil(doseDiaria * diasSeguro),
        detalhes: `${doseFmt}/dia × ${diasSeguro} dia${diasSeguro !== 1 ? "s" : ""}`,
      };
    })
    .sort((a, b) => a.medicamento.localeCompare(b.medicamento, "pt-BR"));
}

/** Converte itens calculados/editados no formato gravável (jsonb). */
export function paraItensJson(
  itens: ItemCalculadoPorDias[],
  quantidades: Record<string, number>,
): ItemDispensacaoJson[] {
  return itens
    .map((i) => ({
      medicamento: i.medicamento,
      quantidade: quantidades[i.medicamento] ?? i.quantidade,
      unidade: i.unidade,
    }))
    .filter((i) => i.quantidade > 0);
}
