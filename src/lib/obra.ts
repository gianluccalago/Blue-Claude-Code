import type { ObraChecklistExecucao, ObraEtapa, ObraFase, ObraFaseStatus } from "@/types/database";

// ===========================================================================
// Módulo Obra — domínio puro (sem I/O). Avanço físico = soma dos PESOS
// PONDERADOS pelo % de conclusão do último registro de cada etapa (evolução
// visual granular). O DINHEIRO da MO permanece objetivo: uma etapa só é
// "medível" no BM ao atingir 100% (etapaConcluida).
// ===========================================================================

export const OBRA_FASE_STATUS_LABEL: Record<ObraFaseStatus, string> = {
  nao_iniciada: "Não iniciada",
  em_andamento: "Em andamento",
  trp_emitido: "TRP emitido",
  trd_emitido: "TRD emitido",
};

export const OBRA_FASE_STATUS_VARIANTE: Record<ObraFaseStatus, "muted" | "default" | "warning" | "success"> = {
  nao_iniciada: "muted",
  em_andamento: "default",
  trp_emitido: "warning",
  trd_emitido: "success",
};

/** Estado atual de cada etapa = registro MAIS RECENTE do checklist. */
export function ultimaVerificacaoPorEtapa(
  checklist: ObraChecklistExecucao[],
): Map<string, ObraChecklistExecucao> {
  const mapa = new Map<string, ObraChecklistExecucao>();
  for (const c of checklist) {
    const atual = mapa.get(c.etapa_id);
    if (!atual || c.registrado_em > atual.registrado_em) mapa.set(c.etapa_id, c);
  }
  return mapa;
}

/** % de conclusão atual da etapa (último registro; 0 se nunca registrada). */
export function percentualEtapa(
  etapaId: string,
  ultimaPorEtapa: Map<string, ObraChecklistExecucao>,
): number {
  return ultimaPorEtapa.get(etapaId)?.percentual ?? 0;
}

/** Etapa "concluída" (medível no BM) = último registro em 100%. */
export function etapaConcluida(
  etapaId: string,
  ultimaPorEtapa: Map<string, ObraChecklistExecucao>,
): boolean {
  return percentualEtapa(etapaId, ultimaPorEtapa) >= 100;
}

/** Avanço físico da fase (%) = soma dos pesos PONDERADOS pelo % de cada etapa. */
export function avancoFisico(etapas: ObraEtapa[], ultimaPorEtapa: Map<string, ObraChecklistExecucao>): number {
  const total = etapas.reduce((s, e) => s + (e.peso_pct * percentualEtapa(e.id, ultimaPorEtapa)) / 100, 0);
  return Math.round(total * 10) / 10;
}

/** Soma dos pesos da fase (a UI valida contra 100 antes de salvar edição). */
export function somaPesos(etapas: { peso_pct: number }[]): number {
  return etapas.reduce((s, e) => s + e.peso_pct, 0);
}

/**
 * Sequência obrigatória do contrato: a fase N só pode INICIAR se for a
 * primeira ou se a anterior já tem TRP emitido (a aprovação expressa é o
 * próprio ato do master/direção clicar em iniciar).
 */
export function podeIniciarFase(fase: ObraFase, todas: ObraFase[]): { pode: boolean; motivo: string | null } {
  if (fase.status !== "nao_iniciada") return { pode: false, motivo: "A fase já foi iniciada." };
  if (fase.numero === 1) return { pode: true, motivo: null };
  const anterior = todas.find((f) => f.numero === fase.numero - 1);
  if (!anterior) return { pode: false, motivo: "Fase anterior não encontrada." };
  if (anterior.status === "trp_emitido" || anterior.status === "trd_emitido") {
    return { pode: true, motivo: null };
  }
  return {
    pode: false,
    motivo: `Sequência contratual: a ${fase.nome} só inicia após o TRP da ${anterior.nome}.`,
  };
}

/** Valor bruto de MO da fase (área × preço/m², com reajuste IPCA se houver). */
export function valorFaseMO(fase: ObraFase, precoM2: number): number {
  const fator = fase.reajustavel && fase.ipca_pct != null ? 1 + fase.ipca_pct / 100 : 1;
  return fase.area_m2 * precoM2 * fator;
}
