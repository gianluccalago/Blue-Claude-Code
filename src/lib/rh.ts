import type { MotivoDesligamento, TipoAusencia } from "@/types/database";

// ===========================================================================
// RH — rótulos e cálculos de apoio para a CAPTURA de eventos de pessoal.
// Estes registros alimentam os painéis de RH (turnover, absenteísmo, cobertura)
// no próximo bloco.
// ===========================================================================

export const TIPOS_AUSENCIA: { value: TipoAusencia; label: string }[] = [
  { value: "atestado", label: "Atestado" },
  { value: "falta_sem_atestado", label: "Falta sem atestado" },
  { value: "ferias", label: "Férias" },
  { value: "licenca_maternidade", label: "Licença-maternidade" },
  { value: "licenca_inss", label: "Licença INSS" },
  { value: "evento", label: "Evento" },
  { value: "outro", label: "Outro" },
];
export const TIPO_AUSENCIA_LABEL: Record<TipoAusencia, string> = Object.fromEntries(
  TIPOS_AUSENCIA.map((t) => [t.value, t.label]),
) as Record<TipoAusencia, string>;

export const MOTIVOS_DESLIGAMENTO: { value: MotivoDesligamento; label: string }[] = [
  { value: "pedido_demissao_voluntario", label: "Pedido de demissão (voluntário)" },
  { value: "sem_justa_causa", label: "Demissão sem justa causa" },
  { value: "com_justa_causa", label: "Demissão com justa causa" },
  { value: "fim_experiencia", label: "Fim do período de experiência" },
  { value: "fim_contrato", label: "Fim de contrato" },
  { value: "outro", label: "Outro" },
];
export const MOTIVO_DESLIGAMENTO_LABEL: Record<MotivoDesligamento, string> = Object.fromEntries(
  MOTIVOS_DESLIGAMENTO.map((m) => [m.value, m.label]),
) as Record<MotivoDesligamento, string>;

// SENSÍVEL (saúde): registra-se SÓ o GRUPO/letra do CID, nunca o diagnóstico.
export const GRUPOS_CID: string[] = [
  "A/B - Doenças infecciosas e parasitárias",
  "C/D - Neoplasias / doenças do sangue",
  "E - Endócrinas, nutricionais e metabólicas",
  "F - Transtornos mentais e comportamentais",
  "G - Doenças do sistema nervoso",
  "H - Olhos e ouvidos",
  "I - Aparelho circulatório",
  "J - Aparelho respiratório",
  "K - Aparelho digestivo",
  "L - Pele e subcutâneo",
  "M - Doenças do sistema osteomuscular",
  "N - Aparelho geniturinário",
  "O - Gravidez, parto e puerpério",
  "R - Sintomas e sinais (mal definidos)",
  "S/T - Lesões e traumatismos",
  "Z - Fatores que influenciam a saúde",
  "Outro / não informado",
];

/** Nº de dias entre duas datas (inclusivo). 1 se inválido/igual. */
export function diasEntre(inicio: string | null, fim: string | null): number {
  if (!inicio || !fim) return 1;
  const a = new Date(`${inicio}T00:00:00`);
  const b = new Date(`${fim}T00:00:00`);
  const d = Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1;
  return d > 0 ? d : 1;
}

/** Tempo de casa em MESES (admissão → desligamento). null se faltar dado. */
export function tempoCasaMeses(admissao: string | null | undefined, saida: string | null): number | null {
  if (!admissao || !saida) return null;
  const a = new Date(`${admissao}T00:00:00`);
  const b = new Date(`${saida}T00:00:00`);
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return null;
  let meses = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) meses -= 1;
  return Math.max(0, meses);
}

/** "X anos e Y meses" a partir de meses. */
export function formatarTempoCasa(meses: number | null): string {
  if (meses == null) return "Não informado";
  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  const partes: string[] = [];
  if (anos > 0) partes.push(`${anos} ano${anos > 1 ? "s" : ""}`);
  if (m > 0) partes.push(`${m} ${m > 1 ? "meses" : "mês"}`);
  if (partes.length === 0) return "menos de 1 mês";
  return partes.join(" e ");
}
