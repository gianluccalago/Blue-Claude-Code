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

export type LinhaExtratoId = LinhaExtrato & {
  id: string;
  origem: FcLancamento["origem"];
  /** Veio do módulo Obra (NF, marco, medição…): edita-se lá, não no extrato. */
  sincronizado: boolean;
};

/** Lançamento no formato do extrato (para o Demonstrativo e o editor mensal). */
export function comoLinhaExtrato(l: FcLancamento): LinhaExtratoId {
  return {
    id: l.id,
    mes: l.data.slice(0, 7),
    ordem: l.ordem,
    grupo: l.grupo,
    rotulo: l.descricao && l.origem !== "planilha" ? `${l.fornecedor} · ${l.descricao}` : l.fornecedor,
    valor: l.valor,
    origem: l.origem,
    sincronizado: !!l.origem_id,
  };
}

const EH_TRIADE = /tr[ií]ade/i;

export function useExtratoLinhas() {
  const q = useLancamentosFC();
  return { ...q, data: q.data ? q.data.map(comoLinhaExtrato) : undefined };
}

export function useExtratoSaldos() {
  return useQuery({
    queryKey: KEY_SALDOS,
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase.from("fc_extrato_mes").select("mes, saldo_inicial");
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.mes, r.saldo_inicial]));
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: KEY_FC });
  qc.invalidateQueries({ queryKey: KEY_SALDOS });
}

/**
 * Adiciona uma linha "como na planilha": mês, bloco, rótulo e valor com sinal.
 * CONCILIAÇÃO: quando o sócio-diretor lança a linha "Triade" do mês, os
 * pagamentos à TRÍADE que o módulo Obra já tinha sincronizado naquele mês
 * (NF, retenções, marcos, medições) saem — a planilha prevalece, e o mesmo
 * dinheiro não fica duas vezes. Devolve quantos foram removidos.
 */
export function useCriarLinhaExtrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { mes: string; grupo: GrupoFC; rotulo: string; valor: number; ordem: number }): Promise<{ removidos: number }> => {
      if (!v.rotulo.trim()) throw new Error("Informe a descrição.");
      if (!v.valor) throw new Error("Informe o valor (negativo para saídas/dividendos).");
      const centro = centroDoRotulo(v.rotulo, v.grupo);
      const dia = String(diaDoCentro(centro)).padStart(2, "0");
      let removidos = 0;
      if (v.grupo === "saida" && EH_TRIADE.test(v.rotulo)) {
        const { data, error: eDel } = await supabase
          .from("fc_lancamentos")
          .delete()
          .in("origem", ["nf", "nf_retencao", "marco", "medicao"])
          .gte("data", `${v.mes}-01`)
          .lte("data", `${v.mes}-31`)
          .select("id");
        if (eDel) throw eDel;
        removidos = data?.length ?? 0;
      }
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
      return { removidos };
    },
    onSuccess: () => invalidar(qc),
  });
}

/**
 * Edita rótulo e valor de uma linha DA PLANILHA ou manual. Linha que veio do
 * módulo Obra não se edita aqui (o rótulo exibido é "fornecedor · descrição",
 * e gravá-lo de volta corromperia o lançamento). O centro de custo só é
 * reclassificado pelo rótulo nas linhas da planilha.
 */
export function useEditarLinhaExtrato() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; rotulo: string; valor: number; grupo: GrupoFC; origem: FcLancamento["origem"]; sincronizado: boolean }) => {
      if (v.sincronizado) throw new Error("Este lançamento veio do módulo Obra — edite-o lá.");
      const { error } = await supabase
        .from("fc_lancamentos")
        .update({
          fornecedor: v.rotulo.trim(),
          valor: v.grupo === "saida" ? -Math.abs(v.valor) : v.valor,
          ...(v.origem === "planilha" ? { centro_custo: centroDoRotulo(v.rotulo, v.grupo) } : {}),
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
