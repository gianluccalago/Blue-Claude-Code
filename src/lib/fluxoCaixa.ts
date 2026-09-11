// ===========================================================================
// FLUXO DE CAIXA — regras de cálculo (visão do diretor: SEMPRE caixa).
// FONTE ÚNICA: a planilha mensal do sócio-diretor, dentro do app. Cada
// lançamento tem GRUPO (entrada/saída) e VALOR COM SINAL — a convenção que
// ele lê há 43 meses (dividendo pago é negativo dentro das entradas).
// Saldo do mês = saldo inicial + Σ entradas + Σ saídas.
// Correção IPCA (herdada da CustoBlue) só sobre o CUSTO DO EMPREENDIMENTO:
//   corrigido(mês) = (corrigido anterior + desembolso do mês) × (1 + IPCA)
// ===========================================================================

export type GrupoFC = "entrada" | "saida";

/** Centros de custo canônicos (o campo aceita valores livres além destes). */
export const CENTROS_CUSTO = [
  // Empreendimento (o que a CustoBlue acompanhava)
  { value: "terreno", label: "Terreno", grupo: "saida" },
  { value: "projetos", label: "Projetos (arquitetura)", grupo: "saida" },
  { value: "complementares", label: "Projetos complementares", grupo: "saida" },
  { value: "construtora", label: "Construtora (mão de obra)", grupo: "saida" },
  { value: "materiais", label: "Materiais de construção", grupo: "saida" },
  { value: "indiretos", label: "Indiretos (gerais e subcontratos)", grupo: "saida" },
  // Empresa (o restante da planilha do sócio-diretor)
  { value: "impostos", label: "Impostos da empresa", grupo: "saida" },
  { value: "administrativo", label: "Administrativo e jurídico", grupo: "saida" },
  { value: "seniors_club", label: "Seniors Club (outro imóvel)", grupo: "saida" },
  // Entradas e movimentações societárias
  { value: "receita_aluguel", label: "Receita de aluguel", grupo: "entrada" },
  { value: "receita_financeira", label: "Rendimentos financeiros", grupo: "entrada" },
  { value: "socios", label: "Sócios (aportes, empréstimos, dividendos)", grupo: "entrada" },
] as const;

export type CentroCusto = (typeof CENTROS_CUSTO)[number]["value"];

/** Centros que compõem o CUSTO DO EMPREENDIMENTO (base da correção IPCA). */
export const CENTROS_EMPREENDIMENTO: ReadonlySet<string> = new Set([
  "terreno", "projetos", "complementares", "construtora", "materiais", "indiretos",
]);

export function ehEmpreendimento(centro: string): boolean {
  return CENTROS_EMPREENDIMENTO.has(centro);
}

export const PAGADORES = [
  { value: "seniors", label: "Seniors Care" },
  { value: "pht", label: "PHT" },
  { value: "ernesto", label: "Ernesto" },
] as const;

export function rotuloCentro(slug: string): string {
  return CENTROS_CUSTO.find((c) => c.value === slug)?.label ?? slug;
}
export function rotuloPagador(slug: string): string {
  return PAGADORES.find((p) => p.value === slug)?.label ?? slug;
}
export function rotuloGrupo(g: GrupoFC): string {
  return g === "entrada" ? "Entradas e mov. societárias" : "Saídas";
}

/**
 * Aplica a convenção de sinal da planilha ao valor digitado:
 * saída é SEMPRE negativa; entrada fica como digitada (dividendo pago se
 * digita com o sinal de menos, como o sócio-diretor faz).
 */
export function valorComSinal(grupo: GrupoFC, digitado: number): number {
  return grupo === "saida" ? -Math.abs(digitado) : digitado;
}

// ───────────────────────────────────────────────────────────────────────────
// Classificação por centro de custo a partir do RÓTULO da planilha.
// Espelho exato de public.fc_centro_do_rotulo (migration 0131) — o teste
// confere os dois lado a lado sobre todos os rótulos reais.
// ───────────────────────────────────────────────────────────────────────────

