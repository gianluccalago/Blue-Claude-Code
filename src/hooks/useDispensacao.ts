import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hojeISO } from "@/lib/utils";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { Dispensacao, ItemDispensacaoJson } from "@/types/database";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Dia civil LOCAL (não UTC): à noite em SP o toISOString() viraria o dia errado. */
export function hojeISODate(): string {
  return hojeISO();
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Dispensações de um hóspede em uma data. */
export function useDispensacoesDoHospede(residenteId: string | null, data: string) {
  return useQuery({
    queryKey: ["dispensacoes", residenteId, data],
    enabled: !!residenteId,
    queryFn: async (): Promise<Dispensacao[]> => {
      const { data: rows, error } = await supabase
        .from("dispensacao")
        .select("*")
        .eq("residente_id", residenteId!)
        .eq("data", data)
        .order("dispensado_em", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as Dispensacao[];
    },
  });
}

/** Todas as dispensações de uma data (para o mapa de preparo). */
export function useDispensacoesDodia(data: string) {
  return useQuery({
    queryKey: ["dispensacoes-dia", data],
    queryFn: async (): Promise<Dispensacao[]> => {
      const { data: rows, error } = await supabase
        .from("dispensacao")
        .select("*")
        .eq("data", data)
        .order("dispensado_em", { ascending: false });
      if (error) throw error;
      return (rows ?? []) as Dispensacao[];
    },
  });
}

// ─── Mutações ─────────────────────────────────────────────────────────────────

/** Confirma a dispensação: grava registro + decrementa estoque_hospede. */
export function useConfirmarDispensacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      periodo: string;
      data: string;
      itens: ItemDispensacaoJson[];
      dispensadoPor?: string;
    }) => {
      // Registro + baixa de estoque numa ÚNICA transação, idempotente por
      // (hóspede, período, dia) — dupla confirmação não duplica nem baixa 2x
      // (RPC dispensar_medicamentos, migration 0094).
      const { data: id, error } = await supabase.rpc("dispensar_medicamentos", {
        p_residente_id: args.residenteId,
        p_periodo: args.periodo,
        p_data: args.data,
        p_itens: args.itens,
        p_dispensado_por: args.dispensadoPor ?? usuarioAtual.nome,
      });
      if (error) throw error;
      return id as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["dispensacoes", vars.residenteId, vars.data] });
      qc.invalidateQueries({ queryKey: ["dispensacoes-dia", vars.data] });
      qc.invalidateQueries({ queryKey: ["estoque-hospede", vars.residenteId] });
      qc.invalidateQueries({ queryKey: ["estoque-todos-mes"] });
    },
  });
}

/** Desfaz uma dispensação: estorna a baixa + remove o registro. */
export function useDesfazerDispensacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dispensacao: Dispensacao) => {
      // Estorno do saldo + remoção do registro numa ÚNICA transação
      // (RPC estornar_dispensacao, migration 0094).
      const { error } = await supabase.rpc("estornar_dispensacao", { p_id: dispensacao.id });
      if (error) throw error;
    },
    onSuccess: (_r, dispensacao) => {
      qc.invalidateQueries({ queryKey: ["dispensacoes", dispensacao.residente_id, dispensacao.data] });
      qc.invalidateQueries({ queryKey: ["dispensacoes-dia", dispensacao.data] });
      qc.invalidateQueries({ queryKey: ["estoque-hospede", dispensacao.residente_id] });
      qc.invalidateQueries({ queryKey: ["estoque-todos-mes"] });
    },
  });
}
