import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadDocumentoInstitucional, removerDocumentoInstitucional } from "@/lib/storage";
import type { DocumentoInstitucional } from "@/types/database";

// ===========================================================================
// Documentação Institucional ("Documentos da casa") — Lei 13.725/04, RDC
// 283/05 → 502/21. Modelo LIVRE: Master/Administração/Direção adicionam,
// editam e excluem qualquer documento. Validade definida no envio (data ou
// "Não se aplica" = null). Bucket privado + URL assinada.
// ===========================================================================

export interface DadosDocumento {
  nome: string;
  identificador?: string | null;
  orgaoEmissor?: string | null;
  dataEmissao?: string | null;
  /** Data de vencimento; null = "Não se aplica". */
  dataValidade?: string | null;
  observacao?: string | null;
}

/** Todos os documentos, mais recentes primeiro. */
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

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["documentos-institucionais"] });
}

/** Adiciona um documento (upload obrigatório do arquivo). */
export function useRegistrarDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: DadosDocumento & { arquivo: File }) => {
      const path = await uploadDocumentoInstitucional(args.arquivo);
      if (!path) throw new Error("Falha no upload do arquivo. Tente novamente.");
      const { error } = await supabase.from("documento_institucional").insert({
        nome: args.nome.trim(),
        identificador: args.identificador?.trim() || null,
        orgao_emissor: args.orgaoEmissor?.trim() || null,
        data_emissao: args.dataEmissao || null,
        data_validade: args.dataValidade || null,
        arquivo_url: path,
        observacao: args.observacao?.trim() || null,
        registrado_por: usuarioAtual.nome,
      });
      if (error) {
        await removerDocumentoInstitucional(path); // não deixa arquivo órfão
        throw error;
      }
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Edita os dados de um documento; opcionalmente substitui o arquivo. */
export function useAtualizarDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: DadosDocumento & { id: string; arquivoAtual: string; novoArquivo?: File | null }) => {
      let arquivoUrl = args.arquivoAtual;
      if (args.novoArquivo) {
        const path = await uploadDocumentoInstitucional(args.novoArquivo);
        if (!path) throw new Error("Falha no upload do novo arquivo. Tente novamente.");
        arquivoUrl = path;
      }
      const { error } = await supabase
        .from("documento_institucional")
        .update({
          nome: args.nome.trim(),
          identificador: args.identificador?.trim() || null,
          orgao_emissor: args.orgaoEmissor?.trim() || null,
          data_emissao: args.dataEmissao || null,
          data_validade: args.dataValidade || null,
          observacao: args.observacao?.trim() || null,
          arquivo_url: arquivoUrl,
        })
        .eq("id", args.id);
      if (error) throw error;
      // Só remove o arquivo antigo depois de o update dar certo.
      if (args.novoArquivo && arquivoUrl !== args.arquivoAtual) {
        await removerDocumentoInstitucional(args.arquivoAtual);
      }
    },
    onSuccess: () => invalidar(qc),
  });
}

/** Exclui um documento (registro + arquivo do storage). */
export function useExcluirDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; arquivoUrl: string }) => {
      const { error } = await supabase.from("documento_institucional").delete().eq("id", args.id);
      if (error) throw error;
      await removerDocumentoInstitucional(args.arquivoUrl);
    },
    onSuccess: () => invalidar(qc),
  });
}
