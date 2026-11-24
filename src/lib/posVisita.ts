import type {
  CrmBiblioteca,
  CrmContato,
  CrmModeloMensagem,
  CrmOportunidade,
  CrmTarefa,
  ModalidadeSimulacao,
  OpcaoSimulacao,
  ProximoPasso,
} from "@/types/database";

// ===========================================================================
// CRM · CONDUÇÃO PÓS-VISITA — regras puras (sem banco). Função desenhada pelo
// sócio-diretor (nov/2026) e reconstruída dentro do CRM:
//  · na visita, quem recebe marca as dores e a objeção da família;
//  · o app monta as mensagens de WhatsApp com os textos da biblioteca
//    (envio manual, com um toque, pelo número do consultor);
//  · 3 contatos na primeira semana (D0, D+3, D+7); sem retorno, o lead é
//    dado como perdido — "Não respondeu mais";
//  · simulação: preço da tabela, 15% de desconto na longa permanência e na
//    reabilitação, sem desconto no Day Use e na curta permanência, validade
//    de 30 dias, "valor estimado, sujeito à avaliação médica".
// ===========================================================================

export const DESCONTO_SIMULACAO_PCT = 15;
export const VALIDADE_SIMULACAO_DIAS = 30;
export const MAX_DORES_NA_MENSAGEM = 2;
export const AVISO_SIMULACAO = "Valor estimado, sujeito à avaliação médica.";

export const MODALIDADES_SIMULACAO: {
  value: ModalidadeSimulacao;
  label: string;
  /** Usa a tabela de preços (mensalidade por suíte × grau × ocupação). */
  usaTabela: boolean;
  descontoPct: number;
}[] = [
  { value: "longa_permanencia", label: "Longa permanência", usaTabela: true, descontoPct: DESCONTO_SIMULACAO_PCT },
  { value: "reabilitacao", label: "Reabilitação", usaTabela: true, descontoPct: DESCONTO_SIMULACAO_PCT },
  { value: "curta_permanencia", label: "Curta permanência", usaTabela: false, descontoPct: 0 },
  { value: "day_use", label: "Day Use", usaTabela: false, descontoPct: 0 },
];

export const UNIDADES_VALOR = ["/mês", "/dia", "pacote"] as const;

export const PERFIS_VISITA = [
  { value: "familia", label: "Família" },
  { value: "proprio_idoso", label: "O próprio idoso" },
  { value: "casal", label: "Casal de idosos" },
] as const;

export const OPCOES_PROXIMO_PASSO = [
  "Almoço experiência",
  "Nova visita com os demais familiares",
  "Videochamada com a família",
  "Avaliação médica",
  "Estadia experimental",
  "Envio da proposta detalhada",
  "Eu te ligo para conversarmos",
] as const;

