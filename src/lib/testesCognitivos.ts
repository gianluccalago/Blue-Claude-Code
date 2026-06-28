// ===========================================================================
// TESTES COGNITIVOS — MEEM e MoCA (AVALIATIVOS). Estrutura dos itens/seções,
// TETOS e CÁLCULO DE PONTUAÇÃO. NÃO alteram o grau de dependência.
//
// DIREITOS AUTORAIS / VALIDAÇÃO: o app NÃO reproduz os estímulos protegidos
// (figuras, trail making, palavras-alvo, desenhos a copiar, etc.) nem versões
// "parecidas". O médico aplica o teste no MATERIAL OFICIAL (papel) e registra
// aqui SOMENTE a pontuação por item/seção. Reproduzir/substituir estímulos
// quebraria direitos autorais ou a validação do instrumento.
//
// CÁLCULO (validado): cada campo é limitado ao seu TETO; o total é a soma dos
// itens/seções pontuados. MEEM = máx 30. MoCA = máx 30, com +1 de ajuste de
// escolaridade (≤12 anos) que NUNCA ultrapassa 30.
// ===========================================================================

export type TipoTeste = "MEEM" | "MoCA";

export interface ItemTeste {
  key: string;
  label: string;
  max: number;
  /** true = não entra na soma (apenas registro, ex.: nº de tentativas). */
  semPontuacao?: boolean;
}

// ─── MEEM (total 30) ──────────────────────────────────────────────────────────
// Soma dos tetos: 5+5+3+5+3 + 2+1+3+1+1+1 = 30.
export const MEEM_ITENS: ItemTeste[] = [
  { key: "orientacao_temporal", label: "Orientação temporal", max: 5 },
  { key: "orientacao_espacial", label: "Orientação espacial", max: 5 },
  { key: "registro", label: "Registro (3 palavras)", max: 3 },
  { key: "registro_tentativas", label: "Registro — nº de tentativas", max: 99, semPontuacao: true },
  { key: "atencao_calculo", label: "Atenção e cálculo (100−7 ou dígitos)", max: 5 },
  { key: "evocacao", label: "Evocação (3 palavras)", max: 3 },
  { key: "ling_nomear", label: "Linguagem — nomear (lápis e relógio)", max: 2 },
  { key: "ling_repetir", label: 'Linguagem — repetir ("Nem aqui, nem ali, nem lá")', max: 1 },
  { key: "ling_comando", label: "Linguagem — comando de 3 estágios", max: 3 },
  { key: "ling_ler_executar", label: 'Linguagem — ler e executar ("FECHE OS OLHOS")', max: 1 },
  { key: "ling_escrever", label: "Linguagem — escrever uma frase", max: 1 },
  { key: "ling_copiar", label: "Linguagem — copiar desenho (papel)", max: 1 },
];

// ─── MoCA (total 30) ──────────────────────────────────────────────────────────
// Soma dos tetos: 5+3+6+3+2+5+6 = 30. Memória/registro não pontua.
export const MOCA_ITENS: ItemTeste[] = [
  { key: "visuoespacial_executiva", label: "Visuoespacial / Executiva", max: 5 },
  { key: "nomeacao", label: "Nomeação", max: 3 },
  { key: "memoria_tentativas", label: "Memória / Registro — nº de tentativas", max: 99, semPontuacao: true },
  { key: "atencao", label: "Atenção", max: 6 },
  { key: "linguagem", label: "Linguagem", max: 3 },
  { key: "abstracao", label: "Abstração", max: 2 },
  { key: "evocacao_tardia", label: "Evocação tardia", max: 5 },
  { key: "orientacao", label: "Orientação", max: 6 },
];

export function itensDoTeste(tipo: TipoTeste): ItemTeste[] {
  return tipo === "MEEM" ? MEEM_ITENS : MOCA_ITENS;
}

export const TOTAL_MAX = 30;

/** Limita um valor ao intervalo [0, max] (e a inteiro). */
export function limitar(valor: number, max: number): number {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(0, Math.min(max, Math.round(valor)));
}

/** Soma dos itens PONTUADOS, cada um limitado ao seu teto. */
export function somarPontuados(itens: ItemTeste[], respostas: Record<string, number>): number {
  return itens.reduce((acc, it) => (it.semPontuacao ? acc : acc + limitar(respostas[it.key] ?? 0, it.max)), 0);
}

export interface ResultadoMoca {
  bruto: number; // soma das seções (0–30)
  ajusteEscolaridade: number; // +1 ou 0
  total: number; // bruto + ajuste, limitado a 30
}

/**
 * MoCA: total = soma das seções (≤30) + ajuste de escolaridade.
 * Ajuste = +1 SE escolaridade ≤ 12 anos, MAS o total nunca passa de 30.
 * Escolaridade nula = sem ajuste (não dá para aplicar a regra).
 */
export function calcularMoca(respostas: Record<string, number>, escolaridadeAnos: number | null): ResultadoMoca {
  const bruto = somarPontuados(MOCA_ITENS, respostas);
  const aplica = escolaridadeAnos !== null && Number.isFinite(escolaridadeAnos) && escolaridadeAnos <= 12;
  const total = aplica ? Math.min(bruto + 1, TOTAL_MAX) : bruto;
  return { bruto, ajusteEscolaridade: total - bruto, total };
}

/** MEEM: total = soma dos itens limitados (máx 30). */
export function calcularMeem(respostas: Record<string, number>): number {
  return somarPontuados(MEEM_ITENS, respostas);
}

/** Pontuação total conforme o tipo (com ajuste no MoCA). */
export function pontuacaoTotal(tipo: TipoTeste, respostas: Record<string, number>, escolaridadeAnos: number | null): number {
  return tipo === "MEEM" ? calcularMeem(respostas) : calcularMoca(respostas, escolaridadeAnos).total;
}

export const AVISO_INTERPRETACAO =
  "Instrumento de TRIAGEM. O ponto de corte varia com a escolaridade — não há classificação automática (normal/alterado). Interprete no contexto clínico.";
