import type { GrauDependencia, Ocupacao, TipoSuite } from "@/types/database";

export const TIPOS_SUITE: TipoSuite[] = ["Suíte", "Suíte Premium", "Long Stay", "Apartamento"];

export const GRAUS: GrauDependencia[] = ["I", "II", "III"];

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
 * Ocupações VÁLIDAS por tipo de suíte. Long Stay permite triplo; os demais
 * (Suíte, Suíte Premium, Apartamento) vão até duplo. Tipo nulo → padrão (até
 * duplo). Total de combinações tipo×grau×ocupação = 27.
 */
export function ocupacoesValidas(tipoSuite: TipoSuite | null): Ocupacao[] {
  return tipoSuite === "Long Stay"
    ? ["simples", "duplo", "triplo"]
    : ["simples", "duplo"];
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
