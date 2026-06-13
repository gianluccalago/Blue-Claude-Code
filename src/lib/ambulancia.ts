import type { DesfechoAmbulancia } from "@/types/database";

// Opções e rótulos do chamado de ambulância (compartilhados entre a tela de
// registro do cuidador e a gestão da Coordenação).

export const DESFECHO_AMBULANCIA: { value: DesfechoAmbulancia; label: string }[] = [
  { value: "medicado_local", label: "Medicado no local e permaneceu" },
  { value: "removido_hospital", label: "Removido para o hospital" },
];

export const DESFECHO_AMBULANCIA_LABEL: Record<DesfechoAmbulancia, string> = {
  medicado_local: "Medicado no local e permaneceu",
  removido_hospital: "Removido para o hospital",
};

/** Dados do chamado de ambulância (compartilhado por registro/edição). */
export interface DadosAmbulancia {
  medico: string;
  tempoRespostaMin: number | null;
  desfecho: DesfechoAmbulancia | null;
  hospitalDestino: string;
}

/** "25 min" / "—" para exibição compacta do tempo de resposta. */
export function formatarTempoResposta(min: number | null | undefined): string {
  return min != null && Number.isFinite(min) ? `${min} min` : "—";
}
