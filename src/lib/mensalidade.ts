import { hojeISO as hojeISOsp } from "@/lib/utils";
import type { GrauDependencia, GrauPreco, Ocupacao, TipoSuite } from "@/types/database";

export const TIPOS_SUITE: TipoSuite[] = ["Suíte Luxo", "Suíte Premium", "Long Stay", "Apartamento"];

export const GRAUS: GrauDependencia[] = ["I", "II", "III"];

/** Faixas da tabela de preços (nov/2026): graus I–III, Memory Care e Reabilitação. */
export const GRAUS_PRECO: GrauPreco[] = ["I", "II", "III", "MC", "REAB"];
export const GRAU_PRECO_LABEL: Record<GrauPreco, string> = {
  I: "Grau I", II: "Grau II", III: "Grau III", MC: "Memory Care", REAB: "Reabilitação",
};

/** Desconto máximo da tabela (o "com desconto máximo" da planilha de preços). */
export const DESCONTO_MAXIMO_PCT = 15;

export const OCUPACOES: { value: Ocupacao; label: string }[] = [
  { value: "simples", label: "Simples" },
  { value: "duplo", label: "Duplo" },
  { value: "triplo", label: "Triplo" },
];

export const OCUPACAO_LABEL: Record<Ocupacao, string> = {
  simples: "Simples",
  duplo: "Duplo",
  triplo: "Triplo",
};

/**
 * Ocupações VÁLIDAS por tipo de suíte. Long Stay permite triplo (o "Long Stay
 * Cuidados Intensivos" da tabela); os demais (Suíte Luxo, Suíte Premium,
 * Apartamento) vão até duplo. Tipo nulo → padrão (até duplo).
 */
export function ocupacoesValidas(tipoSuite: TipoSuite | null): Ocupacao[] {
  if (tipoSuite === "Long Stay") return ["simples", "duplo", "triplo"];
  return ["simples", "duplo"];
}

/** O triplo do Long Stay é o "Long Stay Cuidados Intensivos" da tabela e do contrato. */
export function ehCuidadosIntensivos(tipoSuite: string | null | undefined, ocupacao: string | null | undefined): boolean {
  return tipoSuite === "Long Stay" && ocupacao === "triplo";
}

/** Rótulo da ocupação no contexto do tipo ("Triplo · Cuidados Intensivos" no Long Stay). */
export function rotuloOcupacao(tipoSuite: string | null | undefined, ocupacao: Ocupacao): string {
  return ehCuidadosIntensivos(tipoSuite, ocupacao) ? "Triplo · Cuidados Intensivos" : OCUPACAO_LABEL[ocupacao];
}

/** Nome da acomodação como a família lê ("Long Stay Cuidados Intensivos" no triplo). */
export function nomeAcomodacao(tipoSuite: string | null | undefined, ocupacao: string | null | undefined): string | null {
  if (!tipoSuite) return null;
  if (ehCuidadosIntensivos(tipoSuite, ocupacao)) return "Long Stay Cuidados Intensivos";
  return tipoSuite === "Suíte" ? "Suíte Luxo" : tipoSuite; // "Suíte" = nome antigo (antes da 0156)
}

/** Ocupação efetiva p/ buscar preço/sugestão (padrão "simples" quando vazia). */
export function ocupacaoOuPadrao(ocupacao: Ocupacao | null | undefined): Ocupacao {
  return ocupacao ?? "simples";
}

/** Formata um valor numérico como moeda BRL, ou "Não informado" se nulo/NaN. */
export function formatarMoeda(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "Não informado";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mês de referência atual no formato "YYYY-MM". */
export function mesAtual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Desloca um mês de referência "YYYY-MM" por `delta` meses. */
export function deslocarMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Formata "YYYY-MM" como "Mês/AAAA", ex: "Junho/2026". */
export function formatarMesReferencia(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1).replace(" de ", "/");
}

/** Primeiro e último dia do mês "YYYY-MM" no formato YYYY-MM-DD. */
export function intervaloDoMes(mes: string): { inicio: string; fim: string } {
  const [y, m] = mes.split("-").map(Number);
  const inicio = `${mes}-01`;
  const ultimoDia = new Date(y, m, 0).getDate();
  const fim = `${mes}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fim };
}

/** Chave da tabela de preços por tipo de suíte × grau × ocupação. */
export function chavePreco(
  tipoSuite: string | null,
  grau: string | null,
  ocupacao: string | null,
): string {
  return `${tipoSuite ?? ""}|${grau ?? ""}|${ocupacao ?? "simples"}`;
}

/** Data de hoje em "YYYY-MM-DD" no fuso da casa (delega ao utils, pinado em SP). */
export function hojeISO(): string {
  return hojeISOsp();
}

/** Uma vigência de preço (linha da tabela_preco). */
export interface PrecoVigencia {
  tipo_suite: string | null;
  grau: string | null;
  ocupacao: string | null;
  valor: number;
  vigente_a_partir_de: string; // YYYY-MM-DD
}

/**
 * Preço VIGENTE de uma combinação (tipo × grau × ocupação) numa data: a vigência
 * de MAIOR `vigente_a_partir_de` ≤ `dataRef`. Vigências futuras (data > dataRef)
 * são ignoradas. Retorna `null` se a combinação não tem nenhuma vigência ≤ data.
 *
 * Regra de negócio: a mensalidade sugerida de um hóspede usa o preço vigente na
 * data de ENTRADA dele — assim um reajuste de preço NÃO mexe retroativamente em
 * quem já entrou (afeta só novos contratos). Residentes atuais mantêm o
 * `mensalidade_valor` manual; este preço é só o fallback/sugestão.
 */
export function precoVigenteEm(
  precos: readonly PrecoVigencia[],
  tipoSuite: string | null,
  grau: string | null,
  ocupacao: string | null,
  dataRef: string,
): number | null {
  const alvo = chavePreco(tipoSuite, grau, ocupacao);
  let melhor: PrecoVigencia | null = null;
  for (const p of precos) {
    if (p.vigente_a_partir_de > dataRef) continue; // vigência ainda não começou
    if (chavePreco(p.tipo_suite, p.grau, p.ocupacao) !== alvo) continue;
    if (!melhor || p.vigente_a_partir_de > melhor.vigente_a_partir_de) melhor = p;
  }
  return melhor ? melhor.valor : null;
}
