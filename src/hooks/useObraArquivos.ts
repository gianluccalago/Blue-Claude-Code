import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import { uploadArquivoObra } from "@/lib/storage";
import type { ObraArquivo } from "@/types/database";

// ===========================================================================
// Módulo Obra — repositório de ARQUIVOS do empreendimento (master/direção):
// contrato assinado, DWG/PDF de projetos (por atividade) e arquivos gerais.
// Storage: bucket `obra`, pasta arquivos/ (fora do alcance do prestador).
// ===========================================================================

const KEY = ["obra-arquivos"];

export function useObraArquivos() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<ObraArquivo[]> => {
      const { data, error } = await supabase
        .from("obra_arquivos")
        .select("*")
        .order("criado_em", { ascending: false });
      if (error) return [];
      return data ?? [];
    },
  });
}

/** Sobe VÁRIOS arquivos de uma vez (contrato / projeto de uma atividade / geral). */
export function useSubirArquivosObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      categoria: ObraArquivo["categoria"];
      disciplinaId?: string | null;
      arquivos: File[];
      observacao?: string;
    }) => {
      if (args.arquivos.length === 0) throw new Error("Selecione ao menos um arquivo.");
      for (const f of args.arquivos) {
        const pasta = args.disciplinaId ? `arquivos/${args.categoria}/${args.disciplinaId}` : `arquivos/${args.categoria}`;
        const path = await uploadArquivoObra(f, pasta);
        if (!path) throw new Error(`Falha no upload de "${f.name}". Tente novamente.`);
        const { error } = await supabase.from("obra_arquivos").insert({
          categoria: args.categoria,
          disciplina_id: args.disciplinaId ?? null,
          nome: f.name,
          arquivo_url: path,
          observacao: args.observacao?.trim() || null,
          registrado_por: usuarioAtual.nome,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useExcluirArquivoObra() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("obra_arquivos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
