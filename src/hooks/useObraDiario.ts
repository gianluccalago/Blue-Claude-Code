import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadArquivoObra } from "@/lib/storage";
import type { ObraDiario } from "@/types/database";

// ===========================================================================
// DIÁRIO DE OBRA (RDO) — compartilhado: Contratante e construtora registram
// e leem; exclusão só master/direção. Fotos em tabela filha (várias por dia).
// ===========================================================================

const KEY = ["obra-diario"];
const KEY_FOTOS = ["obra-diario-fotos"];

export function useDiarioObra() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ObraDiario[]> => {
      const { data, error } = await supabase
        .from("obra_diario")
        .select("*")
        .order("data", { ascending: false })
        .order("criado_em", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

/** Fotos de todos os registros (agrupa-se por registro_id em memória). */
export function useFotosDiario() {
  return useQuery({
    queryKey: KEY_FOTOS,
    queryFn: async (): Promise<{ id: string; registro_id: string; foto_url: string }[]> => {
      const { data, error } = await supabase
        .from("obra_diario_foto")
        .select("id, registro_id, foto_url")
        .order("criado_em");
      if (error) return [];
      return data ?? [];
    },
  });
}

export interface RegistroDiarioInput {
  data: string;
  climaManha: "bom" | "nublado" | "chuva" | null;
  climaTarde: "bom" | "nublado" | "chuva" | null;
  chuvaImpeditiva: boolean;
  paralisacao: boolean;
  efetivo: number | null;
  atividades: string;
  ocorrencias: string;
  fotos: File[];
}

export function useCriarRegistroDiario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: RegistroDiarioInput) => {
      if (!v.atividades.trim() && !v.ocorrencias.trim()) {
        throw new Error("Descreva as atividades do dia ou as ocorrências.");
      }
      const { data: reg, error } = await supabase
        .from("obra_diario")
        .insert({
          data: v.data,
          ocorrencias: v.ocorrencias.trim() || "—",
          atividades: v.atividades.trim() || null,
          clima_manha: v.climaManha,
          clima_tarde: v.climaTarde,
          chuva_impeditiva: v.chuvaImpeditiva,
          paralisacao: v.paralisacao,
          efetivo: v.efetivo,
          registrado_por: usuarioAtual.nome,
          perfil_registrador: usuarioAtual.perfil,
        })
        .select("id")
        .single();
      if (error) throw error;
      for (const f of v.fotos) {
        const path = await uploadArquivoObra(f, `diario/${v.data}`);
        if (!path) throw new Error(`Falha no upload de "${f.name}".`);
        const { error: e2 } = await supabase
          .from("obra_diario_foto")
          .insert({ registro_id: reg.id, foto_url: path });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: KEY_FOTOS });
    },
  });
}

/** Exclui um registro (master/direção; fotos caem por cascade). */
export function useExcluirRegistroDiario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_diario").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: KEY_FOTOS });
    },
  });
}
