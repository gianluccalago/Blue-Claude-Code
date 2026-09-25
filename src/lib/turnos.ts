import type { TipoRemuneracao } from "@/types/database";

// ===========================================================================
// Regra de CARGA HORÁRIA dos turnos. NÃO afeta o pagamento (que é por plantão
// fixo) — só a contagem de horas EFETIVAS exibida em indicadores de carga.
//
// Plantões de ~12h de profissionais PJ (por_plantao) descontam 1h de almoço →
// contam como 11h efetivas. Sem check-in/out de almoço e sem registro fictício:
// é só cálculo. CLT (mensal_fixo, isentos) e turnos que não sejam de 12h não
// sofrem desconto.
// ===========================================================================

/** Duração do turno em horas, a partir dos timestamps inicio/fim. */
export function duracaoHorasTurno(turno: { inicio: string; fim: string }): number {
  const ini = new Date(turno.inicio).getTime();
  const fim = new Date(turno.fim).getTime();
  if (!Number.isFinite(ini) || !Number.isFinite(fim)) return 0;
  let horas = (fim - ini) / 36e5;
  // Tolera fim "sem a data seguinte" num turno que cruza a meia-noite.
  if (horas <= 0) horas += 24;
  return horas;
}

/** Turno de ~12h (janela 11–13h, tolerando variação de minutos). */
export function ehTurno12h(horas: number): boolean {
  return horas >= 11 && horas <= 13;
}

/** Horas EFETIVAS do turno (desconta 1h de almoço nos plantões 12h PJ). */
export function horasEfetivasTurno(
  turno: { inicio: string; fim: string },
  tipoRemuneracao: TipoRemuneracao | null,
): number {
  const horas = duracaoHorasTurno(turno);
  if (tipoRemuneracao === "por_plantao" && ehTurno12h(horas)) return horas - 1;
  return horas;
}

/** "11h" / "23,5h" para exibição compacta de carga horária. */
export function formatarHoras(horas: number): string {
  const arred = Math.round(horas * 10) / 10;
  return `${arred.toLocaleString("pt-BR")}h`;
}

// ===========================================================================
// Regras da ESCALA e do PONTO (achados ESC-01/02). Funções puras, testadas em
// turnos.test.ts. O banco (migration 0140) é a autoridade final: CHECK
// fim > inicio, exclusão de sobreposição por profissional e triggers do ponto.
// Aqui só se antecipa o erro com mensagem clara e se calcula o turno ativo.
// ===========================================================================

/** Instante (ms) de um ISO; NaN se inválido. Nunca compare ISO como texto. */
export function instante(iso: string): number {
  return Date.parse(iso);
}

/** Intervalos [inicio, fim) se sobrepõem? (encostados 19:00→19:00 NÃO colidem) */
export function sobrepoe(
  a: { inicio: string; fim: string },
  b: { inicio: string; fim: string },
): boolean {
  return instante(a.inicio) < instante(b.fim) && instante(b.inicio) < instante(a.fim);
}

/** "HH:MM" → minutos desde 00:00; NaN se malformado. */
function minutos(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm);
  if (!m) return NaN;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Duração em minutos de início→fim (+24h se o fim cai no dia seguinte). */
export function duracaoMinutos(inicioTime: string, fimTime: string, fimDiaSeguinte: boolean): number {
  const ini = minutos(inicioTime);
  const fim = minutos(fimTime) + (fimDiaSeguinte ? 24 * 60 : 0);
  return fim - ini;
}

/**
 * Valida os horários digitados no modal. Devolve a mensagem de erro ou null.
 * Fim ≤ início (no mesmo dia) é o erro clássico; acima de 24h só acontece
 * marcando "dia seguinte" com fim depois do início (ex.: 07:00 → 08:00+1).
 */
