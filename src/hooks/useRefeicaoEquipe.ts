import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { hojeISO } from "@/lib/utils";
import type { ConfigRefeicaoEquipe } from "@/types/database";

// ===========================================================================
// Custo da refeição dos funcionários (N7). Mantém UMA config corrente, mas cada
// alteração grava uma NOVA linha (histórico) — a vigente é a de maior
// `vigente_desde`. RLS: configura Nutri+Master; lê também Admin/Direção.
// ===========================================================================

const KEY = ["config-refeicao-equipe"];

/** Histórico completo das configs (recente → antiga). */
export function useConfigsRefeicaoEquipe() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ConfigRefeicaoEquipe[]> => {
      const { data, error } = await supabase
        .from("config_refeicao_equipe")
        .select("*")
        .order("vigente_desde", { ascending: false })
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface SalvarConfigInput {
  refeicoesEquipePorDia: number;
  custoMedioRefeicao: number;
  /** Início da vigência (default hoje). */
  vigenteDesde?: string;
}

/** Grava uma NOVA config (mantém o histórico). */
export function useSalvarConfigRefeicaoEquipe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SalvarConfigInput) => {
      const { error } = await supabase.from("config_refeicao_equipe").insert({
        refeicoes_equipe_por_dia: input.refeicoesEquipePorDia,
        custo_medio_refeicao_fallback: input.custoMedioRefeicao,
        vigente_desde: input.vigenteDesde ?? hojeISO(),
        atualizado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
