// ===========================================================================
// ROTINA DE CUIDADOS — funções puras (sem React, sem rede).
//
// 1) PERIODICIDADE (0146): tarefa "a cada N dias" (ex.: aferir pressão a cada
//    15 dias). Vence N dias depois da ÚLTIMA execução registrada (ou em
//    `inicio_em`, se nunca feita) e fica no checklist até ser feita.
// 2) PAINEL DA COORDENAÇÃO: o que ficou sem fazer — atrasadas no plantão
//    atual, sem hora marcada chegando ao fim do turno (2 h antes) e o que o
//    plantão anterior deixou de fazer.
// ===========================================================================

import { dataISO } from "@/lib/utils";
import {
  diaAnterior,
  instanteNoPlantao,
  instanteSP,
  janelaDoPlantao,
  dentroDaJanela,
  tarefaNoTurno,
  turnoTerminando,
  type JanelaPlantao,
} from "@/lib/plantao";
import type { PlanoCuidadoItem, TagTurno, TarefaRegistro } from "@/types/database";

const DIA_MS = 24 * 60 * 60 * 1000;

// ─── Periodicidade ────────────────────────────────────────────────────────────

export interface ItemPeriodico {
  intervalo_dias?: number | null;
  inicio_em?: string | null;
}

/** Soma dias a uma data YYYY-MM-DD (no fuso da casa, sem depender do device). */
export function somarDias(data: string, dias: number): string {
  return dataISO(new Date(instanteSP(data, "12:00").getTime() + dias * DIA_MS));
}

/** Dias de `de` até `ate` (datas YYYY-MM-DD; positivo se `ate` é depois). */
export function diasEntre(de: string, ate: string): number {
  return Math.round((instanteSP(ate, "12:00").getTime() - instanteSP(de, "12:00").getTime()) / DIA_MS);
}

export function ehPeriodica(item: ItemPeriodico): boolean {
  return !!item.intervalo_dias && item.intervalo_dias > 1;
}

/**
 * Data em que a tarefa periódica vence: última execução + N dias; nunca feita
 * → `inicio_em`. Tarefa diária → null (vence todo dia).
 */
export function proximoVencimento(item: ItemPeriodico, ultima: string | null): string | null {
  if (!ehPeriodica(item)) return null;
  if (ultima) return somarDias(ultima, item.intervalo_dias!);
  return item.inicio_em ?? null;
}

/** A tarefa está devida em `data`? Diária: sempre. Periódica: se já venceu. */
export function devidaNaData(item: ItemPeriodico, ultima: string | null, data: string): boolean {
  if (!ehPeriodica(item)) return true;
  const venc = proximoVencimento(item, ultima);
  return !venc || data >= venc;
}

/**
 * Última execução (data do plantão) de cada item, considerando só registros
 * ANTERIORES a `antesDe` — o que foi feito no próprio dia conta como "feito
 * hoje", não como "última vez", para a tarefa continuar visível como feita.
 */
export function ultimaExecucaoPorItem(
  registros: ReadonlyArray<Pick<TarefaRegistro, "tarefa" | "data">>,
  antesDe: string,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of registros) {
    if (r.data >= antesDe) continue;
    const atual = m.get(r.tarefa);
    if (!atual || r.data > atual) m.set(r.tarefa, r.data);
  }
  return m;
}

/** "A cada 15 dias" / "Todo dia". */
export function rotuloIntervalo(intervalo: number | null | undefined): string {
  return intervalo && intervalo > 1 ? `A cada ${intervalo} dias` : "Todo dia";
}

/** Quantos dias de atraso tem uma periódica em `data` (0 = vence hoje). */
export function diasDeAtraso(item: ItemPeriodico, ultima: string | null, data: string): number {
  const venc = proximoVencimento(item, ultima);
  return venc ? Math.max(0, diasEntre(venc, data)) : 0;
}

// ─── Plantões de referência (painel da Coordenação) ──────────────────────────

export interface PlantaoRef {
  tag: TagTurno;
  dataPlantao: string;
  turno: { inicio: string; fim: string; tag: TagTurno };
  janela: JanelaPlantao;
}

/** Plantão-padrão da escala (Diurno 07–19 / Noturno 19–07) no fuso da casa. */
export function plantaoPadrao(tag: TagTurno, dataPlantao: string): PlantaoRef {
  const inicio = instanteSP(dataPlantao, tag === "diurno" ? "07:00" : "19:00");
  const fim = new Date(inicio.getTime() + 12 * 60 * 60 * 1000);
  const turno = { inicio: inicio.toISOString(), fim: fim.toISOString(), tag };
  return { tag, dataPlantao, turno, janela: janelaDoPlantao(turno) };
}

