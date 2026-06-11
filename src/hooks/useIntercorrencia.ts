import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { uploadFotoIntercorrencia } from "@/lib/storage";
import { CUIDADOR_ATUAL } from "@/data/profiles";

export function useRegistrarIntercorrencia() {
  return useMutation({
    mutationFn: async (args: {
      residenteId: string;
      tipo: string;
      observacao: string;
      foto?: File | null;
    }) => {
      let fotoUrl: string | null = null;
      if (args.foto) {
        fotoUrl = await uploadFotoIntercorrencia(args.foto, args.residenteId);
      }
      const { error } = await supabase.from("intercorrencia").insert({
        residente_id: args.residenteId,
        tipo: args.tipo,
        observacao: args.observacao.trim() || null,
        registrado_por: CUIDADOR_ATUAL.nome,
        foto_url: fotoUrl,
      });
      if (error) throw error;
    },
  });
}
