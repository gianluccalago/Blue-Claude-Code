// ===========================================================================
// CHAMADOS — regras puras (sem React, sem rede).
// Chamado (botão) acende AMARELO; emergência (corda) acende VERMELHO. O alerta
// só apaga quando alguém comprova presença no quarto (etiqueta NFC da suíte ou
// botão de presença do aparelho) — nunca por um clique no painel.
// ===========================================================================

export type TipoChamado = "chamado" | "emergencia";

export interface ChamadoAberto {
  id: string;
  quarto: string;
  tipo: TipoChamado;
  origem: "botao" | "corda" | "simulado";
  simulado: boolean;
  aberto_em: string;
  acionamentos: number;
  escalado_em: string | null;
  reconhecido_por: string | null;
  reconhecido_em: string | null;
}

/** Emergência primeiro; dentro do mesmo tipo, o mais antigo primeiro. */
export function ordenarChamados<T extends Pick<ChamadoAberto, "tipo" | "aberto_em">>(lista: T[]): T[] {
  return [...lista].sort(
    (a, b) => Number(b.tipo === "emergencia") - Number(a.tipo === "emergencia") || a.aberto_em.localeCompare(b.aberto_em),
  );
}

/** Suíte → chamado aberto (um por suíte, garantido no banco). */
export function chamadosPorSuite<T extends Pick<ChamadoAberto, "quarto">>(lista: T[]): Map<string, T> {
  return new Map(lista.map((c) => [c.quarto, c]));
}

/** "agora" / "3 min" / "1 h 05". */
export function tempoDesde(iso: string, agora: Date = new Date()): string {
  const min = Math.max(0, Math.floor((agora.getTime() - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
}

/** Chamado sem ninguém a caminho há mais de 3 min (emergência: 1 min) pede atenção extra. */
export function semResposta(c: Pick<ChamadoAberto, "tipo" | "aberto_em" | "reconhecido_em">, agora: Date = new Date()): boolean {
  if (c.reconhecido_em) return false;
  const limite = c.tipo === "emergencia" ? 1 : 3;
  return agora.getTime() - new Date(c.aberto_em).getTime() > limite * 60_000;
}

export const ROTULO_TIPO: Record<TipoChamado, string> = { chamado: "Chamado", emergencia: "Emergência" };
export const ROTULO_ORIGEM: Record<ChamadoAberto["origem"], string> = { botao: "botão", corda: "corda", simulado: "simulação" };
export const ROTULO_VIA: Record<string, string> = {
  nfc: "presença pela etiqueta NFC",
  presenca_dispositivo: "botão de presença no quarto",
  excepcional: "encerramento excepcional",
};

// ─── Situação da central ──────────────────────────────────────────────────────

export const SINAL_MAXIMO_MIN = 3;

export type SituacaoCentral =
  | { tipo: "sem_central" }
  | { tipo: "online"; ultimo: string }
  | { tipo: "sem_sinal"; ultimo: string | null };

/**
 * Distingue "sem chamados" de "sem conexão": sem central cadastrada, o
 * aparelho ainda não foi instalado; com central, sem sinal há mais de 3 min é
 * falha de comunicação — os chamados podem não estar chegando.
 */
export function situacaoCentral(
  centrais: { ativo: boolean; ultimo_sinal_em: string | null }[],
  agora: Date = new Date(),
): SituacaoCentral {
  const ativas = centrais.filter((c) => c.ativo);
  if (ativas.length === 0) return { tipo: "sem_central" };
  const ultimo = ativas.map((c) => c.ultimo_sinal_em).filter((x): x is string => !!x).sort().pop() ?? null;
  if (ultimo && agora.getTime() - new Date(ultimo).getTime() <= SINAL_MAXIMO_MIN * 60_000) return { tipo: "online", ultimo };
  return { tipo: "sem_sinal", ultimo };
}

// ─── Indicadores ─────────────────────────────────────────────────────────────

export interface ChamadoHistorico {
  tipo: TipoChamado;
  status: "aberto" | "atendido" | "encerrado_excepcional";
  simulado: boolean;
  aberto_em: string;
  atendido_em: string | null;
  atendimento_via: string | null;
}

/** Tempo até a presença no quarto (minutos), sem simulações nem excepcionais. */
export function indicadoresChamados(lista: ChamadoHistorico[]) {
  const reais = lista.filter((c) => !c.simulado);
  const atendidos = reais.filter((c) => c.status === "atendido" && c.atendido_em);
  const tempos = atendidos
    .map((c) => (new Date(c.atendido_em!).getTime() - new Date(c.aberto_em).getTime()) / 60_000)
    .sort((a, b) => a - b);
  const mediana = tempos.length === 0 ? null : tempos[Math.floor((tempos.length - 1) / 2)];
  return {
    total: reais.length,
    emergencias: reais.filter((c) => c.tipo === "emergencia").length,
    atendidos: atendidos.length,
    excepcionais: reais.filter((c) => c.status === "encerrado_excepcional").length,
    medianaMin: mediana === null ? null : Math.round(mediana * 10) / 10,
    maiorMin: tempos.length ? Math.round(tempos[tempos.length - 1] * 10) / 10 : null,
  };
}
