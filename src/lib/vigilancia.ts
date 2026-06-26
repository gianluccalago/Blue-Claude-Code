import type { TipoEventoSentinela } from "@/types/database";

// ===========================================================================
// Vigilância Sanitária (RDC 502/2021) — utilidades puras dos eventos sentinela.
//
// Eventos sentinela (Art. 55): queda com lesão e tentativa de suicídio →
// notificar a autoridade sanitária. Doença de notificação compulsória
// (Art. 54) → notificar a vigilância epidemiológica.
// ===========================================================================

export const TIPO_SENTINELA: { value: TipoEventoSentinela; label: string; artigo: string }[] = [
  { value: "queda_com_lesao", label: "Queda com lesão", artigo: "Art. 55" },
  { value: "tentativa_suicidio", label: "Tentativa de suicídio", artigo: "Art. 55" },
  { value: "doenca_notificacao_compulsoria", label: "Doença de notificação compulsória", artigo: "Art. 54" },
];

export const TIPO_SENTINELA_LABEL: Record<TipoEventoSentinela, string> = {
  queda_com_lesao: "Queda com lesão",
  tentativa_suicidio: "Tentativa de suicídio",
  doenca_notificacao_compulsoria: "Doença de notificação compulsória",
};

export const TIPO_SENTINELA_ARTIGO: Record<TipoEventoSentinela, string> = {
  queda_com_lesao: "Art. 55",
  tentativa_suicidio: "Art. 55",
  doenca_notificacao_compulsoria: "Art. 54",
};

/** Órgão padrão por tipo (sugestão no formulário de notificação). */
export const ORGAO_SUGERIDO: Record<TipoEventoSentinela, string> = {
  queda_com_lesao: "Vigilância Sanitária local",
  tentativa_suicidio: "Vigilância Sanitária local",
  doenca_notificacao_compulsoria: "Vigilância Epidemiológica",
};

// Palavras que indicam LESÃO numa intercorrência de queda (sub-tipos do
// registro: "Hematoma", "Sangramento", "Contusão"; "Sem ferimento" = sem lesão).
const PALAVRAS_LESAO = ["hematoma", "sangramento", "contus", "ferimento", "fratura", "lesão", "lesao", "corte"];

/** Heurística leve: a descrição da queda sugere lesão? (apenas dica visual). */
export function quedaSugereLesao(descricao: string | null | undefined): boolean {
  const t = (descricao ?? "").toLowerCase();
  if (t.includes("sem ferimento")) return false;
  return PALAVRAS_LESAO.some((p) => t.includes(p));
}
