import type { PatologiaResidente, PlanoAtencaoSaude } from "@/types/database";

// ===========================================================================
// Apoio ao Plano de Atenção Integral à Saúde (RDC 502/2021, Art. 36-38).
// Consolidação de patologias prevalentes (Art. 37, IV) e alertas de revisão
// bienal (Art. 36) e avaliação anual (Art. 38).
// ===========================================================================

/** Chave normalizada de uma patologia (agrupa variações de digitação). */
export function normalizarPatologia(descricao: string): string {
  return descricao.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface PrevalenteItem {
  descricao: string; // rótulo representativo
  residentes: number; // nº de hóspedes distintos com a condição
}

/**
 * Patologias PREVALENTES entre os residentes informados (ativos): ranking por
 * nº de hóspedes distintos. `idsAtivos` limita aos residentes ativos.
 */
export function consolidarPrevalentes(
  patologias: PatologiaResidente[],
  idsAtivos: Set<string>,
): PrevalenteItem[] {
  const porChave = new Map<string, { rotulo: string; residentes: Set<string> }>();
  for (const p of patologias) {
    if (!p.ativa || !idsAtivos.has(p.residente_id)) continue;
    const chave = normalizarPatologia(p.descricao);
    if (!chave) continue;
    const atual = porChave.get(chave) ?? { rotulo: p.descricao.trim(), residentes: new Set<string>() };
    atual.residentes.add(p.residente_id);
    porChave.set(chave, atual);
  }
  return [...porChave.values()]
    .map((v) => ({ descricao: v.rotulo, residentes: v.residentes.size }))
    .sort((a, b) => b.residentes - a.residentes || a.descricao.localeCompare(b.descricao, "pt-BR"));
}

// ─── Alertas de revisão (bienal) e avaliação (anual) ──────────────────────────

export interface StatusPlano {
  revisaoVencida: boolean;
  revisaoProxima: boolean; // a até 60 dias
  avaliacaoVencida: boolean;
  avaliacaoProxima: boolean;
  proximaAvaliacao: string | null; // ISO
}

function diasAte(dataISO: string | null): number | null {
  if (!dataISO) return null;
  const alvo = new Date(`${dataISO}T00:00:00`).getTime();
  const hoje = new Date();
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return Math.round((alvo - base) / 86_400_000);
}

function somarAno(dataISO: string, anos: number): string {
  const d = new Date(`${dataISO}T00:00:00`);
  d.setFullYear(d.getFullYear() + anos);
  return d.toISOString().slice(0, 10);
}

/** Status de revisão/avaliação a partir da versão VIGENTE do plano. */
export function statusPlano(vigente: PlanoAtencaoSaude | null): StatusPlano {
  if (!vigente) {
    return { revisaoVencida: false, revisaoProxima: false, avaliacaoVencida: false, avaliacaoProxima: false, proximaAvaliacao: null };
  }
  const dRevisao = diasAte(vigente.proxima_revisao);
  // Próxima avaliação anual = 1 ano após a última avaliação (ou a elaboração).
  const baseAval = vigente.avaliacao_anual_em ?? vigente.elaborado_em;
  const proximaAvaliacao = somarAno(baseAval, 1);
  const dAval = diasAte(proximaAvaliacao);
  return {
    revisaoVencida: dRevisao !== null && dRevisao < 0,
    revisaoProxima: dRevisao !== null && dRevisao >= 0 && dRevisao <= 60,
    avaliacaoVencida: dAval !== null && dAval < 0,
    avaliacaoProxima: dAval !== null && dAval >= 0 && dAval <= 30,
    proximaAvaliacao,
  };
}

/** Versão vigente (mais recente por elaborado_em). */
export function planoVigente(planos: PlanoAtencaoSaude[]): PlanoAtencaoSaude | null {
  if (planos.length === 0) return null;
  return [...planos].sort((a, b) => b.elaborado_em.localeCompare(a.elaborado_em))[0];
}
