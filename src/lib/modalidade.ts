import type { ModalidadeEstadia, Residente, TipoValorDiaria } from "@/types/database";

// ===========================================================================
// Modalidade de estadia. Regras:
//  - longa_permanencia: padrão (ocupa leito, mensalidade).
//  - curta_permanencia: ocupa leito, operacionalmente igual à longa, mas
//    TEMPORÁRIA (selo + data_fim_prevista); cobrança por diária/pacote (futuro).
//  - day_care: NÃO ocupa leito; só período da tarde; cuidado leve; lista própria.
// ===========================================================================

export const MODALIDADES: { value: ModalidadeEstadia; label: string }[] = [
  { value: "longa_permanencia", label: "Longa permanência" },
  { value: "curta_permanencia", label: "Curta permanência" },
  { value: "day_care", label: "Day Care" },
];

export const MODALIDADE_LABEL: Record<ModalidadeEstadia, string> = {
  longa_permanencia: "Longa permanência",
  curta_permanencia: "Curta permanência",
  day_care: "Day Care",
};

/** Selo curto exibido nas telas (longa não recebe selo — é o padrão). */
export const MODALIDADE_SELO: Record<ModalidadeEstadia, string | null> = {
  longa_permanencia: null,
  curta_permanencia: "Curta permanência",
  day_care: "Day Care",
};

/** Tipos de valor da tabela de diárias (referência; tabela nov/2026). */
export const TIPO_VALOR_DIARIA_LABEL: Record<TipoValorDiaria, string> = {
  diaria: "por diária",
  day_care_periodo: "por período (tarde)",
  sd_2a_6a: "Seniors Day · 2ª a 6ª (diária)",
  sd_2a_4a_6a: "Seniors Day · 2ª, 4ª e 6ª (diária)",
  sd_3a_5a: "Seniors Day · 3ª e 5ª (diária)",
  sd_sab_dom: "Seniors Day · sábado e domingo (diária)",
  fds_pacote: "Fim de semana · sexta 17h a segunda 10h (pacote)",
};
/** Ordem de exibição dos tipos de valor. */
export const ORDEM_TIPO_VALOR_DIARIA: TipoValorDiaria[] = ["diaria", "sd_2a_6a", "sd_2a_4a_6a", "sd_3a_5a", "sd_sab_dom", "fds_pacote", "day_care_periodo"];

/** Ocupa leito? Longa e curta sim; day care não. */
export function ocupaLeito(m: ModalidadeEstadia | null | undefined): boolean {
  return m !== "day_care";
}

/** Estadia temporária (tem fim previsto): curta e day care. */
export function ehTemporaria(m: ModalidadeEstadia | null | undefined): boolean {
  return m === "curta_permanencia" || m === "day_care";
}

/** Dias até o fim previsto (negativo = já passou; null = sem previsão). */
export function diasAteFim(dataFimPrevista: string | null | undefined): number | null {
  if (!dataFimPrevista) return null;
  const fim = new Date(`${dataFimPrevista}T00:00:00`);
  const hoje = new Date();
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((fim.getTime() - base.getTime()) / 86_400_000);
}

/** Curta permanência cujo fim previsto está a até `dias` dias (alerta). */
export function temporariasTerminando(residentes: Residente[], dias = 15): Residente[] {
  return residentes
    .filter((r) => r.modalidade === "curta_permanencia" && r.data_fim_prevista)
    .map((r) => ({ r, d: diasAteFim(r.data_fim_prevista) }))
    .filter((x) => x.d != null && x.d <= dias)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))
    .map((x) => x.r);
}
