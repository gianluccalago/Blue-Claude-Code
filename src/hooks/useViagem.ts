import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { hojeISO } from "@/lib/utils";
import type { BaixaViagem, ItemDispensacaoJson } from "@/types/database";

// ===========================================================================
// Baixa de estoque por VIAGEM (Farmácia). Caso eventual: o hóspede viaja X dias
// e leva a medicação. Registra UMA baixa rastreável (motivo = viagem) e
// decrementa o estoque_hospede do mês de uma vez. Permite estorno (devolução).
// RLS: registra/estorna Farmácia+Master; lê a equipe clínica (não família).
// ===========================================================================

/** Baixas de viagem de um hóspede (recentes → antigas). */
export function useBaixasViagemDoHospede(residenteId: string | null) {
  return useQuery({
    queryKey: ["baixas-viagem", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<BaixaViagem[]> => {
      const { data, error } = await supabase
        .from("baixa_viagem")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("data", { ascending: false })
        .order("registrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Conjunto de residente_ids EM VIAGEM numa data (viagem ativa, não estornada,
 * cujo período [data, data+dias) cobre a data informada). Usado para não tratar
 * o hóspede como "pendente" na dispensação enquanto está fora.
 */
export function useViagensAtivasNaData(data: string) {
  return useQuery({
    queryKey: ["viagens-ativas", data],
    queryFn: async (): Promise<Set<string>> => {
      const { data: rows, error } = await supabase
        .from("baixa_viagem")
        .select("residente_id, data, dias, estornado")
        .eq("estornado", false)
        .lte("data", data);
      if (error) throw error;
      const alvo = new Date(`${data}T00:00:00`);
      const set = new Set<string>();
      for (const r of rows ?? []) {
        const inicio = new Date(`${r.data as string}T00:00:00`);
        const fim = new Date(inicio);
        fim.setDate(fim.getDate() + (r.dias as number));
        if (alvo >= inicio && alvo < fim) set.add(r.residente_id as string);
      }
      return set;
    },
  });
}

// ─── Mutações ─────────────────────────────────────────────────────────────────

/** Registra a baixa de viagem + decrementa o estoque_hospede do mês (em lote). */
export function useRegistrarBaixaViagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      mesReferencia: string;
      dias: number;
      data?: string;
      itens: ItemDispensacaoJson[];
      observacao?: string | null;
    }) => {
      // 1) Grava o registro rastreável da viagem.
      const { error: errIns } = await supabase.from("baixa_viagem").insert({
        residente_id: args.residenteId,
        mes_referencia: args.mesReferencia,
        dias: args.dias,
        data: args.data ?? hojeISO(),
        itens: args.itens,
        observacao: args.observacao ?? null,
        registrado_por: usuarioAtual.nome,
      });
      if (errIns) throw errIns;

      // 2) Baixa o estoque de cada item (best-effort; saldo pode ficar negativo,
      //    como na dispensação — sinalizado no painel).
      for (const item of args.itens) {
        const { data: estoq } = await supabase
          .from("estoque_hospede")
          .select("id, quantidade_atual")
          .eq("residente_id", args.residenteId)
          .eq("medicamento", item.medicamento)
          .eq("mes_referencia", args.mesReferencia)
          .maybeSingle();
        if (estoq) {
          await supabase
            .from("estoque_hospede")
            .update({ quantidade_atual: estoq.quantidade_atual - item.quantidade })
            .eq("id", estoq.id);
        }
      }
    },
    onSuccess: (_r, vars) => {
      qc.invalidateQueries({ queryKey: ["baixas-viagem", vars.residenteId] });
      qc.invalidateQueries({ queryKey: ["viagens-ativas"] });
      qc.invalidateQueries({ queryKey: ["estoque-hospede", vars.residenteId, vars.mesReferencia] });
      qc.invalidateQueries({ queryKey: ["estoque-todos-mes"] });
    },
  });
}

/** Estorna a baixa de viagem: devolve as quantidades ao estoque + marca estornada. */
export function useEstornarBaixaViagem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (baixa: BaixaViagem) => {
      const itens = baixa.itens as ItemDispensacaoJson[];
      // Devolve o saldo de cada item ao estoque do mês debitado.
      for (const item of itens) {
        const { data: estoq } = await supabase
          .from("estoque_hospede")
          .select("id, quantidade_atual")
          .eq("residente_id", baixa.residente_id)
          .eq("medicamento", item.medicamento)
          .eq("mes_referencia", baixa.mes_referencia)
          .maybeSingle();
        if (estoq) {
          await supabase
            .from("estoque_hospede")
            .update({ quantidade_atual: estoq.quantidade_atual + item.quantidade })
            .eq("id", estoq.id);
        }
      }
      // Marca a baixa como estornada (mantém a trilha).
      const { error } = await supabase
        .from("baixa_viagem")
        .update({
          estornado: true,
          estornado_por: usuarioAtual.nome,
          estornado_em: new Date().toISOString(),
        })
        .eq("id", baixa.id);
      if (error) throw error;
    },
    onSuccess: (_r, baixa) => {
      qc.invalidateQueries({ queryKey: ["baixas-viagem", baixa.residente_id] });
      qc.invalidateQueries({ queryKey: ["viagens-ativas"] });
      qc.invalidateQueries({ queryKey: ["estoque-hospede", baixa.residente_id, baixa.mes_referencia] });
      qc.invalidateQueries({ queryKey: ["estoque-todos-mes"] });
    },
  });
}
