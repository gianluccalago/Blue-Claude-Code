import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Residente } from "@/types/database";

// ===========================================================================
// Ciclo de vida do hóspede (inativação por saída). Registrar saída / reativar:
// só Master e Direção (gate na UI). Inativar NÃO apaga nada — o histórico e o
// financeiro são preservados; o hóspede só some das telas operacionais.
// ===========================================================================

/** Hóspedes INATIVOS (saíram), mais recentes primeiro. Só gestão consome. */
export function useResidentesInativos() {
  return useQuery({
    queryKey: ["residentes-inativos"],
    queryFn: async (): Promise<Residente[]> => {
      const { data, error } = await supabase
        .from("residentes")
        .select("*")
        .eq("status_hospede", "inativo")
        .order("data_saida", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["residentes"] });
  qc.invalidateQueries({ queryKey: ["residentes-inativos"] });
}

/** Registra a saída: status inativo + data/motivo. A suíte libera (sem hóspede ativo). */
export function useRegistrarSaida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; dataSaida: string; motivo: string }) => {
      const { error } = await supabase
        .from("residentes")
        .update({
          status_hospede: "inativo",
          data_saida: args.dataSaida,
          motivo_saida: args.motivo,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Reativa um hóspede inativado por engano. */
export function useReativarHospede() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("residentes")
        .update({ status_hospede: "ativo", data_saida: null, motivo_saida: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
