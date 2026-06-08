import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hojeISO, inicioDoDiaISO } from "@/lib/utils";
import type {
  Administracao,
  PeriodoMedicacao,
  Prescricao,
  ViaMedicacao,
} from "@/types/database";

/** Quem administra nesta tela (sem login ainda). */
const ENFERMAGEM = "Enfermagem";

/** Vias exclusivas da enfermagem (o cuidador não administra). */
const VIAS_ENFERMAGEM: ViaMedicacao[] = ["injetavel", "insulina", "sonda"];

/** Prescrições ativas de enfermagem (injetável/insulina/sonda) do residente. */
export function usePrescricoesEnfermagem(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["prescricoes-enfermagem", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<Prescricao[]> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", true)
        .in("via", VIAS_ENFERMAGEM);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Administrações de enfermagem registradas HOJE para o residente (item a item,
 * portanto apenas as que referenciam uma prescrição). Da mais antiga para a
 * mais recente, para leitura cronológica do histórico do dia.
 */
export function useAdministracoesEnfermagemHoje(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["administracao-enfermagem", residenteId, hojeISO()],
    enabled: !!residenteId,
    queryFn: async (): Promise<Administracao[]> => {
      const { data, error } = await supabase
        .from("administracao")
        .select("*")
        .eq("residente_id", residenteId!)
        .not("prescricao_id", "is", null)
        .gte("administrado_em", inicioDoDiaISO())
        .order("administrado_em", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Registra UMA administração de enfermagem (cada toque = um novo registro;
 * o mesmo item pode ser administrado várias vezes no dia). Grava em
 * administracao com status "sim" e a referência à prescrição.
 */
export function useRegistrarAdministracaoEnfermagem(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { prescricaoId: string; periodo: PeriodoMedicacao }) => {
      const { error } = await supabase.from("administracao").insert({
        residente_id: residenteId,
        periodo: args.periodo,
        status: "sim",
        administrado_por: ENFERMAGEM,
        prescricao_id: args.prescricaoId,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["administracao-enfermagem", residenteId] }),
  });
}

/**
 * Desfaz UMA administração específica (delete pelo id). Corrige um registro
 * feito por engano sem afetar os demais.
 */
export function useRemoverAdministracaoEnfermagem(residenteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("administracao").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["administracao-enfermagem", residenteId] }),
  });
}
