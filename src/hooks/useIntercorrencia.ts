import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { CUIDADOR_ATUAL } from "@/data/profiles";

export function useRegistrarIntercorrencia() {
  return useMutation({
    mutationFn: async (args: { residenteId: string; tipo: string; observacao: string }) => {
      const { error } = await supabase.from("intercorrencia").insert({
        residente_id: args.residenteId,
        tipo: args.tipo,
        observacao: args.observacao.trim() || null,
        registrado_por: CUIDADOR_ATUAL.nome,
      });
      if (error) throw error;
    },
  });
}
