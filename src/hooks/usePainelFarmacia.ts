/**
 * Dados para o Painel da Farmácia.
 * Todos os alertas são calculados ao abrir a tela (sem processo em segundo plano).
 * Cada query é independente — rodam em paralelo via React Query.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { EstoqueHospede, EstoqueResgate, Prescricao } from "@/types/database";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function mesAtualISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Estoque por hóspede: todos os registros do mês atual ────────────────────

export function useEstoqueTodosMes(mesReferencia: string) {
  return useQuery({
    queryKey: ["estoque-todos-mes", mesReferencia],
    queryFn: async (): Promise<EstoqueHospede[]> => {
      const { data, error } = await supabase
        .from("estoque_hospede")
        .select("*")
        .eq("mes_referencia", mesReferencia);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Estoque de resgate (todos) ───────────────────────────────────────────────

export function useEstoqueResgateAll() {
  return useQuery({
    queryKey: ["estoque-resgate"],
    queryFn: async (): Promise<EstoqueResgate[]> => {
      const { data, error } = await supabase
        .from("estoque_resgate")
        .select("*")
        .order("medicamento");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Prescrições ativas de todos os residentes ───────────────────────────────

export type PrescricaoComResidente = Prescricao & { residente_nome?: string };

export function useTodasPrescricoesAtivas() {
  return useQuery({
    queryKey: ["todas-prescricoes-ativas"],
    queryFn: async (): Promise<PrescricaoComResidente[]> => {
      // !inner + filtro: só prescrições de hóspedes ATIVOS que ocupam leito
      // (inativos e day care somem do painel da farmácia).
      const { data, error } = await supabase
        .from("prescricao")
        .select("*, residente:residentes!inner(nome, status_hospede, modalidade)")
        .eq("ativa", true)
        .eq("residente.status_hospede", "ativo")
        .neq("residente.modalidade", "day_care");
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        ...(row as Prescricao),
        residente_nome: (row.residente as { nome?: string } | null)?.nome,
      }));
    },
  });
}

// ─── Residentes com algum provisionamento no mês ─────────────────────────────

export function useResidentesComProvisionamento(mesReferencia: string) {
  return useQuery({
    queryKey: ["residentes-com-provisionamento", mesReferencia],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("estoque_hospede")
        .select("residente_id")
        .eq("mes_referencia", mesReferencia);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.residente_id as string))];
      return ids;
    },
  });
}
