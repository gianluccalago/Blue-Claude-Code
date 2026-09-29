// ===========================================================================
// AUTONOMIA — catálogo, prazos, gatilhos de reavaliação, indicador e resumo.
// Funções puras (sem React, sem rede). Nada aqui marca autonomia sozinho: tudo
// sai de registros feitos por pessoas (avaliações assinadas, objetivos e
// revisões com observação e fala do residente).
// ===========================================================================

import { somarDias, diasEntre } from "@/lib/rotina";
import type {
  AutonomiaAvaliacao,
  AutonomiaObjetivo,
  AutonomiaRevisao,
  DominioAutonomia,
  MotivoAvaliacaoAutonomia,
  NivelConsegue,
  NivelQuer,
  PerfilUsuario,
  RespostaItemAutonomia,
} from "@/types/database";

// ─── Catálogo ─────────────────────────────────────────────────────────────────

/**
 * completo   → quer / consegue / preferência / equipe assume por rapidez
 * capacidade → consegue + observação (itens do médico)
 * texto      → só observação
 */
export type TipoItem = "completo" | "capacidade" | "texto";

export interface ItemCatalogo {
  chave: string;
  rotulo: string;
  tipo: TipoItem;
}

export interface DominioDef {
  id: DominioAutonomia;
  rotulo: string;
  quemAvalia: string;
  itens: ItemCatalogo[];
}

const c = (chave: string, rotulo: string, tipo: TipoItem = "completo"): ItemCatalogo => ({ chave, rotulo, tipo });

export const DOMINIOS: DominioDef[] = [
  {
    id: "medico",
    rotulo: "Capacidade e restrições",
    quemAvalia: "Médico",
    itens: [
      c("decisao", "Decidir sobre o próprio cuidado (consentir e recusar)", "capacidade"),
      c("orientacao", "Orientação e memória no dia a dia", "capacidade"),
      c("comunicacao", "Comunicação e compreensão", "capacidade"),
      c("continencia", "Continência e manejo", "capacidade"),
      c("humor", "Humor e motivação", "texto"),
      c("sono", "Sono e descanso", "texto"),
      c("medicamentos", "Medicamentos que afetam a autonomia (sedação, tontura, rigidez)", "texto"),
      c("restricoes", "Restrições clínicas justificadas (o quê, por quê, até quando)", "texto"),
    ],
  },
  {
    id: "coordenacao",
    rotulo: "Rotina e vida na casa",
    quemAvalia: "Coordenação assistencial",
    itens: [
      c("banho", "Banho: preferência de turno, dentro da rotina da casa"),
      c("roupa", "Escolher a própria roupa"),
      c("vestir", "Vestir-se e calçar-se"),
      c("cuidados_pessoais", "Cuidados pessoais (pentear, barbear, maquiagem, perfume)"),
      c("quarto", "Arrumar o próprio quarto e pertences"),
      c("tarefas_significativas", "Tarefas significativas na casa (regar plantas, pôr a mesa, ajudar na cozinha)"),
      c("visitas", "Visitas: quem, quando, onde recebe"),
      c("atividades", "Atividades preferidas (em grupo, sozinho, religiosas, passeios)"),
      c("privacidade", "Privacidade (porta fechada, banho sem plateia, ligações)"),
    ],
  },
  {
    id: "fisio",
    rotulo: "Mobilidade",
    quemAvalia: "Fisioterapia",
    itens: [
      c("cama", "Levantar e deitar da cama"),
      c("cadeira", "Sentar e levantar de cadeira e vaso"),
      c("andar_quarto", "Andar dentro do quarto"),
      c("andar_casa", "Andar pela casa e áreas comuns"),
      c("escadas", "Escadas e rampas"),
      c("dispositivo", "Escolha e manejo de bengala, andador ou cadeira"),
      c("sair", "Sair ao jardim ou à rua acompanhado"),
      c("atividade_fisica", "Atividade física de que gosta"),
      c("supervisao", "O que aceita fazer com supervisão em vez de ajuda", "texto"),
    ],
  },
  {
    id: "nutricao",
    rotulo: "Alimentação",
    quemAvalia: "Nutrição",
    itens: [
      c("comer_sozinho", "Comer sozinho com talheres e copo"),
      c("escolher", "Escolher o que come (cardápio e substituições)"),
      c("ritmo", "Ritmo da refeição, sem ser apressado"),
      c("onde_com_quem", "Onde e com quem come"),
      c("servir_se", "Servir-se, repetir, lanches"),
      c("preferencias", "Preferências e aversões alimentares", "texto"),
      c("agua", "Beber água por conta própria"),
      c("preparo", "Participar do preparo (cozinha, horta)"),
    ],
  },
];

