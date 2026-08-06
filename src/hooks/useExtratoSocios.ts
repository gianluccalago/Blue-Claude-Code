import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { FcExtratoLinha } from "@/types/database";

// ===========================================================================
// EXTRATO DOS SÓCIOS (contas Seniors Care) — master/direção (RLS).
// Fonte do Demonstrativo de Caixa em PDF. Saldo inicial declarado por mês +
// lançamentos com sinal (como na planilha do sócio-diretor).
// ===========================================================================

const KEY = ["fc-extrato"];
const KEY_SALDOS = ["fc-extrato-saldos"];

export function useExtratoLinhas() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<FcExtratoLinha[]> => {
      const { data, error } = await supabase
        .from("fc_extrato")
        .select("*")
        .order("mes")
        .order("grupo")
        .order("ordem");
      if (error) return [];
      return data ?? [];
    },
  });
}

export function useExtratoSaldos() {
  return useQuery({
    queryKey: KEY_SALDOS,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.from("fc_extrato_mes").select("mes, saldo_inicial");
      if (error) return new Map();
      return new Map((data ?? []).map((r) => [r.mes, r.saldo_inicial]));
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY });
  qc.invalidateQueries({ queryKey: KEY_SALDOS });
}

export function useCriarLinhaExtrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { mes: string; grupo: "entrada" | "saida"; rotulo: string; valor: number; ordem: number }) => {
      if (!v.rotulo.trim()) throw new Error("Informe a descrição.");
      if (!v.valor) throw new Error("Informe o valor (negativo para saídas/dividendos).");
      const { error } = await supabase.from("fc_extrato").insert({
        mes: v.mes, grupo: v.grupo, rotulo: v.rotulo.trim(), valor: v.valor,
        ordem: v.ordem, registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useEditarLinhaExtrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; rotulo: string; valor: number }) => {
      const { error } = await supabase
        .from("fc_extrato")
        .update({ rotulo: v.rotulo.trim(), valor: v.valor })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useExcluirLinhaExtrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fc_extrato").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Define/ajusta o saldo inicial declarado de um mês. */
export function useDefinirSaldoInicial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { mes: string; saldoInicial: number }) => {
      const { error } = await supabase
        .from("fc_extrato_mes")
        .upsert({ mes: v.mes, saldo_inicial: v.saldoInicial });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}
