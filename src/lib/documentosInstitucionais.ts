import { hojeISO } from "@/lib/utils";
import type { DocumentoInstitucional } from "@/types/database";

// ===========================================================================
// Documentos indispensáveis da ILPI (Lei Municipal 13.725/04, RDC 283/05 →
// 502/21, Portaria 344/98). Checklist canônico + status por validade, no molde
// de lib/vacinacao.ts (statusCarteira).
// ===========================================================================

export interface TipoDocumento {
  slug: string;
  label: string;
  /** true = o documento vence e a validade deve ser cobrada. */
  temValidade: boolean;
  dica?: string;
}

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  { slug: "contrato_social", label: "Contrato Social", temValidade: false },
  { slug: "cmvs", label: "Cadastro Municipal na Vigilância em Saúde (CMVS)", temValidade: true },
  { slug: "crt", label: "Certidão de Responsabilidade Técnica", temValidade: true },
  { slug: "aso_contratos", label: "ASO e contratos de trabalho", temValidade: true, dica: "ASO vence; manter o conjunto atualizado" },
  { slug: "cevs_pragas", label: "Certificado de Controle de Pragas (CEVS)", temValidade: true },
  { slug: "limpeza_caixa_dagua", label: "Certificado de Limpeza de Caixa d'água", temValidade: true },
  { slug: "avcb", label: "AVCB ou protocolo", temValidade: true },
  { slug: "contrato_rss", label: "Contrato com empresa de coleta de RSS", temValidade: true },
  { slug: "livro_admissao", label: "Livro de registro de admissão dos internos", temValidade: false },
  { slug: "livro_controlados", label: "Livro de registro de medicamentos controlados", temValidade: false, dica: "Mantido digitalmente no módulo Livro de controlados" },
  { slug: "regulamento_interno", label: "Regulamento interno ou institucional", temValidade: false },
  { slug: "contrato_prestacao", label: "Contrato de prestação de serviços", temValidade: false },
  { slug: "alvara", label: "Alvará de funcionamento", temValidade: true },
  { slug: "outro", label: "Outros (exigência da autoridade sanitária)", temValidade: false, dica: "Ex.: contrato de lavanderia, declarações de treinamento etc." },
];

export function tipoDocumento(slug: string): TipoDocumento {
  return TIPOS_DOCUMENTO.find((t) => t.slug === slug) ?? { slug, label: slug, temValidade: false };
}

export type StatusDocumento = "pendente" | "vencido" | "vence_em_breve" | "em_dia" | "sem_validade";

export const STATUS_DOC_LABEL: Record<StatusDocumento, string> = {
  pendente: "Pendente",
  vencido: "Vencido",
  vence_em_breve: "Vence em breve",
  em_dia: "Em dia",
  sem_validade: "Arquivado",
};

export const STATUS_DOC_VARIANTE: Record<StatusDocumento, "destructive" | "warning" | "success" | "muted"> = {
  pendente: "destructive",
  vencido: "destructive",
  vence_em_breve: "warning",
  em_dia: "success",
  sem_validade: "muted",
};

const DIAS_AVISO_VENCIMENTO = 30;

/** Versão vigente de um tipo = a mais recente (criado_em desc já vem do banco). */
export function documentoVigente(docs: DocumentoInstitucional[]): DocumentoInstitucional | null {
  return docs[0] ?? null;
}

/** Status do documento vigente de um tipo do checklist. */
export function statusDocumento(
  tipo: TipoDocumento,
  vigente: DocumentoInstitucional | null,
): StatusDocumento {
  if (!vigente) return "pendente";
  if (!tipo.temValidade || !vigente.data_validade) return "sem_validade";
  const hoje = hojeISO();
  if (vigente.data_validade < hoje) return "vencido";
  const aviso = new Date(hoje + "T12:00:00");
  aviso.setDate(aviso.getDate() + DIAS_AVISO_VENCIMENTO);
  const limite = aviso.toISOString().slice(0, 10);
  if (vigente.data_validade <= limite) return "vence_em_breve";
  return "em_dia";
}