export function centroDoRotulo(rotulo: string, grupo: GrupoFC): string {
  const r = (rotulo ?? "").trim().toLowerCase();
  if (grupo === "entrada") {
    if (/^aluguel/.test(r)) return "receita_aluguel";
    if (/^rendimento/.test(r)) return "receita_financeira";
    return "socios";
  }
  if (
    /^parcela.*terreno/.test(r) || /^terreno/.test(r) || /terreno .* entrada/.test(r) ||
    /^entrada terreno/.test(r) || /^itbi/.test(r) || /^iptu/.test(r) || /^funrejus/.test(r) ||
    /cart.rio/.test(r) || /^taxas judiciais/.test(r) || /^taxas cart/.test(r) ||
    /^edvaldo/.test(r) || /^advogado edvaldo/.test(r) || /rvore/.test(r) || /arvore/.test(r) ||
    /^jardineiro/.test(r) || /^aluguel motoserra/.test(r) || /^gasolina corte/.test(r) ||
    /^combustivel cortar grama/.test(r) || /^taxa corte/.test(r) ||
    ["copel", "sanepar", "agua", "água"].includes(r) ||
    /^humberto/.test(r)
  ) return "terreno";
  if (
    /^arquitet/.test(r) || /^bacoccini/.test(r) || /^rrts/.test(r) || /^top.grafo/.test(r) ||
    /^topografo/.test(r) || /^c.lculo/.test(r) || /^calculo/.test(r) || /^laudo/.test(r) ||
    /^taxas alvar/.test(r) || /^taxa cvco/.test(r) || /^taxas processo habite/.test(r)
  ) return "projetos";
  if (/^triade/.test(r) || /^tríade/.test(r)) return "complementares";
  if (
    /^obras no seniors/.test(r) || /^sonar/.test(r) || /mangona/.test(r) || /^motor/.test(r) ||
    /^baterias/.test(r) || /^carregador/.test(r) || /^port.o/.test(r) || /^guarda corpo/.test(r) ||
    /^coletes/.test(r) || /^despesas com haste/.test(r) || /^gustavo sag/.test(r) ||
    /^taxas processo concrecenter/.test(r) || /^iss obra/.test(r) || /^servi.o motor/.test(r) ||
    /^lincoln/.test(r)
  ) return "seniors_club";
  if (/^despesas obra pagas por/.test(r)) return "indiretos";
  if (/^emprestimo/.test(r) || /^empr.stimo/.test(r)) return "socios";
  if (/^marlon/.test(r) || /^cabelo/.test(r) || /^uber/.test(r) || /^copiadora/.test(r) || /^combustivel/.test(r) || /^gasolina/.test(r)) return "indiretos";
  if (["pis", "cofins", "irpj", "csll"].includes(r) || /^ir retido/.test(r) || /^ir s\.nf/.test(r) || /^tributos federais/.test(r)) return "impostos";
  if (
    /^contabilidade/.test(r) || /^tarifas banc/.test(r) || /^certificado /.test(r) || /^certificado eletr/.test(r) ||
    /^taxa.*junta comercial/.test(r) || /^taxas junta/.test(r) || /^escrilex/.test(r) || /^advogado/.test(r) ||
    /giuliano/.test(r) || /^a..o trabalhista/.test(r) || /^acordo andrea/.test(r) || /^taxa de envio/.test(r)
  ) return "administrativo";
  return "indiretos";
}