export function modalidadeInfo(m: ModalidadeSimulacao) {
  return MODALIDADES_SIMULACAO.find((x) => x.value === m) ?? MODALIDADES_SIMULACAO[0];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Fecha uma opção da simulação. Longa permanência e reabilitação usam o valor
 * da tabela com 15% de desconto; curta permanência e Day Use usam o valor
 * digitado, sem desconto.
 */
export function calcularOpcao(
  o: Omit<OpcaoSimulacao, "valor_final" | "desconto_pct">,
  valorDigitado: number | null,
): OpcaoSimulacao {
  const info = modalidadeInfo(o.modalidade);
  if (info.usaTabela) {
    const base = o.valor_tabela;
    return {
      ...o,
      unidade: "/mês",
      desconto_pct: info.descontoPct,
      valor_final: base == null ? null : r2(base * (1 - info.descontoPct / 100)),
    };
  }
  return { ...o, valor_tabela: null, desconto_pct: 0, valor_final: valorDigitado && valorDigitado > 0 ? r2(valorDigitado) : null };
}

/** Validade da simulação: 30 dias depois da visita (AAAA-MM-DD). */
export function validadeSimulacao(dataVisita: string): string {
  return somarDiasISO(dataVisita, VALIDADE_SIMULACAO_DIAS);
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");

/** Texto da simulação para o WhatsApp (vai dentro da M2). */
export function textoSimulacao(opcoes: OpcaoSimulacao[], validade: string | null): string {
  const validas = opcoes.filter((o) => o.valor_final != null);
  if (validas.length === 0) return "";
  const linhas = validas.map((o, i) => {
    const desc = [modalidadeInfo(o.modalidade).label, o.tipo_suite, o.ocupacao ? `ocupação ${o.ocupacao}` : null, o.grau ? `grau ${o.grau}` : null]
      .filter(Boolean).join(" · ");
    const valor = o.desconto_pct > 0 && o.valor_tabela != null
      ? `de ${moeda(o.valor_tabela)} por ${moeda(o.valor_final!)}${o.unidade} (${o.desconto_pct}% de desconto)`
      : `${moeda(o.valor_final!)}${o.unidade === "pacote" ? " (pacote)" : o.unidade}`;
    return `Opção ${i + 1}: ${desc}\n${valor}`;
  });
  const cab = `📋 Simulação${validade ? ` — válida até ${dataCurta(validade, true)}` : ""}`;
  return [cab, ...linhas, AVISO_SIMULACAO].join("\n\n");
}

// ─── Mensagens ───────────────────────────────────────────────────────────────

export interface DadosMensagem {
  visitante: string;             // nome de quem visitou (usa o primeiro nome)
  consultor: string;             // quem atendeu (usa o primeiro nome)
  residenteChamar: string | null; // "Dona Maria"
  nomeIdoso: string | null;
  tratamento: string | null;      // "sua mãe"
  detalhePessoal: string | null;
  oQueOuvimos: string | null;
  dores: string[];               // códigos, na ordem em que foram marcados
  objecoes: string[];
  proximosPassos: ProximoPasso[];
  perguntaConfirmacao: string | null;
  simulacao: OpcaoSimulacao[];
  simulacaoValidade: string | null;
  visitaEm: string;              // AAAA-MM-DD
  hoje: string;                  // AAAA-MM-DD
}

const primeiroNome = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/)[0] ?? "";

/** "20/11" (ou "20/11/2026" com ano). */
export function dataCurta(iso: string, comAno = false): string {
  const [a, m, d] = iso.slice(0, 10).split("-");
  return comAno ? `${d}/${m}/${a}` : `${d}/${m}`;
}

export function somarDiasISO(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** "hoje", "ontem" ou "no dia 20/11". */
export function diaVisitaTexto(visitaEm: string, hoje: string): string {
  if (visitaEm === hoje) return "hoje";
  if (somarDiasISO(visitaEm, 1) === hoje) return "ontem";
  return `no dia ${dataCurta(visitaEm)}`;
}

/** Troca as {variáveis} conhecidas; as que faltam ficam para o consultor completar. */
export function preencher(texto: string, vars: Record<string, string>): string {
  const out = texto.replace(/\{([a-z_0-9]+)\}/g, (m, k: string) => (k in vars ? vars[k] : m));
  return out.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** {campos} que ainda precisam ser completados à mão antes de enviar. */
export function camposPendentes(texto: string | null | undefined): string[] {
  return [...new Set([...(texto ?? "").matchAll(/\{([a-z_0-9]+)\}/g)].map((m) => m[1]))];
}

export function rotuloCampo(campo: string): string {
  const R: Record<string, string> = {
    situacao_parecida: "situação parecida", depoimento: "depoimento", data_evento: "data do evento",
    evento: "evento", conteudo_util: "conteúdo útil", link_google: "link de avaliação do Google",
    residente: "nome do residente", visitante: "nome de quem visitou",
  };
  return R[campo] ?? campo.replace(/_/g, " ");
}

export function variaveis(d: DadosMensagem, biblioteca: CrmBiblioteca[], modelos: CrmModeloMensagem[]): Record<string, string> {
  const porCodigo = new Map(biblioteca.filter((b) => b.ativo).map((b) => [b.codigo, b]));
  const residente = d.residenteChamar?.trim() || primeiroNome(d.nomeIdoso) || "seu familiar";
  const base = {
    visitante: primeiroNome(d.visitante),
    consultor: primeiroNome(d.consultor),
    residente,
    tratamento: d.tratamento?.trim() || residente,
  };
  const comVars = (t: string) => preencher(t, base);
  const dores = d.dores.map((c) => porCodigo.get(c)).filter((b): b is CrmBiblioteca => !!b && b.tipo === "dor");
  const objecao = d.objecoes.map((c) => porCodigo.get(c)).find((b) => !!b && b.tipo === "objecao");
  const detalhe = d.detalhePessoal?.trim();
  const passos = d.proximosPassos.filter((p) => p.passo.trim());
  const conteudos = dores
    .filter((b) => b.conteudo_link?.trim())
    .map((b) => `📌 ${b.conteudo_titulo?.trim() || b.titulo}: ${b.conteudo_link!.trim()}`);
  const optout = modelos.find((m) => m.codigo === "OPTOUT" && m.ativo)?.texto ?? "";
  return {
    ...base,
    dia_visita: diaVisitaTexto(d.visitaEm, d.hoje),
    detalhe_pessoal: detalhe ? (/^[,;]/.test(detalhe) ? detalhe : `, ${detalhe}`) : "",
    frase_o_que_ouvimos: (d.oQueOuvimos ?? "").trim().replace(/[.\s]+$/, ""),
    blocos_dores: dores.slice(0, MAX_DORES_NA_MENSAGEM).map((b) => comVars(b.texto_whatsapp)).join("\n\n"),
    bloco_objecao: objecao ? comVars(objecao.texto_whatsapp) : "",
    simulacao: textoSimulacao(d.simulacao, d.simulacaoValidade),
    conteudos_dores: conteudos.length ? `Separei também um conteúdo sobre o que conversamos:\n${conteudos.join("\n")}` : "",
    proximos_passos: passos.map((p) => `📅 ${p.passo.trim()}${p.data ? ` — ${dataCurta(p.data)}` : ""}`).join("\n"),
    pergunta_confirmacao: d.perguntaConfirmacao?.trim() || "Essas datas ficam boas para vocês?",
    opt_out: optout,
    ...(conteudos.length ? { conteudo_util: conteudos[0].replace(/^📌 /, "") } : {}),
  };
}

export interface TarefaGerada {
  tipo: string;
  assunto: string;
  modelo: string;
  mensagem: string;
  canal: "whatsapp" | "email" | "telefone";
  tentativa: number | null;
  data: string;
  hora: string | null;
}

/**
 * Sequência da primeira semana, ao salvar o pós-visita:
 *  · Contato 1 (D0): M1 agradecimento + M2 material, simulação e conteúdo das dores;
 *  · D+1: M3 avaliação no Google — só se o modelo estiver ligado e a visita foi positiva;
 *  · Contato 2 (D+3): M4 próximos passos (com o opt-out);
 *  · Contato 3 (D+7): M5 retomada.
 * Pós-visita registrado dias depois da visita: a semana conta a partir do
 * registro (os 3 contatos não podem cair todos no mesmo dia).
 */
export function gerarSequencia(
  d: DadosMensagem,
  biblioteca: CrmBiblioteca[],
  modelos: CrmModeloMensagem[],
  visitaPositiva: boolean,
): TarefaGerada[] {
  const vars = variaveis(d, biblioteca, modelos);
  const ativo = new Map(modelos.filter((m) => m.ativo).map((m) => [m.codigo, m]));
  const inicio = d.visitaEm < d.hoje ? d.hoje : d.visitaEm;
  const quando = (dias: number) => somarDiasISO(inicio, dias);
  const plano: { codigo: string; dias: number; tentativa: number | null; assunto: string }[] = [
    { codigo: "M1", dias: 0, tentativa: 1, assunto: "Contato 1 · Agradecimento" },
    { codigo: "M2", dias: 0, tentativa: 1, assunto: "Contato 1 · Material e simulação" },
    ...(visitaPositiva ? [{ codigo: "M3", dias: 1, tentativa: null, assunto: "Avaliação no Google" }] : []),
    { codigo: "M4", dias: 3, tentativa: 2, assunto: "Contato 2 · Próximos passos" },
    { codigo: "M5", dias: 7, tentativa: 3, assunto: "Contato 3 · Retomada" },
  ];
  return plano
    .filter((p) => ativo.has(p.codigo))
    .map((p) => ({
      tipo: "WhatsApp",
      assunto: p.assunto,
      modelo: p.codigo,
      mensagem: preencher(ativo.get(p.codigo)!.texto, vars),
      canal: "whatsapp" as const,
      tentativa: p.tentativa,
      data: quando(p.dias),
      hora: null,
    }));
}

/** Mensagem avulsa a partir de um modelo (M6 convite, M7 nutrição, aviso de contrato…). */
export function mensagemDeModelo(
  codigo: string,
  d: DadosMensagem,
  biblioteca: CrmBiblioteca[],
  modelos: CrmModeloMensagem[],
): string | null {
  const m = modelos.find((x) => x.codigo === codigo);
  return m ? preencher(m.texto, variaveis(d, biblioteca, modelos)) : null;
}

// ─── Regra dos 3 contatos ────────────────────────────────────────────────────

/**
 * Os 3 contatos da primeira semana foram feitos e a família não respondeu
 * depois do primeiro: hora de dar o lead como perdido ("Não respondeu mais").
 */
export function semRetornoApos3Contatos(
  tarefas: Pick<CrmTarefa, "tentativa" | "concluida" | "cancelada" | "concluida_em">[],
  ultimoRetornoEm: string | null,
): boolean {
  const feitos = tarefas.filter((t) => t.tentativa != null && t.concluida && !t.cancelada);
  const tentativas = new Set(feitos.map((t) => t.tentativa));
  if (!(tentativas.has(1) && tentativas.has(2) && tentativas.has(3))) return false;
  if (!ultimoRetornoEm) return true;
  const primeiro = feitos.filter((t) => t.tentativa === 1).map((t) => t.concluida_em ?? "").sort()[0] ?? "";
  return ultimoRetornoEm < primeiro;
}

/** Quantos dos 3 contatos da primeira semana já foram feitos. */
export function contatosFeitos(tarefas: Pick<CrmTarefa, "tentativa" | "concluida" | "cancelada">[]): number {
  return new Set(tarefas.filter((t) => t.tentativa != null && t.concluida && !t.cancelada).map((t) => t.tentativa)).size;
}

// ─── Dados da oportunidade → mensagem ────────────────────────────────────────

/** Monta os dados das mensagens a partir do que ficou gravado na oportunidade. */
export function dadosDaOportunidade(
  op: Pick<CrmOportunidade, "residente_chamar" | "residente_tratamento" | "detalhe_pessoal" | "o_que_ouvimos" | "dores" | "objecoes"
    | "proximos_passos" | "pergunta_confirmacao" | "simulacao" | "simulacao_validade" | "visita_em">,
  contato: Pick<CrmContato, "nome" | "nome_idoso"> | null,
  consultor: string,
  hoje: string,
): DadosMensagem {
  return {
    visitante: contato?.nome ?? "",
    consultor,
    residenteChamar: op.residente_chamar,
    nomeIdoso: contato?.nome_idoso ?? null,
    tratamento: op.residente_tratamento,
    detalhePessoal: op.detalhe_pessoal,
    oQueOuvimos: op.o_que_ouvimos,
    dores: op.dores ?? [],
    objecoes: op.objecoes ?? [],
    proximosPassos: op.proximos_passos ?? [],
    perguntaConfirmacao: op.pergunta_confirmacao,
    simulacao: op.simulacao?.opcoes ?? [],
    simulacaoValidade: op.simulacao_validade,
    visitaEm: (op.visita_em ?? hoje).slice(0, 10),
    hoje,
  };
}
