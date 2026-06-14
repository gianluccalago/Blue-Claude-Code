import type { RespondenteNps } from "@/types/database";

// ===========================================================================
// NPS (Net Promoter Score) — dimensões, classificação e cálculo. Padrão NPS:
// promotor 9-10, neutro 7-8, detrator 0-6. NPS = %promotores − %detratores
// (escala -100 a +100). A `dimensao` é gravada por CHAVE estável (o rótulo
// pode mudar sem migrar dados).
// ===========================================================================

export type DimensaoNps =
  | "geral"
  | "limpeza_suites"
  | "limpeza_areas_comuns"
  | "atendimento_equipe"
  | "comida"
  | "atividades_fisicas"
  | "atividades_lazer"
  | "lavanderia";

export const DIMENSOES_NPS: { key: DimensaoNps; label: string }[] = [
  { key: "geral", label: "Satisfação geral com a casa" },
  { key: "limpeza_suites", label: "Limpeza das suítes" },
  { key: "limpeza_areas_comuns", label: "Limpeza das áreas comuns" },
  { key: "atendimento_equipe", label: "Atendimento da equipe assistencial" },
  { key: "comida", label: "Qualidade da comida" },
  { key: "atividades_fisicas", label: "Atividades físicas" },
  { key: "atividades_lazer", label: "Atividades de entretenimento/lazer" },
  { key: "lavanderia", label: "Lavanderia" },
];

export const DIMENSAO_LABEL: Record<string, string> = Object.fromEntries(
  DIMENSOES_NPS.map((d) => [d.key, d.label]),
);

export const RESPONDENTES_NPS: { value: RespondenteNps; label: string }[] = [
  { value: "familiar", label: "Familiar" },
  { value: "idoso", label: "Idoso(a)" },
];

export const RESPONDENTE_LABEL: Record<string, string> = {
  familiar: "Familiar",
  idoso: "Idoso(a)",
};

export type ClasseNps = "promotor" | "neutro" | "detrator";

/** Classe NPS da nota: 0-6 detrator, 7-8 neutro, 9-10 promotor. */
export function classeNps(nota: number): ClasseNps {
  if (nota >= 9) return "promotor";
  if (nota >= 7) return "neutro";
  return "detrator";
}

/** Pergunta condicional conforme a nota (sempre solicitada, nunca obrigatória). */
export function perguntaCondicional(nota: number): string {
  const c = classeNps(nota);
  if (c === "detrator") return "O que motivou essa nota?";
  if (c === "neutro") return "O que poderíamos fazer para chegar a 9 ou 10?";
  return "O que mais agradou?";
}

export interface ResumoNps {
  total: number;
  promotores: number;
  neutros: number;
  detratores: number;
  /** NPS no padrão -100..+100, ou null se não há respostas. */
  nps: number | null;
  /** Nota média (0-10), ou null se não há respostas. */
  media: number | null;
}

/** Calcula o resumo NPS a partir de uma lista de notas (0-10). */
export function resumoNps(notas: number[]): ResumoNps {
  const total = notas.length;
  if (total === 0) {
    return { total: 0, promotores: 0, neutros: 0, detratores: 0, nps: null, media: null };
  }
  let promotores = 0;
  let neutros = 0;
  let detratores = 0;
  let soma = 0;
  for (const n of notas) {
    soma += n;
    const c = classeNps(n);
    if (c === "promotor") promotores++;
    else if (c === "neutro") neutros++;
    else detratores++;
  }
  const nps = Math.round(((promotores - detratores) / total) * 100);
  const media = Math.round((soma / total) * 10) / 10;
  return { total, promotores, neutros, detratores, nps, media };
}

/** NPS "baixo" (atenção). Limiar conservador para destacar dimensões frágeis. */
export function npsBaixo(nps: number | null): boolean {
  return nps !== null && nps < 0;
}

/** Cor semântica de uma nota individual (escala de aplicação). */
export function tomNota(nota: number): "destructive" | "warning" | "success" {
  const c = classeNps(nota);
  return c === "detrator" ? "destructive" : c === "neutro" ? "warning" : "success";
}
