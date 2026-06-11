import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { hojeISO } from "@/lib/utils";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { InspecaoSuite, InspecaoItem, TipoInspecao, StatusItemInspecao } from "@/types/database";

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Todas as inspeções de hoje (usadas para calcular status das suítes). */
export function useInspecoesHoje() {
  // Dia civil LOCAL (toISOString direto seria UTC e viraria o dia às 21h em SP).
  const hoje = hojeISO();
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
 * Grava uma inspeção e seus itens. Itens "nao_conforme" geram automaticamente
 * um chamado de manutenção (Bloco H2), evitando duplicação por inspecao_item_id.
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

      const { data: itensSalvos, error: errI } = await supabase
        .from("inspecao_item")
        .insert(
          args.itens.map((it) => ({
            inspecao_id: suite.id,
            item: it.item,
            status: it.status,
            observacao: it.observacao || null,
          }))
        )
        .select("id, item, status, observacao");
      if (errI) throw errI;

      const naoConformes = (itensSalvos ?? []).filter((it) => it.status === "nao_conforme");
      for (const item of naoConformes) {
        const { data: existente, error: errCheck } = await supabase
          .from("chamado_manutencao")
          .select("id")
          .eq("inspecao_item_id", item.id)
          .limit(1);
        if (errCheck) throw errCheck;
        if (existente && existente.length > 0) continue;

        const { error: errChamado } = await supabase.from("chamado_manutencao").insert({
          local: args.quarto ? `Quarto ${args.quarto}` : "Não informado",
          residente_id: args.residenteId,
          problema: item.observacao ? `${item.item} — ${item.observacao}` : item.item,
          urgencia: "media",
          aberto_por: usuarioAtual.nome,
          perfil_solicitante: "hotelaria",
          inspecao_item_id: item.id,
        });
        if (errChamado) throw errChamado;
      }

      return suite.id as string;
    },
    onSuccess: (_id, vars) => {
      const hoje = hojeISO();
      qc.invalidateQueries({ queryKey: ["inspecoes-hoje", hoje] });
      qc.invalidateQueries({ queryKey: ["inspecoes-suite", vars.residenteId] });
      qc.invalidateQueries({ queryKey: ["chamados-manutencao"] });
    },
  });
}