export function validarHorariosTurno(
  inicioTime: string,
  fimTime: string,
  fimDiaSeguinte: boolean,
): string | null {
  const dur = duracaoMinutos(inicioTime, fimTime, fimDiaSeguinte);
  if (!Number.isFinite(dur)) return "Informe início e fim do turno.";
  if (dur <= 0) {
    return fimDiaSeguinte
      ? "O fim precisa ser depois do início."
      : "O fim precisa ser depois do início. Se o turno cruza a meia-noite, marque \"Fim no dia seguinte\".";
  }
  if (dur > 24 * 60) return "Um turno não pode passar de 24 horas.";
  return null;
}

/**
 * Tag diurno/noturno pelas horas (escala padrão 07–19 / 19–07): o turno é
 * diurno quando o seu PONTO MÉDIO cai entre 07:00 e 19:00; senão, noturno.
 * 07–19 → diurno; 19–07(+1) → noturno; 13–01(+1) → noturno; 06–18 → diurno.
 */
export function tagPelasHoras(
  inicioTime: string,
  fimTime: string,
  fimDiaSeguinte: boolean,
): "diurno" | "noturno" {
  const ini = minutos(inicioTime);
  const dur = duracaoMinutos(inicioTime, fimTime, fimDiaSeguinte);
  if (!Number.isFinite(ini) || !Number.isFinite(dur)) return "diurno";
  const meio = (ini + dur / 2) % (24 * 60);
  return meio >= 7 * 60 && meio < 19 * 60 ? "diurno" : "noturno";
}

// ─── Turno ativo (plantão) ───────────────────────────────────────────────────

/** Tolerância de 10 min antes do início e depois do fim do turno. */
export const TOLERANCIA_PLANTAO_MS = 10 * 60 * 1000;

type TurnoPonto = {
  inicio: string;
  fim: string;
  check_in: string | null;
  check_out: string | null;
};

/** Um turno está "no horário" se agora ∈ [inicio−10min, fim+10min]. */
export function turnoNoHorario(t: { inicio: string; fim: string }, agora: number): boolean {
  return (
    agora >= instante(t.inicio) - TOLERANCIA_PLANTAO_MS &&
    agora <= instante(t.fim) + TOLERANCIA_PLANTAO_MS
  );
}

/**
 * Escolhe o turno ativo entre os turnos da profissional. Prioridade:
 *  1. plantão em andamento (check_in feito e sem check_out) dentro da janela;
 *  2. turno cujo intervalo [inicio, fim] contém agora (00h30 ainda é o
 *     noturno de ontem 19h; às 06:55 o noturno em curso ganha do diurno que
 *     só começa às 07:00);
 *  3. o mais próximo por início, dentro da tolerância.
 */
export function escolherTurnoAtivo<T extends TurnoPonto>(turnos: T[], agora: number): T | null {
  const janela = turnos
    .filter((t) => turnoNoHorario(t, agora))
    .sort((a, b) => instante(a.inicio) - instante(b.inicio));
  if (janela.length === 0) return null;
  const emCurso = janela.find((t) => t.check_in && !t.check_out);
  if (emCurso) return emCurso;
  const contem = janela.find((t) => instante(t.inicio) <= agora && agora <= instante(t.fim));
  return contem ?? janela[0];
}

// ─── Erros do banco com mensagem clara ──────────────────────────────────────

/** Erro do PostgREST/Postgres: code (SQLSTATE) + message. */
type ErroBanco = { code?: string; message?: string; details?: string };

/**
 * Traduz as violações da migration 0140 para o operador. Códigos:
 * 23P01 exclusão (sobreposição), 23514 CHECK (fim > inicio), P0001 RAISE dos
 * triggers (a mensagem já é em português e vem do servidor).
 */
export function mensagemErroTurno(erro: unknown): string {
  const e = (erro ?? {}) as ErroBanco;
  const msg = e.message ?? "";
  if (e.code === "23P01" || /turnos_sem_sobreposicao/.test(msg)) {
    return "Conflito de horário: esta profissional já tem outro turno nesse período.";
  }
  if (e.code === "23514" || /turnos_fim_apos_inicio/.test(msg)) {
    return "O fim do turno precisa ser depois do início.";
  }
  if (msg) return msg;
  return "Não foi possível salvar o turno.";
}
