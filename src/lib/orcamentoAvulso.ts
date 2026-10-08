// ===========================================================================
// ORÇAMENTOS AVULSOS DA OBRA — regras puras (sem React, sem rede).
// O servidor (0151) é quem decide; aqui só o que a tela precisa mostrar.
// ===========================================================================
import type { FonteItemAvulso, OrcamentoAvulso, OrcamentoAvulsoItem, StatusOrcamentoAvulso } from "@/types/database";

export const FONTES_ITEM: FonteItemAvulso[] = ["SINAPI", "CPU", "Cotação", "Outra"];

export const STATUS_AVULSO: Record<StatusOrcamentoAvulso, { rotulo: string; variante: "muted" | "warning" | "success" | "destructive" | "default" | "secondary" }> = {
  rascunho: { rotulo: "Rascunho", variante: "muted" },
  enviado: { rotulo: "Aguardando aprovação", variante: "warning" },
  ajustes: { rotulo: "Ajustes pedidos", variante: "warning" },
  aprovado: { rotulo: "Aprovado", variante: "success" },
  reprovado: { rotulo: "Reprovado", variante: "destructive" },
  executado: { rotulo: "Executado · conferir valor", variante: "warning" },
  conferido: { rotulo: "Valor real confirmado · a pagar", variante: "default" },
  pago: { rotulo: "Pago", variante: "secondary" },
  cancelado: { rotulo: "Cancelado", variante: "muted" },
};

/** Ordem do fluxo, para a linha do tempo. */
export const ETAPAS_AVULSO: { status: StatusOrcamentoAvulso; rotulo: string }[] = [
  { status: "enviado", rotulo: "Enviado" },
  { status: "aprovado", rotulo: "Aprovado" },
  { status: "executado", rotulo: "Executado" },
  { status: "conferido", rotulo: "Valor real" },
  { status: "pago", rotulo: "Pago" },
];

export function codigoAvulso(numero: number): string {
  return `OA-${String(numero).padStart(3, "0")}`;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function totalItem(i: Pick<OrcamentoAvulsoItem, "quantidade_prevista" | "preco_unitario">): number {
  return r2(i.quantidade_prevista * i.preco_unitario);
}

export function totalPrevisto(itens: Pick<OrcamentoAvulsoItem, "quantidade_prevista" | "preco_unitario">[]): number {
  return r2(itens.reduce((s, i) => s + totalItem(i), 0));
}

/** Valor pelas quantidades reais (item sem quantidade real usa a prevista). */
export function totalMedido(itens: Pick<OrcamentoAvulsoItem, "quantidade_prevista" | "quantidade_real" | "preco_unitario">[]): number {
  return r2(itens.reduce((s, i) => s + r2((i.quantidade_real ?? i.quantidade_prevista) * i.preco_unitario), 0));
}

/** O valor que vale agora: real > aprovado > previsto. */
export function valorVigente(o: Pick<OrcamentoAvulso, "valor_previsto" | "valor_aprovado" | "valor_real">): number {
  return o.valor_real ?? o.valor_aprovado ?? o.valor_previsto;
}

/** Totais para os painéis: o que aguarda decisão, o compromisso aprovado e o pago. */
export function resumoAvulsos(lista: Pick<OrcamentoAvulso, "status" | "valor_previsto" | "valor_aprovado" | "valor_real">[]) {
  const em = (...s: StatusOrcamentoAvulso[]) => lista.filter((o) => s.includes(o.status));
  const soma = (l: typeof lista) => r2(l.reduce((t, o) => t + valorVigente(o), 0));
  return {
    aguardandoBlue: em("enviado", "executado").length,
    emAnalise: soma(em("enviado")),
    aprovadoAReceber: soma(em("aprovado", "executado", "conferido")),
    pago: soma(em("pago")),
    comprometido: soma(em("aprovado", "executado", "conferido", "pago")),
  };
}

export type QuemVe = "construtora" | "blue";

/** Ações possíveis por status e por lado (o servidor confere de novo). */
export function acoesDisponiveis(status: StatusOrcamentoAvulso, quem: QuemVe) {
  const editavel = status === "rascunho" || status === "ajustes";
  return {
    editar: editavel,
    enviar: editavel,
    decidir: quem === "blue" && status === "enviado",
    informarExecucao: status === "aprovado",
    conferir: quem === "blue" && (status === "aprovado" || status === "executado"),
    pagar: quem === "blue" && status === "conferido",
    desfazerPagamento: quem === "blue" && status === "pago",
    cancelar: quem === "construtora" ? ["rascunho", "enviado", "ajustes"].includes(status) : !["pago", "cancelado", "reprovado"].includes(status),
    anexar: quem === "blue" ? !["cancelado"].includes(status) : editavel,
  };
}

export const ROTULO_ACAO_EVENTO: Record<string, string> = {
  criado: "Criou o orçamento",
  enviado: "Enviou para aprovação",
  ajustes: "Pediu ajustes",
  aprovado: "Aprovou",
  reprovado: "Reprovou",
  executado: "Informou a execução",
  conferido: "Confirmou o valor real",
  pago: "Registrou o pagamento",
  pagamento_desfeito: "Desfez o pagamento",
  cancelado: "Cancelou",
  comentario: "Comentou",
};
