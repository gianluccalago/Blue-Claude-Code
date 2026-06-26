import type { CarteiraVacinal } from "@/types/database";

// ===========================================================================
// Controle de vacinação (RDC 502/2021 Art. 39) — status da carteira do hóspede.
// ===========================================================================

/** Carteira sem atualização há mais de N meses é sinalizada como atenção. */
export const MESES_VALIDADE_CARTEIRA = 12;

export type StatusCarteira = "em_dia" | "desatualizada" | "pendente";

export const STATUS_CARTEIRA_LABEL: Record<StatusCarteira, string> = {
  em_dia: "Em dia",
  desatualizada: "Desatualizada",
  pendente: "Pendente",
};

export const STATUS_CARTEIRA_VARIANTE: Record<StatusCarteira, "success" | "warning" | "destructive"> = {
  em_dia: "success",
  desatualizada: "warning",
  pendente: "destructive",
};

/** A versão vigente (mais recente por data_upload) de uma lista de carteiras. */
export function carteiraVigente(carteiras: CarteiraVacinal[]): CarteiraVacinal | null {
  if (carteiras.length === 0) return null;
  return [...carteiras].sort((a, b) => b.data_upload.localeCompare(a.data_upload))[0];
}

/** Status da carteira do residente a partir da versão vigente. */
export function statusCarteira(vigente: CarteiraVacinal | null): StatusCarteira {
  if (!vigente) return "pendente";
  const ref = vigente.atualizada_em ?? vigente.data_upload;
  const limite = new Date();
  limite.setMonth(limite.getMonth() - MESES_VALIDADE_CARTEIRA);
  const refData = new Date(`${ref}T00:00:00`);
  return refData < limite ? "desatualizada" : "em_dia";
}
