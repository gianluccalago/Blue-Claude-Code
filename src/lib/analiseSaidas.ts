import { mesesPermanencia, MOTIVOS_SAIDA } from "@/lib/cicloVida";
import type { Residente } from "@/types/database";

// ===========================================================================
// Análises da Saída (churn) — faixas de tempo de casa, matriz tempo×motivo e
// macro-grupos. Só leitura/visualização; não altera o registro de saídas.
// ===========================================================================

/** Faixas de tempo de permanência (em MESES). */
export const FAIXAS_TEMPO: { key: string; label: string; teste: (m: number) => boolean }[] = [
  { key: "ate1", label: "Até 1 mês", teste: (m) => m < 1 },
  { key: "1a3", label: "1 a 3 meses", teste: (m) => m >= 1 && m < 3 },
  { key: "3a12", label: "3 a 12 meses", teste: (m) => m >= 3 && m < 12 },
  { key: "mais1ano", label: "Mais de 1 ano", teste: (m) => m >= 12 },
];

/** Rótulo da faixa de tempo de um hóspede (entrada→saída). */
export function faixaDe(r: Residente): string {
  const m = mesesPermanencia(r.data_admissao, r.data_saida);
  if (m == null) return "Não informado";
  return FAIXAS_TEMPO.find((f) => f.teste(m))?.label ?? "Não informado";
}

/** Motivo normalizado em uma das colunas conhecidas (desconhecido/null → "Outro"). */
export function motivoColuna(r: Residente): string {
  const m = r.motivo_saida ?? "";
  return (MOTIVOS_SAIDA as readonly string[]).includes(m) ? m : "Outro";
}

// ─── Macro-grupos (motivo → categoria) — EDITÁVEL: ajuste o mapeamento aqui ──
export const MACRO_GRUPOS: { key: string; label: string; motivos: string[] }[] = [
  { key: "financeiro", label: "Financeiros", motivos: ["Inadimplência"] },
  { key: "falecimento", label: "Falecimento", motivos: ["Falecimento"] },
  { key: "transicao", label: "Transição", motivos: ["Retorno para casa", "Mudança para outro residencial"] },
  { key: "clinico", label: "Clínico", motivos: ["Aumento de grau (incompatível)"] },
  { key: "outros", label: "Outros", motivos: ["Curta permanência", "Outro"] },
];

/** Macro-grupo (rótulo) de um motivo; desconhecido cai em "Outros". */
export function macroDoMotivo(motivo: string): string {
  return MACRO_GRUPOS.find((g) => g.motivos.includes(motivo))?.label ?? "Outros";
}

/** Anos de saída presentes na lista, em ordem crescente. */
export function anosDeSaida(saidas: Residente[]): string[] {
  const set = new Set<string>();
  for (const r of saidas) if (r.data_saida) set.add(r.data_saida.slice(0, 4));
  return Array.from(set).sort();
}

/** Contagem por ano × motivo (para o gráfico agrupado por ano). */
export function contagemAnoMotivo(saidas: Residente[], anos: string[], motivos: string[]) {
  return motivos.map((motivo) => ({
    motivo,
    valores: anos.map(
      (ano) => saidas.filter((r) => r.data_saida?.slice(0, 4) === ano && motivoColuna(r) === motivo).length,
    ),
  }));
}

export interface LinhaMatriz {
  faixa: string;
  porMotivo: Record<string, number>;
  total: number;
  pct: number; // % sobre o total de saídas
}

/** Matriz faixa de tempo × motivo (+ total e % por linha). */
export function matrizTempoMotivo(saidas: Residente[], motivos: string[]): LinhaMatriz[] {
  const faixas = [...FAIXAS_TEMPO.map((f) => f.label), "Não informado"];
  const totalGeral = saidas.length || 1;
  return faixas
    .map((faixa) => {
      const doGrupo = saidas.filter((r) => faixaDe(r) === faixa);
      const porMotivo: Record<string, number> = {};
      for (const m of motivos) porMotivo[m] = doGrupo.filter((r) => motivoColuna(r) === m).length;
      const total = doGrupo.length;
      return { faixa, porMotivo, total, pct: Math.round((total / totalGeral) * 100) };
    })
    .filter((l) => l.total > 0 || l.faixa !== "Não informado"); // some "Não informado" quando vazio
}

export interface LinhaMacro {
  label: string;
  count: number;
  pct: number;
}

/** Consolidação por macro-grupo (+ % sobre o total). */
export function resumoMacro(saidas: Residente[]): LinhaMacro[] {
  const totalGeral = saidas.length || 1;
  return MACRO_GRUPOS.map((g) => {
    const count = saidas.filter((r) => macroDoMotivo(motivoColuna(r)) === g.label).length;
    return { label: g.label, count, pct: Math.round((count / totalGeral) * 100) };
  });
}