export const DOMINIO_POR_ID = new Map(DOMINIOS.map((d) => [d.id, d]));

export const CONSEGUE_LABEL: Record<NivelConsegue, string> = {
  sozinho: "Sozinho",
  supervisao: "Com supervisão",
  ajuda_parcial: "Ajuda parcial",
  dependente: "Dependente",
};
export const QUER_LABEL: Record<NivelQuer, string> = { sim: "Quer", nao: "Não quer", as_vezes: "Às vezes" };
export const MOTIVO_LABEL: Record<MotivoAvaliacaoAutonomia, string> = {
  entrada: "Avaliação de entrada",
  periodica: "Reavaliação semestral",
  mudanca_grau: "Reavaliação: mudança de grau",
  intercorrencia: "Reavaliação: intercorrência",
  outro: "Reavaliação",
};

/** Domínio que o perfil preenche (Master escolhe; os demais só leem). */
export function dominioDoPerfil(perfil: PerfilUsuario | string | undefined): DominioAutonomia | null {
  switch (perfil) {
    case "medico": return "medico";
    case "coordenacao": return "coordenacao";
    case "multidisciplinar": return "fisio";
    case "nutricionista": return "nutricao";
    default: return null;
  }
}

/** Item com algo preenchido? (não conta item vazio como avaliado). */
export function itemPreenchido(r: RespostaItemAutonomia | undefined): boolean {
  if (!r) return false;
  return !!(r.quer || r.consegue || r.preferencia?.trim() || r.obs?.trim() || r.equipe_assume);
}

/** Remove itens vazios e aparas de texto (o que vai para o banco). */
export function limparItens(itens: Record<string, RespostaItemAutonomia>): Record<string, RespostaItemAutonomia> {
  const out: Record<string, RespostaItemAutonomia> = {};
  for (const [k, v] of Object.entries(itens)) {
    if (!itemPreenchido(v)) continue;
    const limpo: RespostaItemAutonomia = {};
    if (v.quer) limpo.quer = v.quer;
    if (v.consegue) limpo.consegue = v.consegue;
    if (v.preferencia?.trim()) limpo.preferencia = v.preferencia.trim();
    if (v.equipe_assume) limpo.equipe_assume = true;
    if (v.obs?.trim()) limpo.obs = v.obs.trim();
    out[k] = limpo;
  }
  return out;
}

// ─── Prazos e reavaliação ─────────────────────────────────────────────────────

export const PRAZO_ENTRADA_DIAS = 7;
export const PRAZO_QUEM_JA_ESTAVA_DIAS = 30;
export const REAVALIACAO_DIAS = 182; // ~6 meses
export const PRAZO_GATILHO_DIAS = 7;
export const REVISAO_OBJETIVO_DIAS = 90;
/** Intercorrência escalada ao médico pede reavaliação destes domínios. */
export const DOMINIOS_GATILHO_INTERCORRENCIA: DominioAutonomia[] = ["medico", "coordenacao", "fisio"];

export interface IvcfResumo {
  classificacao: string;
  registrado_em: string;
}

export interface StatusDominio {
  dominio: DominioAutonomia;
  /** em_dia: avaliação assinada válida; pendente: falta avaliar/reavaliar. */
  situacao: "em_dia" | "pendente";
  motivo: MotivoAvaliacaoAutonomia | null;
  /** Prazo da pendência (YYYY-MM-DD) ou, em dia, da próxima reavaliação semestral. */
  prazo: string | null;
  vencida: boolean;
  ultima: AutonomiaAvaliacao | null;
  rascunho: AutonomiaAvaliacao | null;
}

const dataDe = (iso: string) => iso.slice(0, 10);

/** Prazo da 1ª avaliação: 7 dias da admissão; quem já estava na casa, 30 dias da ativação. */
export function prazoEntrada(dataAdmissao: string | null, ativadoEm: string): string {
  if (dataAdmissao && dataAdmissao >= ativadoEm) return somarDias(dataAdmissao, PRAZO_ENTRADA_DIAS);
  return somarDias(ativadoEm, PRAZO_QUEM_JA_ESTAVA_DIAS);
}

/** Datas em que o grau IVCF MUDOU (classificação diferente da anterior). */
export function mudancasDeGrau(ivcfs: ReadonlyArray<IvcfResumo>): string[] {
  const ord = [...ivcfs].sort((a, b) => a.registrado_em.localeCompare(b.registrado_em));
  const out: string[] = [];
  for (let i = 1; i < ord.length; i++) {
    if (ord[i].classificacao !== ord[i - 1].classificacao) out.push(dataDe(ord[i].registrado_em));
  }
  return out;
}

