import { hojeISO } from "@/lib/utils";
import type {
  FormaPagamento,
  PagamentoMensalidade,
  StatusPagamentoMensalidade,
} from "@/types/database";

// ===========================================================================
// Cobrança (mensalidade) — rótulos, formas e helpers de STATUS.
//
// IMPORTANTE: NÃO há integração de pagamento aqui. Tudo é controle MANUAL: a
// Administração move o status na mão (marca "enviada" ao mandar o boleto por
// fora, "paga" ao confirmar). Os campos asaas_customer_id / id_cobranca_externa
// ficam RESERVADOS e vazios. A cobrança automática futura (criar cobrança no
// provedor, receber confirmação por webhook) exigirá uma CAMADA DE BACKEND
// — ex.: uma Supabase Edge Function —, que NÃO existe neste ambiente.
// ===========================================================================

export const STATUS_COBRANCA: { value: StatusPagamentoMensalidade; label: string }[] = [
  { value: "em_aberto", label: "Em aberto" },
  { value: "enviada", label: "Enviada" },
  { value: "paga", label: "Paga" },
  { value: "vencida", label: "Vencida" },
  { value: "cancelada", label: "Cancelada" },
];

export const STATUS_COBRANCA_LABEL: Record<StatusPagamentoMensalidade, string> = {
  em_aberto: "Em aberto",
  enviada: "Enviada",
  paga: "Paga",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

export type VarianteBadge = "secondary" | "success" | "warning" | "destructive" | "muted";

export const STATUS_COBRANCA_VARIANTE: Record<StatusPagamentoMensalidade, VarianteBadge> = {
  em_aberto: "warning",
  enviada: "secondary",
  paga: "success",
  vencida: "destructive",
  cancelada: "muted",
};

export const FORMAS_PAGAMENTO: { value: FormaPagamento; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
];

export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  pix: "Pix",
  boleto: "Boleto",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

/** Relação do responsável financeiro com o hóspede. */
export const RELACOES_FINANCEIRO = ["Filho(a)", "Cônjuge", "Outro"] as const;

const hojeISOData = () => hojeISO();

/** A mensalidade está efetivamente quitada? (status "paga"). */
export function ehPago(status: StatusPagamentoMensalidade | undefined | null): boolean {
  return status === "paga";
}

/**
 * Status EFETIVO para exibição: sem registro → "em_aberto"; em_aberto/enviada
 * com vencimento já passado → "vencida" (calculada); senão, o próprio status.
 */
export function statusEfetivoCobranca(
  pagamento: PagamentoMensalidade | undefined | null,
): StatusPagamentoMensalidade {
  if (!pagamento) return "em_aberto";
  const s = pagamento.status;
  if ((s === "em_aberto" || s === "enviada") && pagamento.data_vencimento && pagamento.data_vencimento < hojeISOData()) {
    return "vencida";
  }
  return s;
}

/** É inadimplência? (vencida de fato — em aberto/enviada com vencimento passado). */
export function estaVencida(pagamento: PagamentoMensalidade | undefined | null): boolean {
  return statusEfetivoCobranca(pagamento) === "vencida";
}
