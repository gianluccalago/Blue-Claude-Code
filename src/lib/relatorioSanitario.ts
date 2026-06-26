import { INDICADORES_RDC, populacaoDia15 } from "@/lib/indicadoresRdc";
import type { AgravoEpidemiologico, EventoSentinela, Residente } from "@/types/database";

// ===========================================================================
// RELATÓRIO SANITÁRIO — modelo de valores e cálculo do período. O sistema
// calcula os valores; o RT AUDITA e pode editar tudo antes de extrair (o PDF é
// uma VALIDAÇÃO do RT). Os registros do banco permanecem intactos.
// ===========================================================================

export type PeriodoTipo = "mensal" | "anual" | "personalizado";

/** Identificação FIXA do Responsável Técnico (não editável). */
export const RT_ASSINATURA = {
  nome: "Gianlucca Lagomarsino",
  crm: "CRM-PR 54.260",
  cpf: "125.938.629-55",
};

export const INSTITUICAO_RELATORIO = {
  nome: "Blue Senior Living",
  endereco: "R. Eduardo Sprada, 2387 - Campo Comprido",
  cidade: "Curitiba - PR, 81210-350",
};

export interface ItemTaxa {
  key: string;
  label: string;
  numerador: number;
  denominador: number;
  taxa: number;
}

export interface ValoresRelatorio {
  /** 6 indicadores obrigatórios (Anexo RDC 502). */
  obrigatorios: ItemTaxa[];
  ocupacao: ItemTaxa;
  residentesDia15: number;
  entradas: number;
  saidas: number;
  grauI: number;
  grauII: number;
  grauIII: number;
  grauSemGrau: number;
  sentinelaQuedaTotal: number;
  sentinelaQuedaNotif: number;
  sentinelaSuicidioTotal: number;
  sentinelaSuicidioNotif: number;
  sentinelaDoencaTotal: number;
  sentinelaDoencaNotif: number;
}

function mesesNoPeriodo(inicio: string, fim: string): { ano: number; mes: number }[] {
  const out: { ano: number; mes: number }[] = [];
  const d = new Date(`${inicio}T00:00:00`);
  d.setDate(1);
  const end = new Date(`${fim}T00:00:00`);
  while (d <= end) {
    out.push({ ano: d.getFullYear(), mes: d.getMonth() + 1 });
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

function noPeriodo(dataISO: string | null, inicio: string, fim: string): boolean {
  if (!dataISO) return false;
  const d = dataISO.slice(0, 10);
  return d >= inicio && d <= fim;
}

/**
 * Calcula os valores do relatório para o período [inicio, fim] (datas ISO).
 * População de referência = média das populações no dia 15 dos meses do
 * período (para mês único, é a população daquele mês). Numerador = idosos
 * DISTINTOS com o agravo no período; mortalidade une óbito-agravo + saída por
 * falecimento. Estes valores são o PONTO DE PARTIDA — o RT audita/edita.
 */
export function calcularValoresRelatorio(
  inicio: string,
  fim: string,
  agravos: AgravoEpidemiologico[],
  residentes: Residente[],
  eventos: EventoSentinela[],
): ValoresRelatorio {
  const meses = mesesNoPeriodo(inicio, fim);
  const pops = meses.map((m) => populacaoDia15(residentes, m.ano, m.mes));
  const populacao = pops.length > 0 ? Math.round(pops.reduce((a, b) => a + b, 0) / pops.length) : 0;

  const obitosPorSaida = new Set(
    residentes.filter((r) => r.motivo_saida === "Falecimento" && noPeriodo(r.data_saida, inicio, fim)).map((r) => r.id),
  );

  const obrigatorios: ItemTaxa[] = INDICADORES_RDC.map((def) => {
    const idosos = new Set(
      agravos.filter((a) => a.tipo === def.key && noPeriodo(a.data_ocorrencia, inicio, fim)).map((a) => a.residente_id),
    );
    if (def.key === "obito") for (const id of obitosPorSaida) idosos.add(id);
    const numerador = idosos.size;
    return {
      key: def.key,
      label: def.label,
      numerador,
      denominador: populacao,
      taxa: populacao > 0 ? (numerador / populacao) * 100 : 0,
    };
  });

  // Residentes ativos ocupando leito (longa/curta) — base da ocupação.
  const ocupandoLeito = residentes.filter((r) => r.status_hospede === "ativo" && r.modalidade !== "day_care").length;
  const ativos = residentes.filter((r) => r.status_hospede === "ativo");

  const sentinelaNoPeriodo = eventos.filter((e) => noPeriodo(e.data_ocorrencia, inicio, fim));
  const contar = (tipo: EventoSentinela["tipo"]) => {
    const lst = sentinelaNoPeriodo.filter((e) => e.tipo === tipo);
    return { total: lst.length, notif: lst.filter((e) => e.notificado).length };
  };
  const queda = contar("queda_com_lesao");
  const suicidio = contar("tentativa_suicidio");
  const doenca = contar("doenca_notificacao_compulsoria");

  return {
    obrigatorios,
    // Ocupação: denominador (total de leitos) começa = ocupados; o RT ajusta p/ a capacidade real.
    ocupacao: { key: "ocupacao", label: "Taxa de ocupação", numerador: ocupandoLeito, denominador: ocupandoLeito, taxa: ocupandoLeito > 0 ? 100 : 0 },
    residentesDia15: populacao,
    entradas: residentes.filter((r) => noPeriodo(r.data_admissao, inicio, fim)).length,
    saidas: residentes.filter((r) => noPeriodo(r.data_saida, inicio, fim)).length,
    grauI: ativos.filter((r) => r.grau_dependencia === "I").length,
    grauII: ativos.filter((r) => r.grau_dependencia === "II").length,
    grauIII: ativos.filter((r) => r.grau_dependencia === "III").length,
    grauSemGrau: ativos.filter((r) => !r.grau_dependencia).length,
    sentinelaQuedaTotal: queda.total,
    sentinelaQuedaNotif: queda.notif,
    sentinelaSuicidioTotal: suicidio.total,
    sentinelaSuicidioNotif: suicidio.notif,
    sentinelaDoencaTotal: doenca.total,
    sentinelaDoencaNotif: doenca.notif,
  };
}

/** "12,5" (1 casa). */
export function fmtTaxa(taxa: number): string {
  return taxa.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Período legível para o documento. */
export function rotuloPeriodo(tipo: PeriodoTipo, inicio: string, fim: string): string {
  const br = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
  if (tipo === "anual") return `Ano de ${inicio.slice(0, 4)}`;
  if (tipo === "mensal") {
    const d = new Date(`${inicio}T00:00:00`);
    return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  }
  return `${br(inicio)} a ${br(fim)}`;
}
