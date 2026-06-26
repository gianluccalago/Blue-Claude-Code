import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadPlanoSaude } from "@/lib/storage";
import type { PlanoAtencaoSaude } from "@/types/database";

// ===========================================================================
// Documento do Plano de Atenção à Saúde (RDC 502 Art. 36-38) — histórico de
// versões. Gestão pelo Master/RT. O app guarda/lembra; o plano é do RT.
// ===========================================================================

export function usePlanosSaude() {
  return useQuery({
    queryKey: ["planos-saude"],
    queryFn: async (): Promise<PlanoAtencaoSaude[]> => {
      const { data, error } = await supabase
        .from("plano_atencao_saude")
        .select("*")
        .order("elaborado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarPlano() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      versao: string;
      elaboradoEm: string;
      proximaRevisao?: string | null;
      avaliacaoAnualEm?: string | null;
      observacao?: string | null;
      arquivo?: File | null;
    }) => {
      let documentoUrl: string | null = null;
      if (args.arquivo) {
        documentoUrl = await uploadPlanoSaude(args.arquivo);
        if (!documentoUrl) throw new Error("Falha no upload do documento. Tente novamente.");
      }
      const { error } = await supabase.from("plano_atencao_saude").insert({
        versao: args.versao.trim(),
        elaborado_em: args.elaboradoEm,
        proxima_revisao: args.proximaRevisao || null,
        avaliacao_anual_em: args.avaliacaoAnualEm || null,
        documento_url: documentoUrl,
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["planos-saude"] }),
  });
}
