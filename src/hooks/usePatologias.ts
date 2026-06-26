import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { consolidarPrevalentes, type PrevalenteItem } from "@/lib/planoSaude";
import type { PatologiaResidente, Residente } from "@/types/database";

// ===========================================================================
// Patologias/comorbidades (RDC 502 Art. 37). Coordenação/Médico registram;
// Master/RT consolida. Dado clínico restrito — sem família.
// ===========================================================================

export function usePatologiasResidente(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["patologias", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<PatologiaResidente[]> => {
      const { data, error } = await supabase
        .from("patologia_residente")
        .select("*")
        .eq("residente_id", residenteId as string)
        .order("ativa", { ascending: false })
        .order("descricao");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>, residenteId: string) {
  qc.invalidateQueries({ queryKey: ["patologias", residenteId] });
  qc.invalidateQueries({ queryKey: ["patologias-prevalentes"] });
}

export function useAddPatologia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteId: string; descricao: string; cid?: string | null; observacao?: string | null }) => {
      const { error } = await supabase.from("patologia_residente").insert({
        residente_id: args.residenteId,
        descricao: args.descricao.trim(),
        cid_codigo: args.cid?.trim() || null,
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: (_d, args) => invalidar(qc, args.residenteId),
  });
}

export function useTogglePatologia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; residenteId: string; ativa: boolean }) => {
      const { error } = await supabase.from("patologia_residente").update({ ativa: args.ativa }).eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_d, args) => invalidar(qc, args.residenteId),
  });
}

export function useExcluirPatologia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; residenteId: string }) => {
      const { error } = await supabase.from("patologia_residente").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_d, args) => invalidar(qc, args.residenteId),
  });
}

// ─── Consolidação (Master/RT) ─────────────────────────────────────────────────

export interface Prevalentes {
  itens: PrevalenteItem[];
  totalAtivos: number;
}

export function usePatologiasPrevalentes() {
  return useQuery({
    queryKey: ["patologias-prevalentes"],
    queryFn: async (): Promise<Prevalentes> => {
      const [patResp, resisResp] = await Promise.all([
        supabase.from("patologia_residente").select("*").eq("ativa", true),
        supabase.from("residentes").select("id").eq("status_hospede", "ativo"),
      ]);
      if (patResp.error) throw patResp.error;
      if (resisResp.error) throw resisResp.error;
      const idsAtivos = new Set((resisResp.data ?? []).map((r) => r.id));
      return { itens: consolidarPrevalentes(patResp.data ?? [], idsAtivos), totalAtivos: idsAtivos.size };
    },
  });
}

/** Recursos de saúde por residente ativo (hospital de referência + plano). */
export function useRecursosSaude() {
  return useQuery({
    queryKey: ["recursos-saude"],
    queryFn: async (): Promise<Residente[]> => {
      const { data, error } = await supabase
        .from("residentes")
        .select("*")
        .eq("status_hospede", "ativo")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}
