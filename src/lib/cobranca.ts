import { hojeISO } from "@/lib/utils";
import { intervaloDoMes } from "@/lib/mensalidade";
import type {
  FormaPagamento,
  PagamentoMensalidade,
  Residente,
  StatusPagamentoMensalidade,
} from "@/types/database";

// ===========================================================================
// Cobrança (mensalidade) — rótulos, formas e as REGRAS ÚNICAS de:
//   · quem está no roster do mês (estaNoMes)
//   · pró-rata na entrada/saída (valorProRata / mensalidadeDoMes — chave
//     `prorata_mensalidade` em configuracao, padrão OFF)
//   · inadimplência (estaVencidaNoMes) e faturamento (entraNoFaturamento)
//   · pagamento parcial e estorno (saldoDevedor)
// O servidor espelha as mesmas regras em `fechar_mes` (migration 0138); o
// smoke `supabase/tests/smoke_cobranca.sql` cruza os dois.
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
  { value: "estornada", label: "Estornada" },
];

export const STATUS_COBRANCA_LABEL: Record<StatusPagamentoMensalidade, string> = {
  em_aberto: "Em aberto",
  enviada: "Enviada",
  paga: "Paga",
  vencida: "Vencida",
  cancelada: "Cancelada",
  estornada: "Estornada",
};

export type VarianteBadge = "secondary" | "success" | "warning" | "destructive" | "muted";

