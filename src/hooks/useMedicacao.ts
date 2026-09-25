import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CUIDADOR_ATUAL } from "@/data/profiles";
import { hojeISO, inicioDoDiaISO } from "@/lib/utils";
import type {
  Administracao,
  PeriodoMedicacao,
  Prescricao,
  StatusAdministracao,
} from "@/types/database";

// ─── Queries ──────────────────────────────────────────────────────────────────

export function usePrescricoes(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["prescricoes", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<Prescricao[]> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Administrações registradas desde `desdeISO` (por padrão, desde a meia-noite
 * de hoje em SP), da mais recente para a mais antiga. Usada para mostrar o
 * status persistente de cada período.
 *
 * Plantão NOTURNO atravessa a meia-noite: às 00h30 a dose da "Noite" (20h)
 * pertence ao turno que começou às 19h de ontem. A tela passa o início da
 * janela do plantão (lib/plantao.janelaDoPlantao) — sem isto, depois da
 * meia-noite ela aparecia como "não registrada" (risco de dose dobrada).
 */
export function useAdministracoesHoje(residenteId: string | undefined, desdeISO?: string | null) {
  const desde = desdeISO ?? inicioDoDiaISO();
  return useQuery({
    queryKey: ["administracao", residenteId, hojeISO(), desde],
    enabled: !!residenteId,
    queryFn: async (): Promise<Administracao[]> => {
      const { data, error } = await supabase
        .from("administracao")
        .select("*")
        .eq("residente_id", residenteId!)
        .gte("administrado_em", desde)
        .order("administrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Mutação de confirmação ───────────────────────────────────────────────────

/**
 * Registra a administração de medicação pelo cuidador.
 * A baixa de estoque NÃO ocorre aqui — ocorre na Dispensação (Farmácia).
 * O campo baixa_farmacia é reservado para reconciliação futura.
 */
export function useRegistrarAdministracao(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      periodo: PeriodoMedicacao;
      status: StatusAdministracao;
      itensFaltantes?: string | null;
      /** Motivo quando status="nao" (Recusou/Indisposto/Ausente/Outro). */
      motivo?: string | null;
    }) => {
      const { error } = await supabase.from("administracao").insert({
        residente_id: residenteId,
        periodo: args.periodo,
        status: args.status,
        itens_faltantes: args.itensFaltantes ?? null,
        motivo: args.motivo ?? null,
        administrado_por: CUIDADOR_ATUAL.nome,
        baixa_farmacia: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["administracao", residenteId] });
    },
  });
}
