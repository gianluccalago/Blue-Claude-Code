import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { InspecaoSuite, InspecaoItem, TipoInspecao, StatusItemInspecao } from "@/types/database";

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Todas as inspeções de hoje (usadas para calcular status das suítes). */
export function useInspecoesHoje() {
  const hoje = new Date().toISOString().slice(0, 10);
  return useQuery({
    queryKey: ["inspecoes-hoje", hoje],
    queryFn: async (): Promise<InspecaoSuite[]> => {
      const { data, error } = await supabase
        .from("inspecao_suite")
        .select("*")
        .eq("data", hoje)
        .order("inspecionado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Histórico de inspeções de uma suíte (por residente_id), mais recente primeiro. */
export function useInspecoesDaSuite(residenteId: string | null) {
  return useQuery({
    queryKey: ["inspecoes-suite", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<InspecaoSuite[]> => {
      const { data, error } = await supabase
        .from("inspecao_suite")
        .select("*")
        .eq("residente_id", residenteId!)
        .order("data", { ascending: false })
        .order("inspecionado_em", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Itens de uma inspeção específica. */
export function useItensDaInspecao(inspecaoId: string | null) {
  return useQuery({
    queryKey: ["inspecao-itens", inspecaoId],
    enabled: !!inspecaoId,
    queryFn: async (): Promise<InspecaoItem[]> => {
      const { data, error } = await supabase
        .from("inspecao_item")
        .select("*")
        .eq("inspecao_id", inspecaoId!);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Mutações ─────────────────────────────────────────────────────────────────

export type ItemInspecaoInput = {
  item: string;
  status: StatusItemInspecao;
  observacao: string | null;
};

/**
 * Grava uma inspeção e seus itens.
 * GANCHO PARA MANUTENÇÃO (Bloco H2): cada item com status "nao_conforme" deverá
 * gerar (ou sugerir) um chamado de manutenção. Por ora apenas registramos;
 * o Bloco H2 implementará a criação automática/sugestão de chamados.
 */
export function useSalvarInspecao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      quarto: string | null;
      tipo: TipoInspecao;
      itens: ItemInspecaoInput[];
    }) => {
      const temNaoConformidade = args.itens.some((i) => i.status === "nao_conforme");

      const { data: suite, error: errS } = await supabase
        .from("inspecao_suite")
        .insert({
          residente_id: args.residenteId,
          quarto: args.quarto,
          tipo: args.tipo,
          tem_nao_conformidade: temNaoConformidade,
        })
        .select("id")
        .single();
      if (errS) throw errS;

      const { error: errI } = await supabase.from("inspecao_item").insert(
        args.itens.map((it) => ({
          inspecao_id: suite.id,
          item: it.item,
          status: it.status,
          observacao: it.observacao || null,
        }))
      );
      if (errI) throw errI;

      return suite.id as string;
    },
    onSuccess: (_id, vars) => {
      const hoje = new Date().toISOString().slice(0, 10);
      qc.invalidateQueries({ queryKey: ["inspecoes-hoje", hoje] });
      qc.invalidateQueries({ queryKey: ["inspecoes-suite", vars.residenteId] });
    },
  });
}
