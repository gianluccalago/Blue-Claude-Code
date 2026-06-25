import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { RecadoFamilia } from "@/types/database";

// ===========================================================================
// Recado da equipe para a família (0084). A Coordenação/Master escrevem; a
// família lê só os do seu residente vinculado (RLS). Toque humano — sem clínica.
// ===========================================================================

/** Recados de um hóspede, mais recentes primeiro. Serve família e gestão. */
export function useRecadosResidente(residenteId: string | undefined | null) {
  return useQuery({
    queryKey: ["recados-familia", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<RecadoFamilia[]> => {
      const { data, error } = await supabase
        .from("recado_familia")
        .select("*")
        .eq("residente_id", residenteId as string)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>, residenteId: string) {
  qc.invalidateQueries({ queryKey: ["recados-familia", residenteId] });
}

export function useCriarRecado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteId: string; mensagem: string }) => {
      const { error } = await supabase.from("recado_familia").insert({
        residente_id: args.residenteId,
        mensagem: args.mensagem.trim(),
        autor: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: (_d, args) => invalidar(qc, args.residenteId),
  });
}

export function useEditarRecado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; residenteId: string; mensagem: string }) => {
      const { error } = await supabase
        .from("recado_familia")
        .update({ mensagem: args.mensagem.trim() })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_d, args) => invalidar(qc, args.residenteId),
  });
}

export function useExcluirRecado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; residenteId: string }) => {
      const { error } = await supabase.from("recado_familia").delete().eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: (_d, args) => invalidar(qc, args.residenteId),
  });
}