/** Dia plausível dentro do mês para lançamentos vindos do extrato mensal. */
export function diaDoCentro(centro: string): number {
  switch (centro) {
    case "receita_aluguel": return 5;
    case "receita_financeira": return 28;
    case "socios": return 25;
    case "projetos": return 5;
    case "impostos": return 20;
    case "administrativo": return 15;
    case "seniors_club": return 12;
    default: return 10;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Séries mensais
// ───────────────────────────────────────────────────────────────────────────

export interface LancamentoBase {
  data: string;          // YYYY-MM-DD
  valor: number;         // COM SINAL
  grupo: GrupoFC;
  centro_custo: string;
}

export interface LinhaCaixaMes {
  mes: string;
  entradas: number;      // líquido do bloco de entradas (pode ser negativo)
  saidas: number;        // negativo
  resultado: number;     // entradas + saidas
  saldoInicial: number;  // declarado, ou carregado do mês anterior
  saldoFinal: number;
}

/**
 * Caixa mês a mês: entradas, saídas e saldo, na lógica da planilha do
 * sócio-diretor. `saldosDeclarados` (mês → saldo inicial) prevalece quando
 * existe; sem ele, o saldo inicial é o final do mês anterior.
 */
export function serieCaixaMensal(
  lancamentos: LancamentoBase[],
  saldosDeclarados: Map<string, number>,
): LinhaCaixaMes[] {
  const porMes = new Map<string, { entradas: number; saidas: number }>();
  for (const l of lancamentos) {
    const mes = l.data.slice(0, 7);
    const acc = porMes.get(mes) ?? { entradas: 0, saidas: 0 };
    if (l.grupo === "entrada") acc.entradas += l.valor; else acc.saidas += l.valor;
    porMes.set(mes, acc);
  }
  const meses = [...new Set([...porMes.keys(), ...saldosDeclarados.keys()])].sort();
  const out: LinhaCaixaMes[] = [];
  let carregado: number | null = null;
  for (const mes of meses) {
    const { entradas, saidas } = porMes.get(mes) ?? { entradas: 0, saidas: 0 };
    const saldoInicial: number = saldosDeclarados.get(mes) ?? carregado ?? 0;
    const resultado = entradas + saidas;
    const saldoFinal = saldoInicial + resultado;
    out.push({ mes, entradas, saidas, resultado, saldoInicial, saldoFinal });
    carregado = saldoFinal;
  }
  return out;
}

export interface LinhaMesFC {
  mes: string;       // YYYY-MM
  total: number;     // desembolso do mês (positivo)
  acumulado: number; // nominal
  corrigido: number; // acumulado corrigido pelo IPCA
}

/**
 * Custo do empreendimento corrigido (fórmula da CustoBlue). Recebe pares
 * {data, valor}; o valor pode vir COM SINAL (saída negativa) — a série
 * trabalha em módulo, porque desembolso é sempre positivo aqui.
 * Meses sem IPCA cadastrado corrigem por 0 (ficam nominais naquele mês).
 */
export function serieMensalFC(
  lancamentos: { data: string; valor: number }[],
  ipca: Map<string, number>,
): LinhaMesFC[] {
  const porMes = new Map<string, number>();
  for (const l of lancamentos) {
    const mes = l.data.slice(0, 7);
    porMes.set(mes, (porMes.get(mes) ?? 0) + Math.abs(l.valor));
  }
  const meses = [...porMes.keys()].sort();
  const out: LinhaMesFC[] = [];
  let acumulado = 0;
  let corrigido = 0;
  for (const mes of meses) {
    const total = porMes.get(mes)!;
    acumulado += total;
    corrigido = (corrigido + total) * (1 + (ipca.get(mes) ?? 0));
    out.push({ mes, total, acumulado, corrigido });
  }
  return out;
}

/** Só as saídas do empreendimento — a base histórica da correção IPCA. */
export function apenasEmpreendimento<T extends { grupo: GrupoFC; centro_custo: string }>(ls: T[]): T[] {
  return ls.filter((l) => l.grupo === "saida" && ehEmpreendimento(l.centro_custo));
}

// ───────────────────────────────────────────────────────────────────────────
// Percentual digitado pelo usuário — INFLAÇÃO OU DEFLAÇÃO.
// O IPCA mensal pode ser negativo (agosto/2026 fechou em −0,32%). O campo
// precisa aceitar o sinal em todas as formas que aparecem na prática: hífen
// comum, o "menos" tipográfico (U+2212) que vem colado do site do IBGE, o
// sinal depois do número, e vírgula ou ponto como separador decimal.
// ───────────────────────────────────────────────────────────────────────────

export type PercentualLido =
  | { ok: true; pct: number; fracao: number }
  | { ok: false; erro: string };

/**
 * Lê um percentual digitado e devolve o valor em % e em fração.
 * `maximoAbsoluto` protege contra o erro clássico de digitar 32 no lugar de
 * 0,32 — que multiplicaria o acumulado por 1,32 e estragaria a série inteira.
 */
export function lerPercentual(texto: string, maximoAbsoluto = 10): PercentualLido {
  const bruto = (texto ?? "").trim();
  if (bruto === "") return { ok: false, erro: "Informe o índice do mês." };

  // Normaliza: menos tipográfico/travessão viram hífen; vírgula vira ponto;
  // sinal ao final ("0,32-") passa para a frente; remove espaços e "%".
  let t = bruto
    .replace(/[−‒–—]/g, "-")
    .replace(/%/g, "")
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  if (/-$/.test(t)) t = "-" + t.slice(0, -1);
  t = t.replace(/^\+/, "");

  if (!/^-?\d*\.?\d+$/.test(t)) {
    return { ok: false, erro: 'Use apenas números, com vírgula decimal. Para deflação, comece com o sinal de menos (ex.: -0,32).' };
  }
  const pct = parseFloat(t);
  if (!Number.isFinite(pct)) return { ok: false, erro: "Índice inválido." };
  if (Math.abs(pct) > maximoAbsoluto) {
    return {
      ok: false,
      erro: `Índice fora do esperado (${pct.toString().replace(".", ",")}%). ` +
        `O limite aceito é ${maximoAbsoluto}% para mais ou para menos — confira se não faltou a vírgula.`,
    };
  }
  return { ok: true, pct, fracao: pct / 100 };
}

/** Formata uma fração (0.0084 / -0.0032) como percentual com sinal explícito. */
export function formatarPercentual(fracao: number): string {
  const pct = fracao * 100;
  const sinal = pct > 0 ? "+" : "";
  return `${sinal}${pct.toFixed(2).replace(".", ",")}%`;
}

/** Rótulo do efeito do índice no acumulado corrigido. */
export function efeitoIndice(fracao: number): "inflacao" | "deflacao" | "neutro" {
  if (fracao > 0) return "inflacao";
  if (fracao < 0) return "deflacao";
  return "neutro";
}

/** Lê um valor em reais digitado ("1.234,56" ou "1234.56" ou "-500"). */
export function lerReais(texto: string): number {
  const t = (texto ?? "").trim().replace(/[−–—]/g, "-").replace(/R\$\s?/i, "").replace(/\s/g, "");
  if (t === "") return 0;
  // "1.234,56" → 1234.56 · "1234.56" → 1234.56 · "1234,5" → 1234.5
  const temVirgula = t.includes(",");
  const norm = temVirgula ? t.replace(/\./g, "").replace(",", ".") : t;
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : 0;
}

/** Formata 'YYYY-MM' como 'mmm/aa' (jan/26). */
export function mesCurto(mes: string): string {
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const [ano, m] = mes.split("-");
  return `${nomes[parseInt(m, 10) - 1] ?? m}/${ano.slice(2)}`;
}
