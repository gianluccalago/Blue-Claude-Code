import { dataISO } from "@/lib/utils";
import { minutosAgoraSP } from "@/lib/periodos";
import type {
  Administracao,
  PeriodoMedicacao,
  PlanoCuidadoItem,
  TagTurno,
  Turno,
} from "@/types/database";

// ===========================================================================
// EIXO DE TEMPO DO PLANTÃO (funções puras, sem React e sem rede).
//
// O plantão NOTURNO (19h–07h) atravessa a meia-noite. Tudo o que na ponta era
// "de hoje" (dose da Noite, tarefa das 06h, "em atraso") tem de ser lido em
// relação ao PLANTÃO, não ao dia civil — senão à meia-noite a dose já dada
// vira "não registrada" (risco de dose dobrada) e a tarefa das 06h aparece
// "em atraso" desde as 19h. Este módulo é a única fonte dessa janela.
// ===========================================================================

/** Tolerância de 10 min antes do início e depois do fim do turno (a mesma do check-in). */
export const TOLERANCIA_PLANTAO_MS = 10 * 60 * 1000;

const DIA_MS = 24 * 60 * 60 * 1000;

export interface JanelaPlantao {
  /** Início da janela (início do turno − tolerância; sem turno, 00:00 de SP). */
  inicio: Date;
  /** Fim da janela (fim do turno + tolerância; sem turno, 00:00 do dia seguinte). */
  fim: Date;
  /** Data civil (YYYY-MM-DD, fuso da casa) do INÍCIO do turno — "data do plantão". */
  dataPlantao: string;
}

/** Instante de `data` (YYYY-MM-DD) às `hhmm` no fuso da casa (UTC−3 fixo). */
export function instanteSP(data: string, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return new Date(`${data}T${hh}:${mm}:00-03:00`);
}

/** Dia civil anterior de uma data YYYY-MM-DD (sem depender do fuso do device). */
export function diaAnterior(data: string): string {
  return dataISO(new Date(instanteSP(data, "12:00").getTime() - DIA_MS));
}

/**
 * Janela de tempo do plantão corrente.
 * - Com turno ativo: do início do turno (com tolerância) ao fim (com tolerância).
 *   `dataPlantao` é a data civil do início do turno (noturno de 24/09 19h →
 *   "2026-09-24", mesmo às 06h50 de 25/09).
 * - Sem turno: o dia civil de São Paulo em que `agora` cai.
 */
export function janelaDoPlantao(
  turno: Pick<Turno, "inicio" | "fim"> | null,
  agora: Date = new Date(),
): JanelaPlantao {
  if (turno) {
    const ini = new Date(turno.inicio);
    const fim = new Date(turno.fim);
    return {
      inicio: new Date(ini.getTime() - TOLERANCIA_PLANTAO_MS),
      fim: new Date(fim.getTime() + TOLERANCIA_PLANTAO_MS),
      dataPlantao: dataISO(ini),
    };
  }
  const hoje = dataISO(agora);
  const inicio = instanteSP(hoje, "00:00");
  return { inicio, fim: new Date(inicio.getTime() + DIA_MS), dataPlantao: hoje };
}

/** `instante` cai dentro da janela (inclusive nas bordas)? */
export function dentroDaJanela(instante: string | Date, janela: JanelaPlantao): boolean {
  const t = new Date(instante).getTime();
  return t >= janela.inicio.getTime() && t <= janela.fim.getTime();
}

/**
 * Instante em que um horário "HH:MM" acontece DENTRO do plantão: a primeira
 * ocorrência a partir do início da janela. No noturno de 24/09, "06:00" é
 * 25/09 06:00 (não 24/09 06:00, que já passou quando o plantão começou).
 */
export function instanteNoPlantao(horario: string | null, janela: JanelaPlantao): Date | null {
  if (!horario) return null;
  const m = horario.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let alvo = instanteSP(janela.dataPlantao, `${m[1]}:${m[2]}`);
  if (alvo.getTime() < janela.inicio.getTime()) alvo = new Date(alvo.getTime() + DIA_MS);
  return alvo;
}

// ─── Medicação ────────────────────────────────────────────────────────────────

export type RegistroPorPeriodo = Partial<Record<PeriodoMedicacao, Administracao>>;

/** Ordena por instante (não por texto: o formato do timestamp pode variar). */
function maisRecentePrimeiro(a: Administracao, b: Administracao): number {
  return new Date(b.administrado_em).getTime() - new Date(a.administrado_em).getTime();
}

/**
 * Registro MAIS RECENTE de cada período dentro da janela do plantão. Só o que
 * foi registrado neste plantão conta: a dose da Noite dada às 20h continua
 * "registrada" às 00h30 e às 06h50 do mesmo plantão; no plantão seguinte ela
 * não aparece (nem como registrada, nem como pendente).
 */