export function statusDoDominio(args: {
  dominio: DominioAutonomia;
  avaliacoes: ReadonlyArray<AutonomiaAvaliacao>;
  dataAdmissao: string | null;
  ativadoEm: string;
  ivcfs: ReadonlyArray<IvcfResumo>;
  /** Datas (YYYY-MM-DD) de intercorrências do hóspede escaladas ao médico. */
  escalonamentos: ReadonlyArray<string>;
  hoje: string;
}): StatusDominio {
  const { dominio, hoje } = args;
  const doDominio = args.avaliacoes.filter((a) => a.dominio === dominio);
  const assinadas = doDominio
    .filter((a) => a.assinada && a.assinada_em)
    .sort((a, b) => (b.assinada_em ?? "").localeCompare(a.assinada_em ?? ""));
  const ultima = assinadas[0] ?? null;
  const rascunho = doDominio.find((a) => !a.assinada) ?? null;

  if (!ultima) {
    const prazo = prazoEntrada(args.dataAdmissao, args.ativadoEm);
    return { dominio, situacao: "pendente", motivo: "entrada", prazo, vencida: hoje > prazo, ultima: null, rascunho };
  }

  const base = dataDe(ultima.assinada_em!);
  const gatilhos: { motivo: MotivoAvaliacaoAutonomia; prazo: string }[] = [];
  const periodica = somarDias(base, REAVALIACAO_DIAS);
  if (hoje >= periodica) gatilhos.push({ motivo: "periodica", prazo: periodica });
  const grau = mudancasDeGrau(args.ivcfs).filter((d) => d > base).sort()[0];
  if (grau) gatilhos.push({ motivo: "mudanca_grau", prazo: somarDias(grau, PRAZO_GATILHO_DIAS) });
  if (DOMINIOS_GATILHO_INTERCORRENCIA.includes(dominio)) {
    const esc = args.escalonamentos.filter((d) => d > base).sort()[0];
    if (esc) gatilhos.push({ motivo: "intercorrencia", prazo: somarDias(esc, PRAZO_GATILHO_DIAS) });
  }
  if (gatilhos.length === 0) {
    return { dominio, situacao: "em_dia", motivo: null, prazo: periodica, vencida: false, ultima, rascunho };
  }
  const g = gatilhos.sort((a, b) => a.prazo.localeCompare(b.prazo))[0];
  return { dominio, situacao: "pendente", motivo: g.motivo, prazo: g.prazo, vencida: hoje > g.prazo, ultima, rascunho };
}

export function statusDosDominios(args: Omit<Parameters<typeof statusDoDominio>[0], "dominio">): StatusDominio[] {
  return DOMINIOS.map((d) => statusDoDominio({ ...args, dominio: d.id }));
}

/** "vence em 3 dias" / "venceu há 2 dias" / "vence hoje". */
export function textoPrazo(prazo: string, hoje: string): string {
  const d = diasEntre(hoje, prazo);
  if (d === 0) return "vence hoje";
  if (d > 0) return `vence em ${d} dia${d === 1 ? "" : "s"}`;
  return `venceu há ${-d} dia${d === -1 ? "" : "s"}`;
}

// ─── Indicador ────────────────────────────────────────────────────────────────

export interface IndicadorHospede {
  residenteId: string;
  avaliacoesEmDia: boolean;
  temPreferencia: boolean;
  temObjetivoAtivo: boolean;
  revistoRecente: boolean;
  documentada: boolean;
  verificada: boolean;
}

/** Últimas avaliações assinadas de cada domínio. */
function ultimasAssinadas(status: ReadonlyArray<StatusDominio>): AutonomiaAvaliacao[] {
  return status.map((s) => s.ultima).filter((a): a is AutonomiaAvaliacao => !!a);
}

/**
 * Documentada: as 4 avaliações assinadas e nenhuma vencida, ao menos uma
 * preferência registrada e ao menos um objetivo ativo.
 * Verificada: documentada + um objetivo revisto nos últimos 90 dias (a
 * revisão exige o que foi observado e o que o residente disse).
 */
