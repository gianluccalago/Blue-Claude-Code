import type { CrmOportunidade } from "@/types/database";

// ===========================================================================
// FUNIL DE VENDAS histórico — agrega o CRM já existente (não recria coleta).
//
// DEFINIÇÕES (mapeadas aos campos reais do CRM; ajuste aqui se o CRM mudar):
//  - "Lead"        = oportunidade criada (crm_oportunidade.criado_em).
//  - "Qualificado" = lead com valor de mensalidade estimado preenchido
//                    (valor_mensalidade_estimado > 0). Alternativa: qualificacao
//                    (1–5) alta — trocar AQUI se preferir esse critério.
//  - "Visita"      = lead que ATINGIU a etapa "Visita realizada" (ordem ≥ 4).
//                    Vendas (etapa "Admissão", ordem 6) também passaram por visita.
//  - "Venda"       = status = "ganha".
//  - "Receita"     = soma dos valor_mensalidade_estimado das vendas.
//
// O funil é por COORTE DE CRIAÇÃO: cada linha = oportunidades CRIADAS no mês e o
// seu desfecho até hoje. Isso mantém as taxas de conversão coerentes (mesma base).
// Meses recentes ainda estão "em maturação" (poucas vendas) — esperado.
//
// LP/CP/SD (Longa/Curta Permanência / Senior Day): o CRM NÃO distingue tipo de
// admissão hoje (só `tipo_suite_interesse`, que é preferência de suíte). Deixado
// preparado: quando existir o campo (conecta com diárias avulsas/day care do
// próximo bloco), segmentar as vendas por aqui.
// ===========================================================================

/** Ordem das etapas do CRM (seed 0038). Free text → ordem conhecida. */
const ORDEM_ETAPA: Record<string, number> = {
  "Sem contato": 1,
  "Contato feito": 2,
  "Visita agendada": 3,
  "Visita realizada": 4,
  "Proposta enviada": 5,
  "Admissão": 6,
};
const ORDEM_VISITA = 4;

function ordemEtapa(etapa: string): number {
  return ORDEM_ETAPA[etapa] ?? 0;
}

export function ehQualificado(o: CrmOportunidade): boolean {
  return (o.valor_mensalidade_estimado ?? 0) > 0;
}
export function atingiuVisita(o: CrmOportunidade): boolean {
  return ordemEtapa(o.etapa) >= ORDEM_VISITA;
}
export function ehVenda(o: CrmOportunidade): boolean {
  return o.status === "ganha";
}

function mesDe(ts: string | null): string | null {
  return ts ? ts.slice(0, 7) : null;
}

export interface LinhaFunil {
  mes: string;
  leads: number;
  qualificados: number;
  visitas: number;
  vendas: number;
  pctVisitasLeads: number | null;
  pctVendasVisitas: number | null;
  pctVendasLeads: number | null;
  receita: number;
  ticketMedio: number | null;
}

function pct(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 100) : null;
}

/** Linha do funil para um mês (coorte das oportunidades criadas no mês). */
export function linhaFunilDoMes(ops: CrmOportunidade[], mes: string): LinhaFunil {
  const coorte = ops.filter((o) => mesDe(o.criado_em) === mes);
  const leads = coorte.length;
  const qualificados = coorte.filter(ehQualificado).length;
  const visitas = coorte.filter(atingiuVisita).length;
  const vendasOps = coorte.filter(ehVenda);
  const vendas = vendasOps.length;
  const receita = vendasOps.reduce((s, o) => s + (o.valor_mensalidade_estimado ?? 0), 0);
  return {
    mes,
    leads,
    qualificados,
    visitas,
    vendas,
    pctVisitasLeads: pct(visitas, leads),
    pctVendasVisitas: pct(vendas, visitas),
    pctVendasLeads: pct(vendas, leads),
    receita,
    ticketMedio: vendas > 0 ? receita / vendas : null,
  };
}

/** Funil histórico para a lista de meses (na ordem recebida). */
export function funilHistorico(ops: CrmOportunidade[], meses: string[]): LinhaFunil[] {
  return meses.map((m) => linhaFunilDoMes(ops, m));
}

export interface ResumoFunilPeriodo {
  leads: number;
  vendas: number;
  receita: number;
  conversaoGlobal: number | null; // % vendas/leads
  ticketMedio: number | null;
  tempoMedioDias: number | null; // lead → venda (dias)
}

/** Consolida o período (coorte das oportunidades criadas nos meses dados). */
export function resumoFunilPeriodo(ops: CrmOportunidade[], meses: string[]): ResumoFunilPeriodo {
  const set = new Set(meses);
  const coorte = ops.filter((o) => {
    const m = mesDe(o.criado_em);
    return m != null && set.has(m);
  });
  const leads = coorte.length;
  const vendasOps = coorte.filter(ehVenda);
  const vendas = vendasOps.length;
  const receita = vendasOps.reduce((s, o) => s + (o.valor_mensalidade_estimado ?? 0), 0);

  // Tempo médio lead→venda: dias entre criado_em e fechado_em das vendas da coorte.
  const ciclos = vendasOps
    .filter((o) => o.fechado_em)
    .map((o) => (new Date(o.fechado_em as string).getTime() - new Date(o.criado_em).getTime()) / 86_400_000)
    .filter((d) => d >= 0);
  const tempoMedioDias = ciclos.length > 0 ? Math.round(ciclos.reduce((s, d) => s + d, 0) / ciclos.length) : null;

  return {
    leads,
    vendas,
    receita,
    conversaoGlobal: pct(vendas, leads),
    ticketMedio: vendas > 0 ? receita / vendas : null,
    tempoMedioDias,
  };
}