export function registroPorPeriodo(
  administracoes: Administracao[],
  janela: JanelaPlantao,
): RegistroPorPeriodo {
  const mapa: RegistroPorPeriodo = {};
  const ordenadas = administracoes
    .filter((r) => dentroDaJanela(r.administrado_em, janela))
    .sort(maisRecentePrimeiro);
  for (const reg of ordenadas) {
    const p = reg.periodo as PeriodoMedicacao;
    if (!mapa[p]) mapa[p] = reg;
  }
  return mapa;
}

/**
 * Registros ANTERIORES à janela (passagem de plantão, somente leitura): o mais
 * recente de cada período entre os registros feitos antes do início do plantão.
 */
export function registrosDoPlantaoAnterior(
  administracoes: Administracao[],
  janela: JanelaPlantao,
): RegistroPorPeriodo {
  const mapa: RegistroPorPeriodo = {};
  const ordenadas = administracoes
    .filter((r) => new Date(r.administrado_em).getTime() < janela.inicio.getTime())
    .sort(maisRecentePrimeiro);
  for (const reg of ordenadas) {
    const p = reg.periodo as PeriodoMedicacao;
    if (!mapa[p]) mapa[p] = reg;
  }
  return mapa;
}

// ─── Checklist ────────────────────────────────────────────────────────────────

export type StatusTarefaKey = "feito" | "atraso" | "em_breve" | "normal";

export interface StatusTarefa {
  key: StatusTarefaKey;
  label: string;
  dot: string;
}

/**
 * Status de uma tarefa do plano no eixo do PLANTÃO. A regra de tolerância é a
 * mesma de antes (atraso = passou de horário + tolerância; em breve = faltam
 * até 30 min); só o eixo de tempo mudou: a tarefa das 06h do noturno de 24/09
 * é a das 06h de 25/09, e só atrasa depois disso.
 */
export function statusTarefaNoPlantao(
  item: Pick<PlanoCuidadoItem, "horario" | "tolerancia_minutos">,
  feito: boolean,
  janela: JanelaPlantao,
  agora: Date = new Date(),
): StatusTarefa {
  if (feito) return { key: "feito", label: "Feito", dot: "bg-success" };
  const alvo = instanteNoPlantao(item.horario, janela);
  if (alvo === null) return { key: "normal", label: "Normal", dot: "bg-muted-foreground/40" };
  const alvoMs = alvo.getTime();
  const agoraMs = agora.getTime();
  if (agoraMs > alvoMs + item.tolerancia_minutos * 60 * 1000)
    return { key: "atraso", label: "Em atraso", dot: "bg-destructive" };
  if (agoraMs >= alvoMs - 30 * 60 * 1000)
    return { key: "em_breve", label: "Em breve", dot: "bg-warning" };
  return { key: "normal", label: "Normal", dot: "bg-muted-foreground/40" };
}

// ─── Pendências da Coordenação ────────────────────────────────────────────────

export interface PlantaoDeInstante {
  /** Data civil do início do plantão (noturno da madrugada = véspera). */
  dataPlantao: string;
  tag: TagTurno;
}

/**
 * A que plantão um instante pertence, pela definição das tags da escala
 * (TurnoModal: Diurno 07:00–19:00 / Noturno 19:00–07:00), no fuso da casa.
 * Usado só para rotular/agrupar pendências no painel — não consulta a escala.
 */
export function plantaoDoInstante(instante: string | Date): PlantaoDeInstante {
  const d = new Date(instante);
  const min = minutosAgoraSP(d);
  const hoje = dataISO(d);
  if (min >= 7 * 60 && min < 19 * 60) return { dataPlantao: hoje, tag: "diurno" };
  if (min >= 19 * 60) return { dataPlantao: hoje, tag: "noturno" };
  return { dataPlantao: diaAnterior(hoje), tag: "noturno" };
}

/** "Plantão noturno de 24/09" — rótulo do plantão a que um instante pertence. */
export function rotuloPlantao(instante: string | Date): string {
  const p = plantaoDoInstante(instante);
  const [, m, d] = p.dataPlantao.split("-");
  return `Plantão ${p.tag} de ${d}/${m}`;
}

export function mesmoPlantao(a: string | Date, b: string | Date): boolean {
  const pa = plantaoDoInstante(a);
  const pb = plantaoDoInstante(b);
  return pa.dataPlantao === pb.dataPlantao && pa.tag === pb.tag;
}

/**
 * Pendências de medicação ABERTAS: registros parcial/nao que NÃO foram
 * seguidos de um "sim" do mesmo residente e período no mesmo plantão (a
 * cuidadora voltou e conseguiu administrar → a recusa deixa de ser pendência).
 * Mantém a ordem recebida.
 */
export function pendenciasMedicacaoAbertas(administracoes: Administracao[]): Administracao[] {
  const sims = administracoes.filter((r) => r.status === "sim");
  return administracoes.filter((r) => {
    if (r.status !== "parcial" && r.status !== "nao") return false;
    return !sims.some(
      (s) =>
        s.residente_id === r.residente_id &&
        s.periodo === r.periodo &&
        new Date(s.administrado_em).getTime() > new Date(r.administrado_em).getTime() &&
        mesmoPlantao(s.administrado_em, r.administrado_em),
    );
  });
}
