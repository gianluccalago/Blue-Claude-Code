import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ===========================================================================
// Foto do usuário (equipe). A escrita usa a função `set_minha_foto`
// (SECURITY DEFINER) que altera SOMENTE a foto_url do próprio usuário — não
// permite mexer em perfil/ativo, preservando o RLS de usuarios.
// A Família não usa foto própria: a interface espelha a foto do hóspede
// vinculado (useFotoResidente).
// ===========================================================================

/** Define (ou remove, com null) a foto do PRÓPRIO usuário autenticado. */
export function useDefinirMinhaFoto() {
  return useMutation({
    mutationFn: async (fotoUrl: string | null) => {
      const { error } = await supabase.rpc("set_minha_foto", { p_url: fotoUrl });
      if (error) throw error;
    },
  });
}

/** Foto de um hóspede (para a Família espelhar a foto do hóspede vinculado). */
export function useFotoResidente(residenteId: string | null | undefined) {
  return useQuery({
    queryKey: ["foto-residente", residenteId],
    enabled: !!residenteId,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("residentes")
        .select("foto_url")
        .eq("id", residenteId as string)
        .maybeSingle();
      if (error) throw error;
      return data?.foto_url ?? null;
    },
  });
}
