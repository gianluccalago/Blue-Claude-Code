// ===========================================================================
// RONDAS NFC — regras puras (sem React, sem rede).
//
// O que o sistema comprova: que ALGUÉM esteve no quarto (tag + contador +
// tablet cadastrado), com horário do SERVIDOR. O checklist é declaratório.
// Rondas sincronizadas tarde (offline) comprovam presença, mas o horário não
// é confiável (seria o da sincronização): não contam no cumprimento por
// horário e aparecem à parte, para o supervisor.
// ===========================================================================

import type { RondaLeitura, StatusLeituraRonda } from "@/types/database";

// ─── Checklist (só seleção, nunca texto) ─────────────────────────────────────

export interface CampoChecklist {
  chave: "posicao" | "fralda" | "pele" | "estado" | "intercorrencia" | "observacoes";
  rotulo: string;
  obrigatorio: boolean;
  multiplo?: boolean;
  padrao?: string;
  opcoes: { valor: string; rotulo: string }[];
}

const o = (valor: string, rotulo = valor) => ({ valor, rotulo });

export const CAMPOS_CHECKLIST: CampoChecklist[] = [
  {
    chave: "posicao",
    rotulo: "Posição",
    obrigatorio: true,
    opcoes: [
      o("lateral_direita", "Lado direito"),
      o("lateral_esquerda", "Lado esquerdo"),
      o("dorsal", "Barriga para cima"),
      o("sentado", "Sentado"),
      o("dormindo_sem_reposicionar", "Dormindo, sem reposicionar (decisão clínica)"),
      o("recusou", "Recusou"),
    ],
  },
  {
    chave: "fralda",
    rotulo: "Fralda",
    obrigatorio: true,
    opcoes: [o("trocada", "Trocada"), o("seca", "Seca, não precisou"), o("nao_usa", "Não usa")],
  },
  {
    chave: "estado",
    rotulo: "Estado",
    obrigatorio: true,
    opcoes: [o("dormindo", "Dormindo"), o("acordado_tranquilo", "Acordado, tranquilo"), o("agitado", "Agitado"), o("com_dor", "Com dor")],
  },
  {
    chave: "pele",
    rotulo: "Pele",
    obrigatorio: false,
    padrao: "sem_alteracao",
    opcoes: [o("sem_alteracao", "Sem alteração"), o("vermelhidao", "Vermelhidão"), o("lesao", "Lesão")],
  },
  {
    chave: "intercorrencia",
    rotulo: "Intercorrência",
    obrigatorio: false,
    padrao: "nao",
    // Os mesmos tipos do registro de intercorrência da cuidadora.
    opcoes: [o("nao", "Não"), o("Queda"), o("Alteração de consciência"), o("Humor/sono"), o("Lesão de pele"), o("Recusa"), o("Vômito"), o("Outras")],
  },
  {
    chave: "observacoes",
    rotulo: "Observações",
    obrigatorio: false,
    multiplo: true,
    opcoes: [o("Pediu água"), o("Tosse"), o("Com frio, agasalhado(a)"), o("Levado(a) ao banheiro"), o("Chamei a enfermagem")],
  },
];

export type ChecklistHospede = Partial<Record<CampoChecklist["chave"], string | string[]>>;

export function checklistInicial(): ChecklistHospede {
  const c: ChecklistHospede = {};
  for (const campo of CAMPOS_CHECKLIST) {
    if (campo.multiplo) c[campo.chave] = [];
    else if (campo.padrao) c[campo.chave] = campo.padrao;
  }
  return c;
}

export function checklistCompleto(c: ChecklistHospede): boolean {
  return CAMPOS_CHECKLIST.every((campo) => !campo.obrigatorio || (typeof c[campo.chave] === "string" && !!c[campo.chave]));
}

export function rotuloOpcao(chave: CampoChecklist["chave"], valor: string): string {
  return CAMPOS_CHECKLIST.find((c) => c.chave === chave)?.opcoes.find((x) => x.valor === valor)?.rotulo ?? valor;
}

// ─── Rótulos de status e sinalizações ─────────────────────────────────────────

export const STATUS_LEITURA_LABEL: Record<StatusLeituraRonda, string> = {
  valida: "Válida",
  rejeitada_payload: "Leitura inválida",
  rejeitada_uid_divergente: "UID divergente",
  rejeitada_tag_desconhecida: "Tag não cadastrada",
  rejeitada_tag_inativa: "Tag desativada",
  rejeitada_contador_repetido: "Contador repetido",
  rejeitada_contador_menor: "Contador antigo",
  rejeitada_dispositivo: "Tablet não cadastrado",
  rejeitada_usuario: "Usuário sem permissão",
};

/** O que a cuidadora vê quando a leitura é recusada (sem jargão). */
export const STATUS_LEITURA_CUIDADORA: Record<StatusLeituraRonda, string> = {
  valida: "Ronda registrada.",
  rejeitada_payload: "Não consegui ler a etiqueta. Encoste de novo, sem mexer.",
  rejeitada_uid_divergente: "Leitura não confere com a etiqueta. Encoste de novo.",
  rejeitada_tag_desconhecida: "Etiqueta não cadastrada. Avise a Coordenação.",
  rejeitada_tag_inativa: "Etiqueta desativada. Avise a Coordenação.",
  rejeitada_contador_repetido: "Essa leitura já foi usada. Encoste de novo.",
  rejeitada_contador_menor: "Leitura antiga. Encoste de novo.",
  rejeitada_dispositivo: "Este tablet não está cadastrado. Avise a Coordenação.",
  rejeitada_usuario: "Seu usuário não pode registrar ronda.",
};

