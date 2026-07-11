import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadDocumentoInstitucional } from "@/lib/storage";
import type { DocumentoInstitucional } from "@/types/database";

// ===========================================================================
// Documentos institucionais da ILPI ("Documentos da casa") — Lei 13.725/04,
// RDC 283/05 → 502/21. Master, Administração e Direção compilam/renovam.
// Molde: useVacinacao.ts (upload em bucket privado + registro com histórico).
// ===========================================================================

/** Todos os documentos, mais recentes primeiro (o vigente de cada tipo é o 1º). */
export function useDocumentosInstitucionais() {
  return useQuery({
    queryKey: ["documentos-institucionais"],
    queryFn: async (): Promise<DocumentoInstitucional[]> => {
      const { data, error } = await supabase
        .from("documento_institucional")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Faz upload do arquivo (bucket privado) e registra a versão do documento. */
export function useRegistrarDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      tipo: string;
      nome: string;
      arquivo: File;
      identificador?: string | null;
      orgaoEmissor?: string | null;
      dataEmissao?: string | null;
      dataValidade?: string | null;
      observacao?: string | null;
    }) => {
      const path = await uploadDocumentoInstitucional(args.arquivo, args.tipo);
      if (!path) throw new Error("Falha no upload do arquivo. Tente novamente.");
      const { error } = await supabase.from("documento_institucional").insert({
        tipo: args.tipo,
        nome: args.nome.trim(),
        identificador: args.identificador?.trim() || null,
        orgao_emissor: args.orgaoEmissor?.trim() || null,
        data_emissao: args.dataEmissao || null,
        data_validade: args.dataValidade || null,
        arquivo_url: path,
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documentos-institucionais"] }),
  });
}
