import type { GrauDependencia, Ocupacao, TipoSuite } from "@/types/database";

export const TIPOS_SUITE: TipoSuite[] = ["Suíte Modular", "Suíte", "Long Stay", "Apartamento"];

export const GRAUS: GrauDependencia[] = ["I", "II", "III"];

export const OCUPACOES: { value: Ocupacao; label: string }[] = [
  { value: "individual", label: "Individual" },
  { value: "dupla", label: "Dupla" },
];

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

/** Chave para consultar a tabela de preços por tipo de suíte + grau. */
export function chavePreco(tipoSuite: string | null, grau: string | null): string {
  return `${tipoSuite ?? ""}|${grau ?? ""}`;
}
