import type { CrmStatus, CrmTarefa } from "@/types/database";

// ===========================================================================
// CRM comercial — rótulos e helpers de apresentação (sem regra de negócio).
// COMUNICAÇÃO EXTERNA É MANUAL por ora: o CRM gere o funil de admissão, mas
// NÃO envia e-mail/WhatsApp/SMS nem cria landing pages (fora do escopo).
// ===========================================================================

export const QUALIFICACAO_LABEL: Record<number, string> = {
  1: "Muito frio",
  2: "Frio",
  3: "Morno",
  4: "Quente",
  5: "Muito quente",
};

export const STATUS_LABEL: Record<CrmStatus, string> = {
  nova: "Nova",
  em_andamento: "Em andamento",
  ganha: "Ganha",
  perdida: "Perdida",
  pausada: "Pausada",
};

export const STATUS_VARIANTE: Record<CrmStatus, "secondary" | "success" | "destructive" | "warning" | "muted"> = {
  nova: "secondary",
  em_andamento: "secondary",
  ganha: "success",
  perdida: "destructive",
  pausada: "warning",
};

export const RELACOES = ["Filho(a)", "Cônjuge", "Sobrinho(a)", "Outro"] as const;

export const TIPOS_TAREFA = ["Ligar", "WhatsApp", "Email", "Visita agendada", "Reunião", "Outro"] as const;

export const BASE_LEGAL_LABEL: Record<string, string> = {
  consentimento: "Consentimento",
  legitimo_interesse: "Legítimo interesse",
  nao_definida: "Não definida",
};

export const ETAPA_ADMISSAO = "Admissão";

/** A tarefa está vencida? (não concluída e com data anterior a hoje). */
export function tarefaVencida(t: Pick<CrmTarefa, "concluida" | "data">): boolean {
  if (t.concluida || !t.data) return false;
  return t.data < new Date().toISOString().slice(0, 10);
}