/** Plantão em curso e o imediatamente anterior. */
export function plantaoAtualEAnterior(agora: Date = new Date()): { atual: PlantaoRef; anterior: PlantaoRef } {
  const hoje = dataISO(agora);
  const diurnoHoje = plantaoPadrao("diurno", hoje);
  const inicioDiurno = new Date(diurnoHoje.turno.inicio).getTime();
  const t = agora.getTime();
  if (t < inicioDiurno) {
    // Madrugada: noturno da véspera; o anterior é o diurno da véspera.
    const ontem = diaAnterior(hoje);
    return { atual: plantaoPadrao("noturno", ontem), anterior: plantaoPadrao("diurno", ontem) };
  }
  if (t < inicioDiurno + 12 * 60 * 60 * 1000) {
    return { atual: diurnoHoje, anterior: plantaoPadrao("noturno", diaAnterior(hoje)) };
  }
  return { atual: plantaoPadrao("noturno", hoje), anterior: diurnoHoje };
}

// ─── O que ficou sem fazer ───────────────────────────────────────────────────

export type SituacaoRotina = "atrasada" | "vencendo" | "nao_feita";

export interface PendenciaRotina {
  item: PlanoCuidadoItem;
  situacao: SituacaoRotina;
  plantao: PlantaoRef;
  /** Instante do horário fixo no plantão (null para tarefa sem hora marcada). */
  horarioEm: Date | null;
  /** Periódica: dias de atraso em relação ao vencimento (0 = vencia hoje). */
  diasAtraso: number;
}

type ItemRotina = PlanoCuidadoItem;
type RegistroRotina = Pick<TarefaRegistro, "tarefa" | "data" | "feito_em">;

/** A tarefa foi feita neste plantão? Periódica: basta um registro na data. */
export function feitaNoPlantao(item: ItemRotina, registros: ReadonlyArray<RegistroRotina>, p: PlantaoRef): boolean {
  if (ehPeriodica(item)) return registros.some((r) => r.tarefa === item.id && r.data === p.dataPlantao);
  return registros.some((r) => r.tarefa === item.id && dentroDaJanela(r.feito_em, p.janela));
}

/**
 * Pendências da rotina num plantão.
 * - `encerrado` (plantão anterior): tudo o que era devido e não foi feito.
 * - em curso: com horário fixo, só o que passou de horário + tolerância;
 *   sem hora marcada, só nas 2 últimas horas do turno.
 * `historico` = registros usados para achar a última execução das periódicas.
 */
export function pendenciasNoPlantao(args: {
  itens: ReadonlyArray<ItemRotina>;
  registros: ReadonlyArray<RegistroRotina>;
  historico: ReadonlyArray<Pick<TarefaRegistro, "tarefa" | "data">>;
  plantao: PlantaoRef;
  encerrado: boolean;
  agora?: Date;
}): PendenciaRotina[] {
  const { itens, registros, historico, plantao, encerrado } = args;
  const agora = args.agora ?? new Date();
  const ultimas = ultimaExecucaoPorItem(historico, plantao.dataPlantao);
  const saida: PendenciaRotina[] = [];
  for (const item of itens) {
    if (!tarefaNoTurno(item, plantao.turno)) continue;
    const ultima = ultimas.get(item.id) ?? null;
    if (!devidaNaData(item, ultima, plantao.dataPlantao)) continue;
    if (item.inicio_em && plantao.dataPlantao < item.inicio_em) continue;
    if (feitaNoPlantao(item, registros, plantao)) continue;
    const horarioEm = item.turno_livre ? null : instanteNoPlantao(item.horario, plantao.janela);
    const diasAtraso = diasDeAtraso(item, ultima, plantao.dataPlantao);
    if (encerrado) {
      saida.push({ item, situacao: "nao_feita", plantao, horarioEm, diasAtraso });
      continue;
    }
    if (item.turno_livre || !horarioEm) {
      if (turnoTerminando(plantao.janela, agora)) saida.push({ item, situacao: "vencendo", plantao, horarioEm, diasAtraso });
      continue;
    }
    if (agora.getTime() > horarioEm.getTime() + item.tolerancia_minutos * 60 * 1000)
      saida.push({ item, situacao: "atrasada", plantao, horarioEm, diasAtraso });
  }
  return saida.sort(
    (a, b) =>
      (a.horarioEm?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.horarioEm?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
      a.item.tarefa.localeCompare(b.item.tarefa, "pt-BR"),
  );
}
