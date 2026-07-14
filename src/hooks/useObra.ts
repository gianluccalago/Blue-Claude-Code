import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadFotoObra } from "@/lib/storage";
import { podeIniciarFase, somaPesos } from "@/lib/obra";
import { hojeISO } from "@/lib/utils";
import type { ObraChecklistExecucao, ObraEtapa, ObraFase } from "@/types/database";

// ===========================================================================
// Módulo Obra — Fases 0/1: feature flag, fases, etapas binárias e checklist
// de execução (verificação in loco com foto obrigatória). RLS no banco:
// master/direção total; obra_prestador só leitura da estrutura física.
// ===========================================================================

/** Feature flag do módulo (linha legível por qualquer autenticado). */
export function useObraAtiva() {
  return useQuery({
    queryKey: ["obra-ativa"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from("obra_config")
        .select("valor")
        .eq("chave", "modulo_obra_ativo")
        .maybeSingle();
      // Tabela ausente (migration não rodada) ou flag desligada → módulo oculto.
      if (error) return false;
      return data?.valor === "true";
    },
  });
}

export function useFasesObra() {
  return useQuery({
    queryKey: ["obra-fases"],
    queryFn: async (): Promise<ObraFase[]> => {
      const { data, error } = await supabase.from("obra_fases").select("*").order("numero");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Todas as etapas de todas as fases (48 linhas — filtra-se em memória). */
export function useEtapasObra() {
  return useQuery({
    queryKey: ["obra-etapas"],
    queryFn: async (): Promise<ObraEtapa[]> => {
      const { data, error } = await supabase.from("obra_etapas").select("*").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Todo o checklist de execução (estado atual das etapas + galeria). */
export function useChecklistObra() {
  return useQuery({
    queryKey: ["obra-checklist"],
    queryFn: async (): Promise<ObraChecklistExecucao[]> => {
      const { data, error } = await supabase
        .from("obra_checklist_execucao")
        .select("*")
        .order("registrado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidarObra(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["obra-fases"] });
  qc.invalidateQueries({ queryKey: ["obra-etapas"] });
  qc.invalidateQueries({ queryKey: ["obra-checklist"] });
}

/**
 * Registra uma verificação in loco de etapa. FOTO OBRIGATÓRIA (princípio do
 * módulo: binário verificável + evidência datada). Reabrir = novo registro
 * com concluido=false e justificativa.
 */
export function useRegistrarVerificacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      etapaId: string;
      faseNumero: number;
      concluido: boolean;
      foto: File;
      observacao?: string;
    }) => {
      const path = await uploadFotoObra(args.foto, args.faseNumero, args.etapaId);
      if (!path) throw new Error("Falha no upload da foto. A verificação exige foto — tente novamente.");
      const { error } = await supabase.from("obra_checklist_execucao").insert({
        etapa_id: args.etapaId,
        concluido: args.concluido,
        foto_url: path,
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
        perfil_registrador: usuarioAtual.perfil,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidarObra(qc),
  });
}

/**
 * Edita os pesos das etapas de uma fase (master, ANTES da 1ª medição — a
 * trava dura chega com o módulo de medições na Fase 2). Valida soma = 100.
 */
export function useAtualizarPesos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { pesos: { etapaId: string; pesoPct: number }[] }) => {
      const soma = somaPesos(args.pesos.map((p) => ({ peso_pct: p.pesoPct })));
      if (Math.round(soma * 100) / 100 !== 100) {
        throw new Error(`Os pesos precisam somar 100% (soma atual: ${soma.toFixed(2)}%).`);
      }
      for (const p of args.pesos) {
        const { error } = await supabase
          .from("obra_etapas")
          .update({ peso_pct: p.pesoPct })
          .eq("id", p.etapaId);
        if (error) throw error;
      }
    },
    onSuccess: () => invalidarObra(qc),
  });
}

/** Inicia uma fase respeitando a sequência contratual (TRP da anterior). */
export function useIniciarFase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { fase: ObraFase; todas: ObraFase[]; ipcaPct?: number | null }) => {
      const guarda = podeIniciarFase(args.fase, args.todas);
      if (!guarda.pode) throw new Error(guarda.motivo ?? "Fase não pode ser iniciada.");
      const { error } = await supabase
        .from("obra_fases")
        .update({
          status: "em_andamento",
          data_inicio: hojeISO(),
          ipca_pct: args.fase.reajustavel ? args.ipcaPct ?? null : null,
        })
        .eq("id", args.fase.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarObra(qc),
  });
}