export const FLAG_LABEL: Record<string, string> = {
  uid_nao_confirmado: "Número de série não confirmado",
  leituras_nao_registradas: "Etiqueta lida antes fora do app (salto de contador)",
  plausibilidade: "Quartos diferentes em poucos segundos",
  sincronizado_tarde: "Sincronizada tarde (sem rede)",
  sem_plantao: "Fora do plantão escalado",
  possivel_forjada: "Possível check-in forjado",
  dispositivo_revogado: "Tablet revogado",
};

/**
 * Sinalizações que ficam só no registro, sem pedir revisão:
 * - sem_plantao: cobertura/terceirizada é comum;
 * - leituras_nao_registradas: o contador da etiqueta sobe a cada leitura de
 *   qualquer celular (alguém encostou o próprio telefone, um teste) — não
 *   indica problema na ronda.
 */
export const FLAGS_SO_REGISTRO: readonly string[] = ["sem_plantao", "leituras_nao_registradas"];

/** Tem alguma sinalização que pede olhar do supervisor. */
export function temSinalizacao(flags: string[]): boolean {
  return flags.some((f) => !FLAGS_SO_REGISTRO.includes(f));
}

// ─── Status do hóspede no plantão ─────────────────────────────────────────────

export const AVISO_ANTES_MIN = 15;

export interface ConfigRonda {
  intervalo_min: number;
  tolerancia_min: number;
}

export type SituacaoRonda = "em_dia" | "vencendo" | "atrasada";

/**
 * Situação do hóspede agora. Base = última ronda NO HORÁRIO (válida e não
 * sincronizada tarde) — ou o início do turno, se a última é anterior a ele
 * por mais de um intervalo. Vencendo: a partir de 15 min antes do intervalo.
 * Atrasada: passou do intervalo + tolerância.
 */
export function situacaoRonda(
  cfg: ConfigRonda,
  ultimaEm: Date | null,
  inicioTurno: Date,
  agora: Date,
): { situacao: SituacaoRonda; proximaEm: Date; limiteEm: Date } {
  const intervalo = cfg.intervalo_min * 60_000;
  const base = ultimaEm && ultimaEm.getTime() > inicioTurno.getTime() - intervalo ? ultimaEm : inicioTurno;
  const proximaEm = new Date(base.getTime() + intervalo);
  const limiteEm = new Date(proximaEm.getTime() + cfg.tolerancia_min * 60_000);
  const t = agora.getTime();
  const situacao: SituacaoRonda =
    t > limiteEm.getTime() ? "atrasada" : t >= proximaEm.getTime() - AVISO_ANTES_MIN * 60_000 ? "vencendo" : "em_dia";
  return { situacao, proximaEm, limiteEm };
}

// ─── Conformidade (blocos do turno) ───────────────────────────────────────────

export interface BlocoRonda {
  inicio: Date;
  fim: Date;
  estado: "cumprido" | "descumprido" | "em_andamento";
}

/**
 * O turno é dividido em blocos do tamanho do intervalo (12 h / 2 h = 6).
 * Bloco cumprido: há ronda no horário entre o início do bloco e o fim + a
 * tolerância. Bloco ainda aberto (agora < fim + tolerância) e sem ronda fica
 * "em andamento" e não entra na conta.
 */
export function blocosDoTurno(
  cfg: ConfigRonda,
  inicio: Date,
  fim: Date,
  rondasNoHorario: Date[],
  agora: Date,
): { blocos: BlocoRonda[]; cumpridos: number; encerrados: number; pct: number | null } {
  const intervalo = cfg.intervalo_min * 60_000;
  const tol = cfg.tolerancia_min * 60_000;
  const blocos: BlocoRonda[] = [];
  for (let ini = inicio.getTime(); ini < fim.getTime(); ini += intervalo) {
    const f = Math.min(ini + intervalo, fim.getTime());
    if (ini > agora.getTime()) break; // bloco que ainda não começou
    const ok = rondasNoHorario.some((r) => r.getTime() >= ini && r.getTime() <= f + tol);
    const estado: BlocoRonda["estado"] = ok ? "cumprido" : agora.getTime() > f + tol ? "descumprido" : "em_andamento";
    blocos.push({ inicio: new Date(ini), fim: new Date(f), estado });
  }
  const cumpridos = blocos.filter((b) => b.estado === "cumprido").length;
  const encerrados = blocos.filter((b) => b.estado !== "em_andamento").length;
  return { blocos, cumpridos, encerrados, pct: encerrados === 0 ? null : Math.round((cumpridos / encerrados) * 100) };
}

/**
 * Leitura que conta no horário: válida, não sincronizada tarde e sem suspeita
 * de check-in forjado ainda não revisada pelo supervisor.
 */
export function contaNoHorario(
  l: Pick<RondaLeitura, "status_validacao" | "sincronizado_tarde"> & Partial<Pick<RondaLeitura, "flags" | "revisada_em">>,
): boolean {
  if (l.status_validacao !== "valida" || l.sincronizado_tarde) return false;
  return !(l.flags ?? []).includes("possivel_forjada") || !!l.revisada_em;
}

/** Resumo do checklist declarado, na ordem dos campos. */
export function resumoChecklist(c: Record<string, string | string[]> | null): string {
  if (!c) return "";
  return CAMPOS_CHECKLIST.filter((campo) => !campo.multiplo && typeof c[campo.chave] === "string")
    .map((campo) => rotuloOpcao(campo.chave, c[campo.chave] as string))
    .join(" · ");
}

/** Leitura que pede olhar do supervisor: recusada, ou válida com sinalização, e ainda não revisada. */
export function pedeRevisao(l: Pick<RondaLeitura, "status_validacao" | "flags" | "revisada_em">): boolean {
  if (l.revisada_em) return false;
  if (l.status_validacao !== "valida") return true;
  return temSinalizacao(l.flags);
}
