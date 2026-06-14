import type { ConfigRefeicaoEquipe } from "@/types/database";

// ===========================================================================
// Custo da refeição dos funcionários (BLOCO N7) — ESTIMATIVA, não contábil.
//
// Os funcionários comem de graça; não se registra prato a prato. Estima-se:
//   custo do mês = refeições/dia da equipe × dias do mês × custo médio/refeição
//
// O "custo médio por refeição" é uma constante configurável (proxy enxuto do
// custo por porção do cardápio/N3, fácil de manter). NÃO gera cobrança — é
// benefício à equipe, não upselling.
// ===========================================================================

/** Custo médio por refeição sugerido quando ainda não há config (R$). */
export const CUSTO_MEDIO_REFEICAO_PADRAO = 12;
/** Refeições/dia da equipe sugeridas quando ainda não há config. */
export const REFEICOES_EQUIPE_POR_DIA_PADRAO = 30;

/** Dias do mês "YYYY-MM". */
export function diasNoMes(mes: string): number {
  const [y, m] = mes.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Config VIGENTE num mês "YYYY-MM": a de maior `vigente_desde` que começou até
 * o fim daquele mês. Mantém o histórico de custo correto ao olhar meses
 * passados (cada alteração gravou uma nova linha). Null se nenhuma vigorava.
 */
export function configVigenteNoMes(
  configs: ConfigRefeicaoEquipe[],
  mes: string,
): ConfigRefeicaoEquipe | null {
  const fimDoMes = `${mes}-31`; // comparação lexicográfica de datas ISO
  const elegiveis = configs
    .filter((c) => c.vigente_desde <= fimDoMes)
    .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde));
  return elegiveis[0] ?? null;
}

export interface CustoMesEquipe {
  mes: string;
  refeicoesPorDia: number;
  dias: number;
  custoMedio: number;
  /** refeições/dia × dias do mês. */
  refeicoesNoMes: number;
  /** refeições do mês × custo médio. */
  custoTotal: number;
  /** Havia config vigente para o mês. */
  temConfig: boolean;
}

/** Custo estimado da equipe num mês, a partir da config vigente naquele mês. */
export function custoMesEquipe(configs: ConfigRefeicaoEquipe[], mes: string): CustoMesEquipe {
  const cfg = configVigenteNoMes(configs, mes);
  const dias = diasNoMes(mes);
  const refeicoesPorDia = cfg?.refeicoes_equipe_por_dia ?? 0;
  const custoMedio = cfg?.custo_medio_refeicao_fallback ?? 0;
  const refeicoesNoMes = refeicoesPorDia * dias;
  return {
    mes,
    refeicoesPorDia,
    dias,
    custoMedio,
    refeicoesNoMes,
    custoTotal: refeicoesNoMes * custoMedio,
    temConfig: cfg !== null,
  };
}
