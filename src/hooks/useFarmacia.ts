import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { EstoqueHospede, Prescricao } from "@/types/database";

// ─── Estoque por hóspede ──────────────────────────────────────────────────────

export function useEstoqueHospede(residenteId: string | null, mesReferencia: string) {
  return useQuery({
    queryKey: ["estoque-hospede", residenteId, mesReferencia],
    enabled: !!residenteId,
    queryFn: async (): Promise<EstoqueHospede[]> => {
      const { data, error } = await supabase
        .from("estoque_hospede")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("mes_referencia", mesReferencia)
        .order("medicamento");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePrescricoesParaFarmacia(residenteId: string | null) {
  return useQuery({
    queryKey: ["prescricoes-farmacia", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<Prescricao[]> => {
      const { data, error } = await supabase
        .from("prescricao")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("ativa", true)
        .order("medicamento");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Provisionamento ──────────────────────────────────────────────────────────

export type ItemProvisionamento = {
  medicamento: string;
  quantidadeProvisionada: number;
  unidade: string;
  /** Para itens já existentes, preservar quantidade_atual; para novos, = provisionada. */
  quantidadeAtualExistente: number | null;
};

export function useProvisionarEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      mesReferencia: string;
      itens: ItemProvisionamento[];
    }) => {
      const rows = args.itens.map((item) => ({
        residente_id: args.residenteId,
        medicamento: item.medicamento,
        mes_referencia: args.mesReferencia,
        quantidade_provisionada: item.quantidadeProvisionada,
        // Bloco B (dispensação) decrementará quantidade_atual; aqui preserva o saldo
        // existente se já foi provisionado antes (ajuste), ou inicia igual ao provisionado.
        quantidade_atual: item.quantidadeAtualExistente ?? item.quantidadeProvisionada,
        unidade: item.unidade,
      }));
      const { error } = await supabase
        .from("estoque_hospede")
        .upsert(rows, { onConflict: "residente_id,medicamento,mes_referencia" });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["estoque-hospede", vars.residenteId, vars.mesReferencia] });
    },
  });
}
