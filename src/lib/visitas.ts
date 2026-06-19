import { formatarDataBR } from "@/lib/utils";
import type { VisitaStatus } from "@/types/database";

// ===========================================================================
// Agenda de Visitas — utilidades puras (mensagens, links, grade, rótulos).
//
// As mensagens de confirmação/remarcação ficam ISOLADAS aqui de propósito:
// hoje geramos o texto e abrimos o WhatsApp/e-mail com ele pré-preenchido
// (envio MANUAL pelo atendente). No futuro, o envio automático via WhatsApp
// Business API só precisa consumir estas mesmas funções de texto — sem mexer
// na tela. NÃO há envio automático aqui.
// ===========================================================================

/** Endereço institucional usado nas mensagens. Ajuste conforme a unidade. */
export const ENDERECO_BLUE = "Rua das Acácias, 1234 — Curitiba/PR";

/** "09:00:00" | "09:00" → "09:00". */
export function formatarHora(hora: string | null | undefined): string {
  if (!hora) return "—";
  return hora.slice(0, 5);
}

/** Data + hora amigáveis para mensagens: "12/06/2026 às 10:00". */
export function dataHoraExtenso(data: string, hora: string): string {
  return `${formatarDataBR(data)} às ${formatarHora(hora)}`;
}

// ─── Mensagens prontas (ponto único para futura WhatsApp Business API) ────────

export function mensagemConfirmacao(nome: string, data: string, hora: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] || nome;
  return (
    `Olá ${primeiro}! Sua visita ao Blue Senior Living está confirmada para ` +
    `${dataHoraExtenso(data, hora)}. Estamos ansiosos para recebê-lo(a)! ` +
    `Endereço: ${ENDERECO_BLUE}. Qualquer coisa, é só chamar.`
  );
}

export function mensagemRemarcacao(nome: string, data: string, hora: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] || nome;
  return (
    `Olá ${primeiro}! Sua visita ao Blue Senior Living foi remarcada para ` +
    `${dataHoraExtenso(data, hora)}. Caso o novo horário não funcione, ` +
    `me avise que reorganizamos. Endereço: ${ENDERECO_BLUE}. Até breve!`
  );
}

// ─── Links (abrir com a mensagem pronta; o atendente envia) ───────────────────

/** Normaliza o WhatsApp para o formato do wa.me (só dígitos, com DDI 55). */
export function normalizarWhatsapp(whatsapp: string): string {
  // Só dígitos, sem zeros à esquerda (ex.: "0" de operadora antes do DDD).
  const digitos = (whatsapp ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digitos === "") return "";
  // Sem DDI (11 dígitos = DDD+celular, 10 = DDD+fixo) → assume Brasil (55).
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}

export function linkWhatsapp(whatsapp: string, mensagem: string): string {
  return `https://wa.me/${normalizarWhatsapp(whatsapp)}?text=${encodeURIComponent(mensagem)}`;
}

export function linkEmail(email: string, assunto: string, corpo: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}

// ─── Grade de horários padrão (editor) ────────────────────────────────────────

/** Dias da semana (isodow: 1=segunda … 7=domingo). */
export const DIAS_SEMANA: { dow: number; curto: string; label: string }[] = [
  { dow: 1, curto: "Seg", label: "Segunda" },
  { dow: 2, curto: "Ter", label: "Terça" },
  { dow: 3, curto: "Qua", label: "Quarta" },
  { dow: 4, curto: "Qui", label: "Quinta" },
  { dow: 5, curto: "Sex", label: "Sexta" },
  { dow: 6, curto: "Sáb", label: "Sábado" },
  { dow: 7, curto: "Dom", label: "Domingo" },
];

/** Gera horários "HH:00" de `inicio` a `fim` (inclusive), de hora em hora. */
export function horariosDaGrade(inicio: number, fim: number): string[] {
  const out: string[] = [];
  for (let h = inicio; h <= fim; h++) out.push(`${String(h).padStart(2, "0")}:00`);
  return out;
}

// ─── Rótulos de status ────────────────────────────────────────────────────────

export const STATUS_VISITA_LABEL: Record<VisitaStatus, string> = {
  pendente: "Pendente",
  confirmada: "Confirmada",
  remarcada: "Remarcada",
  cancelada: "Cancelada",
};

export const STATUS_VISITA_VARIANTE: Record<VisitaStatus, "warning" | "success" | "secondary" | "muted"> = {
  pendente: "warning",
  confirmada: "success",
  remarcada: "secondary",
  cancelada: "muted",
};