export function indicadorDoHospede(args: {
  residenteId: string;
  status: ReadonlyArray<StatusDominio>;
  objetivos: ReadonlyArray<AutonomiaObjetivo>;
  revisoes: ReadonlyArray<AutonomiaRevisao>;
  hoje: string;
}): IndicadorHospede {
  const { status, hoje } = args;
  const avaliacoesEmDia = status.length === DOMINIOS.length && status.every((s) => !!s.ultima && !s.vencida);
  const temPreferencia = ultimasAssinadas(status).some((a) =>
    Object.values(a.itens ?? {}).some((r) => !!r.preferencia?.trim()),
  );
  const objs = args.objetivos.filter((o) => o.residente_id === args.residenteId);
  const temObjetivoAtivo = objs.some((o) => o.status === "ativo");
  const idsObj = new Set(objs.map((o) => o.id));
  const limite = somarDias(hoje, -REVISAO_OBJETIVO_DIAS);
  const revistoRecente = args.revisoes.some((r) => idsObj.has(r.objetivo_id) && dataDe(r.revisado_em) >= limite);
  const documentada = avaliacoesEmDia && temPreferencia && temObjetivoAtivo;
  return {
    residenteId: args.residenteId,
    avaliacoesEmDia,
    temPreferencia,
    temObjetivoAtivo,
    revistoRecente,
    documentada,
    verificada: documentada && revistoRecente,
  };
}

export interface IndicadorCasa {
  total: number;
  documentadas: number;
  verificadas: number;
  pctDocumentada: number | null;
  pctVerificada: number | null;
  semAvaliacaoEmDia: number;
  semPreferencia: number;
  semObjetivo: number;
  semRevisaoRecente: number;
}

export function indicadorDaCasa(hospedes: ReadonlyArray<IndicadorHospede>): IndicadorCasa {
  const total = hospedes.length;
  const documentadas = hospedes.filter((h) => h.documentada).length;
  const verificadas = hospedes.filter((h) => h.verificada).length;
  const pct = (n: number) => (total === 0 ? null : Math.round((n / total) * 100));
  return {
    total,
    documentadas,
    verificadas,
    pctDocumentada: pct(documentadas),
    pctVerificada: pct(verificadas),
    semAvaliacaoEmDia: hospedes.filter((h) => !h.avaliacoesEmDia).length,
    semPreferencia: hospedes.filter((h) => !h.temPreferencia).length,
    semObjetivo: hospedes.filter((h) => !h.temObjetivoAtivo).length,
    semRevisaoRecente: hospedes.filter((h) => !h.revistoRecente).length,
  };
}

// ─── Resumo de leitura (ficha, cuidadora) ────────────────────────────────────

export interface ResumoAutonomia {
  sozinho: string[];
  supervisao: string[];
  /** Consegue (sozinho/supervisão) mas a equipe tem feito por rapidez → "deixe fazer". */
  deixeFazer: string[];
  preferencias: { item: string; texto: string }[];
  restricoesClinicas: string | null;
  temAvaliacao: boolean;
}

/** Resumo a partir das últimas avaliações ASSINADAS de cada domínio. */
export function resumoAutonomia(avaliacoes: ReadonlyArray<AutonomiaAvaliacao>): ResumoAutonomia {
  const ultimas = new Map<DominioAutonomia, AutonomiaAvaliacao>();
  for (const a of avaliacoes) {
    if (!a.assinada || !a.assinada_em) continue;
    const atual = ultimas.get(a.dominio);
    if (!atual || (a.assinada_em ?? "") > (atual.assinada_em ?? "")) ultimas.set(a.dominio, a);
  }
  const r: ResumoAutonomia = { sozinho: [], supervisao: [], deixeFazer: [], preferencias: [], restricoesClinicas: null, temAvaliacao: ultimas.size > 0 };
  for (const d of DOMINIOS) {
    const a = ultimas.get(d.id);
    if (!a) continue;
    for (const item of d.itens) {
      const resp = a.itens?.[item.chave];
      if (!resp) continue;
      if (item.chave === "restricoes" && d.id === "medico") {
        if (resp.obs?.trim()) r.restricoesClinicas = resp.obs.trim();
        continue;
      }
      if (item.tipo === "completo") {
        if (resp.consegue === "sozinho") r.sozinho.push(item.rotulo);
        if (resp.consegue === "supervisao") r.supervisao.push(item.rotulo);
        if (resp.equipe_assume && (resp.consegue === "sozinho" || resp.consegue === "supervisao")) r.deixeFazer.push(item.rotulo);
      }
      const texto = resp.preferencia?.trim() || (item.tipo === "texto" && d.id !== "medico" ? resp.obs?.trim() : "");
      if (texto) r.preferencias.push({ item: item.rotulo, texto });
    }
  }
  return r;
}

/** Objetivo precisa de revisão (prazo passou)? */
export function objetivoVencido(o: Pick<AutonomiaObjetivo, "status" | "prazo_revisao">, hoje: string): boolean {
  return o.status === "ativo" && o.prazo_revisao < hoje;
}
