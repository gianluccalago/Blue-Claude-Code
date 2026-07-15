// ===========================================================================
// MÓDULO OBRA · Cálculos puros do CRONOGRAMA (Gantt) — testáveis sem DOM.
// A escala é linear em dias; as posições saem em % da janela [min, max].
// ===========================================================================

/** Dias corridos entre duas datas ISO (b − a). */
function dias(aISO: string, bISO: string): number {
  return Math.round((Date.parse(`${bISO}T00:00:00Z`) - Date.parse(`${aISO}T00:00:00Z`)) / 86_400_000);
}

/** Soma dias a uma data ISO. */
export function somarDias(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Primeiro dia do mês da data. */
function inicioDoMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

/** Primeiro dia do mês SEGUINTE ao da data. */
function inicioDoMesSeguinte(iso: string): string {
  const [a, m] = iso.slice(0, 7).split("-").map(Number);
  const prox = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
  return `${prox}-01`;
}

export interface JanelaGantt {
  /** Início da janela (1º dia do mês da menor data). */
  min: string;
  /** Fim da janela (1º dia do mês seguinte à maior data). */
  max: string;
  /** Total de dias da janela (≥ 1). */
  totalDias: number;
}

/**
 * Janela do gráfico: do 1º dia do mês da menor data ao 1º dia do mês seguinte
 * à maior. `hoje` sempre entra no cálculo (a linha "hoje" nunca fica fora).
 * Sem nenhuma data, devolve os 12 meses a partir do mês de hoje.
 */
export function janelaGantt(datas: (string | null | undefined)[], hoje: string): JanelaGantt {
  const validas = datas.filter((d): d is string => !!d);
  validas.push(hoje);
  const menor = validas.reduce((a, b) => (a <= b ? a : b));
  const maior = validas.reduce((a, b) => (a >= b ? a : b));
  let min = inicioDoMes(menor);
  let max = inicioDoMesSeguinte(maior);
  // Janela mínima de 6 meses para o gráfico não ficar "espremido".
  if (dias(min, max) < 180) max = inicioDoMesSeguinte(somarDias(min, 180));
  return { min, max, totalDias: Math.max(1, dias(min, max)) };
}

/** Posição de uma data na janela, em % (clampada em [0, 100]). */
export function posPct(iso: string, janela: JanelaGantt): number {
  const p = (dias(janela.min, iso) / janela.totalDias) * 100;
  return Math.min(100, Math.max(0, Math.round(p * 100) / 100));
}

/** Largura entre duas datas, em % da janela (mínimo 0). */
export function larguraPct(inicioISO: string, fimISO: string, janela: JanelaGantt): number {
  return Math.max(0, posPct(fimISO, janela) - posPct(inicioISO, janela));
}

/** Marcações de mês da janela (1º dia de cada mês), para o grid/rotulagem. */
export function mesesDaJanela(janela: JanelaGantt): string[] {
  const meses: string[] = [];
  let cursor = janela.min;
  while (cursor < janela.max) {
    meses.push(cursor);
    cursor = inicioDoMesSeguinte(cursor);
  }
  return meses;
}

export type StatusGantt = "concluida" | "andamento" | "atrasada" | "prevista";

/**
 * Status da barra de uma FASE no Gantt:
 *  - concluída: TRP/TRD emitido;
 *  - atrasada: em andamento com fim previsto vencido;
 *  - andamento: em andamento no prazo (ou sem fim previsto);
 *  - prevista: não iniciada.
 */
export function statusBarraFase(
  fase: { status: string; data_fim_prevista: string | null },
  hoje: string,
): StatusGantt {
  if (fase.status === "trp_emitido" || fase.status === "trd_emitido") return "concluida";
  if (fase.status === "em_andamento") {
    return fase.data_fim_prevista && fase.data_fim_prevista < hoje ? "atrasada" : "andamento";
  }
  return "prevista";
}

/**
 * Status da barra de uma DISCIPLINA de projeto:
 *  - concluída: Concluído/Pago (ou com data de conclusão);
 *  - atrasada: prazo (data_base + prazo_dias) vencido sem conclusão;
 *  - andamento: com data-base dentro do prazo;
 *  - prevista: sem data-base.
 */
export function statusBarraDisciplina(
  d: { status: string; data_base: string | null; prazo_dias: number | null; data_conclusao: string | null },
  hoje: string,
): StatusGantt {
  if (d.status === "Concluído" || d.status === "Pago" || d.data_conclusao) return "concluida";
  if (!d.data_base) return "prevista";
  const limite = d.prazo_dias != null ? somarDias(d.data_base, d.prazo_dias) : null;
  if (limite && limite < hoje) return "atrasada";
  return "andamento";
}