export const STATUS_COBRANCA_VARIANTE: Record<StatusPagamentoMensalidade, VarianteBadge> = {
  em_aberto: "warning",
  enviada: "secondary",
  paga: "success",
  vencida: "destructive",
  cancelada: "muted",
  estornada: "destructive",
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

/** Dia de vencimento PADRÃO quando o registro de cobrança não tem data própria. */
export const DIA_VENCIMENTO_PADRAO = 10;

/** Chave em `configuracao`: 'on' liga a pró-rata; qualquer outro valor = mês cheio. */
export const CHAVE_PRORATA_MENSALIDADE = "prorata_mensalidade";

/** A pró-rata está ligada? (valor lido de `configuracao.prorata_mensalidade`). */
export function proRataLigada(valor: string | null | undefined): boolean {
  return (valor ?? "").trim().toLowerCase() === "on";
}

// ─── Roster do mês ──────────────────────────────────────────────────────────

export type ResidenteRoster = Pick<Residente, "data_admissao" | "data_saida" | "status_hospede" | "modalidade">;

/**
 * O hóspede ESTEVE na casa no mês "YYYY-MM"?
 *   · admitido até o último dia do mês (sem data de admissão → conta);
 *   · se INATIVO, a saída foi dentro ou depois do mês;
 *   · se ATIVO, `data_saida` é ignorada — cobre a readmissão (o cadastro
 *     volta a "ativo" com nova data_admissao; uma data_saida antiga que
 *     tenha ficado no registro não o tira do roster);
 *   · day care não ocupa leito (cobra por cobranca_temporaria à parte).
 * Espelho da CTE `roster` em `fechar_mes` (0138).
 */
export function estaNoMes(r: ResidenteRoster, mes: string): boolean {
  if (r.modalidade === "day_care") return false;
  const { inicio, fim } = intervaloDoMes(mes);
  if ((r.data_admissao ?? "0000-00-00") > fim) return false;
  if (r.status_hospede === "inativo") return (r.data_saida ?? "9999-12-31") >= inicio;
  return true;
}

// ─── Pró-rata ───────────────────────────────────────────────────────────────

/** Quantos dias tem o mês "YYYY-MM". */
export function diasNoMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function diaDoMes(iso: string): number {
  return Number(iso.slice(8, 10));
}

/**
 * Mensalidade PROPORCIONAL aos dias no mês em que o hóspede esteve na casa:
 * do máximo(entrada, dia 1) ao mínimo(saída, último dia). Entrada e saída
 * fora do mês → mês cheio. Sem data de admissão → mês cheio. Entrada depois
 * do mês ou saída antes dele → 0. Arredonda a centavos.
 * Espelho de `cobranca_prorata` (0138).
 */
export function valorProRata(
  mensalidade: number,
  dataAdmissao: string | null | undefined,
  dataSaida: string | null | undefined,
  mes: string,
): number {
  if (!mensalidade) return 0;
  const { inicio, fim } = intervaloDoMes(mes);
  const de = dataAdmissao && dataAdmissao > inicio ? dataAdmissao : inicio;
  const ate = dataSaida && dataSaida < fim ? dataSaida : fim;
  if (ate < de) return 0;
  const dias = diaDoMes(ate) - diaDoMes(de) + 1;
  return Math.round((mensalidade * dias * 100) / diasNoMes(mes)) / 100;
}

/**
 * Mensalidade do mês para o hóspede: cheia (padrão) ou pró-rata quando a
 * chave está ligada. A saída só conta se o hóspede está INATIVO (readmitido
 * ativo com data_saida antiga não é cortado).
 */
export function mensalidadeDoMes(
  mensalidadeBase: number,
  r: ResidenteRoster,
  mes: string,
  proRata: boolean,
): number {
  if (!proRata) return mensalidadeBase;
  const saida = r.status_hospede === "inativo" ? r.data_saida : null;
  return valorProRata(mensalidadeBase, r.data_admissao, saida, mes);
}

// ─── Status, inadimplência e faturamento ────────────────────────────────────

/** A mensalidade está efetivamente quitada? (status "paga"). */
export function ehPago(status: StatusPagamentoMensalidade | undefined | null): boolean {
  return status === "paga";
}

/** Vencimento EFETIVO: a data do registro; senão, o dia padrão do mês. */
export function vencimentoEfetivo(pagamento: Pick<PagamentoMensalidade, "data_vencimento"> | undefined | null, mes: string): string {
  return pagamento?.data_vencimento ?? `${mes}-${String(DIA_VENCIMENTO_PADRAO).padStart(2, "0")}`;
}

/** Cancelada fica FORA do faturamento e da inadimplência. */
export function entraNoFaturamento(pagamento: Pick<PagamentoMensalidade, "status"> | undefined | null): boolean {
  return pagamento?.status !== "cancelada";
}

/**
 * REGRA ÚNICA de inadimplência (FIN-02): vencida = NÃO paga E vencimento
 * efetivo (do registro, senão o dia padrão do mês) < hoje. Sem registro
 * conta (o dia padrão já passou). Cancelada nunca conta. Estornada conta —
 * o dinheiro voltou e a dívida reabriu.
 */
export function estaVencidaNoMes(
  pagamento: Pick<PagamentoMensalidade, "status" | "data_vencimento"> | undefined | null,
  mes: string,
  hoje: string = hojeISO(),
): boolean {
  if (ehPago(pagamento?.status) || !entraNoFaturamento(pagamento)) return false;
  return vencimentoEfetivo(pagamento, mes) < hoje;
}

/**
 * Status EFETIVO para exibição. Paga/cancelada/estornada valem como gravadas;
 * em_aberto/enviada (ou sem registro, quando `mes` é informado) com o
 * vencimento efetivo já passado → "vencida" (calculada); senão, o próprio
 * status (sem registro → "em_aberto"). Sem `mes`, só o vencimento gravado
 * conta (compatível com quem chama só com o registro, ex.: ficha do hóspede).
 */
export function statusEfetivoCobranca(
  pagamento: Pick<PagamentoMensalidade, "status" | "data_vencimento"> | undefined | null,
  mes?: string,
  hoje: string = hojeISO(),
): StatusPagamentoMensalidade {
  const s = pagamento?.status ?? "em_aberto";
  if (s === "paga" || s === "cancelada" || s === "estornada") return s;
  if (mes ? estaVencidaNoMes(pagamento, mes, hoje) : !!pagamento?.data_vencimento && pagamento.data_vencimento < hoje) {
    return "vencida";
  }
  return s;
}

/** É inadimplência? (vencida de fato — em aberto/enviada com vencimento passado). */
export function estaVencida(pagamento: PagamentoMensalidade | undefined | null): boolean {
  return statusEfetivoCobranca(pagamento) === "vencida";
}

/**
 * Para o painel da Administração (useIndicadoresGestao): a linha do
 * demonstrativo conta como inadimplente? Mesma regra de `estaVencidaNoMes`,
 * só para quem tem valor a cobrar.
 */
export function contaComoInadimplente(
  linha: { total: number; pagamento: PagamentoMensalidade | undefined },
  mes: string,
  hoje: string = hojeISO(),
): boolean {
  return linha.total > 0 && estaVencidaNoMes(linha.pagamento, mes, hoje);
}

// ─── Pagamento parcial e estorno ────────────────────────────────────────────

/**
 * Saldo devedor da cobrança: total − valor pago. Cancelada → 0. Paga sem
 * `valor_pago` (registro antigo) → quitada (0). Estornada → o total volta a
 * ser devido, mesmo com o pagamento original preservado no registro.
 */
export function saldoDevedor(
  total: number,
  pagamento: Pick<PagamentoMensalidade, "status" | "valor_pago"> | undefined | null,
): number {
  if (!pagamento) return Math.max(0, total);
  if (pagamento.status === "cancelada") return 0;
  if (pagamento.status === "estornada") return Math.max(0, total);
  if (pagamento.status === "paga" && pagamento.valor_pago == null) return 0;
  return Math.max(0, Math.round((total - (pagamento.valor_pago ?? 0)) * 100) / 100);
}

/** Há pagamento PARCIAL? (algo pago, mas ainda com saldo devedor). */
export function ehPagamentoParcial(
  total: number,
  pagamento: Pick<PagamentoMensalidade, "status" | "valor_pago"> | undefined | null,
): boolean {
  if (!pagamento || pagamento.status === "cancelada" || pagamento.status === "estornada") return false;
  return (pagamento.valor_pago ?? 0) > 0 && saldoDevedor(total, pagamento) > 0;
}
