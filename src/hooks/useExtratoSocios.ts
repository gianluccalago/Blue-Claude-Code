import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { KEY_FC, useLancamentosFC } from "@/hooks/useFluxoCaixa";
import { centroDoRotulo, diaDoCentro, type GrupoFC } from "@/lib/fluxoCaixa";
import type { LinhaExtrato } from "@/lib/extratoSocios";
import type { FcLancamento } from "@/types/database";

// ===========================================================================
// EXTRATO DOS SÓCIOS — a MESMA fonte do Fluxo de Caixa (fc_lancamentos).
// Este hook só apresenta os lançamentos no formato da planilha mensal
// (mês · grupo · rótulo · valor com sinal) e grava de volta na mesma tabela,
// classificando o centro de custo pelo rótulo. Saldo inicial declarado por
// mês continua em fc_extrato_mes (master/direção).
// ===========================================================================

const KEY_SALDOS = ["fc-extrato-saldos"];

/** Lançamento no formato do extrato (para o Demonstrativo e o editor mensal). */
export function comoLinhaExtrato(l: FcLancamento): LinhaExtrato & { id: string } {
  return {
    id: l.id,
    mes: l.data.slice(0, 7),
    ordem: l.ordem,
    grupo: l.grupo,
    rotulo: l.descricao && l.origem !== "planilha" ? `${l.fornecedor} · ${l.descricao}` : l.fornecedor,
    valor: l.valor,
  };
}

export function useExtratoLinhas() {
  const q = useLancamentosFC();
  return { ...q, data: q.data ? q.data.map(comoLinhaExtrato) : undefined };
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
  qc.invalidateQueries({ queryKey: KEY_FC });
  qc.invalidateQueries({ queryKey: KEY_SALDOS });
}

/** Adiciona uma linha "como na planilha": mês, bloco, rótulo e valor com sinal. */
export function useCriarLinhaExtrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { mes: string; grupo: GrupoFC; rotulo: string; valor: number; ordem: number }) => {
      if (!v.rotulo.trim()) throw new Error("Informe a descrição.");
      if (!v.valor) throw new Error("Informe o valor (negativo para saídas/dividendos).");
      const centro = centroDoRotulo(v.rotulo, v.grupo);
      const dia = String(diaDoCentro(centro)).padStart(2, "0");
      const { error } = await supabase.from("fc_lancamentos").insert({
        data: `${v.mes}-${dia}`,
        valor: v.grupo === "saida" ? -Math.abs(v.valor) : v.valor,
        grupo: v.grupo,
        ordem: v.ordem,
        centro_custo: centro,
        fornecedor: v.rotulo.trim(),
        descricao: null,
        pagador: "seniors",
        origem: "planilha",
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useEditarLinhaExtrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; rotulo: string; valor: number; grupo: GrupoFC }) => {
      const { error } = await supabase
        .from("fc_lancamentos")
        .update({
          fornecedor: v.rotulo.trim(),
          valor: v.grupo === "saida" ? -Math.abs(v.valor) : v.valor,
          centro_custo: centroDoRotulo(v.rotulo, v.grupo),
        })
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
      const { error } = await supabase.from("fc_lancamentos").delete().eq("id", id);
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
