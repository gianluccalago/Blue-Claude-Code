import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadCarteiraVacinal } from "@/lib/storage";
import { hojeISO } from "@/lib/utils";
import type { CarteiraVacinal, VacinaRegistro } from "@/types/database";

// ===========================================================================
// Controle de vacinação (RDC 502/2021 Art. 39). Coordenação/Médico anexam;
// Master/RT acompanha a cobertura. Dado de saúde — restrito (RLS), sem família.
// ===========================================================================

/** Todas as carteiras (para o painel de cobertura do RT). */
export function useCarteirasVacinais() {
  return useQuery({
    queryKey: ["carteiras-vacinais"],
    queryFn: async (): Promise<CarteiraVacinal[]> => {
      const { data, error } = await supabase
        .from("carteira_vacinal")
        .select("*")
        .order("data_upload", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Histórico de carteiras de um residente (mais recente primeiro). */
export function useCarteirasDoResidente(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["carteiras-vacinais", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<CarteiraVacinal[]> => {
      const { data, error } = await supabase
        .from("carteira_vacinal")
        .select("*")
        .eq("residente_id", residenteId as string)
        .order("data_upload", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidarCarteiras(qc: ReturnType<typeof useQueryClient>, residenteId: string) {
  qc.invalidateQueries({ queryKey: ["carteiras-vacinais"] });
  qc.invalidateQueries({ queryKey: ["carteiras-vacinais", residenteId] });
}

/** Faz upload do arquivo (bucket privado) e registra a versão da carteira. */
export function useUploadCarteira() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      arquivo: File;
      atualizadaEm?: string | null;
      observacao?: string | null;
    }) => {
      const path = await uploadCarteiraVacinal(args.arquivo, args.residenteId);
      if (!path) throw new Error("Falha no upload do arquivo. Tente novamente.");
      const { error } = await supabase.from("carteira_vacinal").insert({
        residente_id: args.residenteId,
        arquivo_url: path,
        data_upload: hojeISO(),
        atualizada_em: args.atualizadaEm || hojeISO(),
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: (_d, args) => invalidarCarteiras(qc, args.residenteId),
  });
}

// ─── Registro vacina a vacina (complemento) ───────────────────────────────────

export function useVacinasDoResidente(residenteId: string | undefined) {
  return useQuery({
    queryKey: ["vacinas-residente", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<VacinaRegistro[]> => {
      const { data, error } = await supabase
        .from("vacina_registro")
        .select("*")
        .eq("residente_id", residenteId as string)
        .order("data_aplicacao", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useRegistrarVacina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteId: string; vacina: string; dataAplicacao?: string | null; dose?: string | null }) => {
      const { error } = await supabase.from("vacina_registro").insert({
        residente_id: args.residenteId,
        vacina: args.vacina.trim(),
        data_aplicacao: args.dataAplicacao || null,
        dose: args.dose?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: (_d, args) => qc.invalidateQueries({ queryKey: ["vacinas-residente", args.residenteId] }),
  });
}

export function useExcluirVacina() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; residenteId: string }) => {
      const { error } = await supabase.from("vacina_registro").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_d, args) => qc.invalidateQueries({ queryKey: ["vacinas-residente", args.residenteId] }),
  });
}
