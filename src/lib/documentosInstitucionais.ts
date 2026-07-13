import { hojeISO } from "@/lib/utils";
import type { DocumentoInstitucional } from "@/types/database";

// ===========================================================================
// Documentação Institucional — modelo LIVRE. Cada documento tem uma validade
// definida no envio: uma DATA de vencimento ou "Não se aplica" (sem validade).
// O status deriva só dessa data (sem checklist/modelo fixo).
// ===========================================================================

export type StatusDocumento = "vencido" | "vence_em_breve" | "em_dia" | "sem_validade";

export const STATUS_DOC_LABEL: Record<StatusDocumento, string> = {
  vencido: "Vencido",
  vence_em_breve: "Vence em breve",
  em_dia: "Em dia",
  sem_validade: "Não se aplica",
};

export const STATUS_DOC_VARIANTE: Record<StatusDocumento, "destructive" | "warning" | "success" | "muted"> = {
  vencido: "destructive",
  vence_em_breve: "warning",
  em_dia: "success",
  sem_validade: "muted",
};

const DIAS_AVISO_VENCIMENTO = 30;

/** Status de um documento a partir da sua data de validade (null = "Não se aplica"). */
export function statusDocumento(doc: Pick<DocumentoInstitucional, "data_validade">): StatusDocumento {
  if (!doc.data_validade) return "sem_validade";
  const hoje = hojeISO();
  if (doc.data_validade < hoje) return "vencido";
  const aviso = new Date(hoje + "T12:00:00");
  aviso.setDate(aviso.getDate() + DIAS_AVISO_VENCIMENTO);
  if (doc.data_validade <= aviso.toISOString().slice(0, 10)) return "vence_em_breve";
  return "em_dia";
}

/** Peso de ordenação: mais urgente primeiro. */
export function pesoStatus(s: StatusDocumento): number {
  return s === "vencido" ? 0 : s === "vence_em_breve" ? 1 : s === "em_dia" ? 2 : 3;
}
