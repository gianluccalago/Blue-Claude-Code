import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";

// ===========================================================================
// Configuração simples da casa (tabela chave/valor). Hoje: telefone_plantao —
// número FIXO do aparelho do plantão (passa de mão entre os plantões; não é
// celular pessoal e não vem da escala). Leitura para todos; escrita Master/
// Administração (RLS reforça).
// ===========================================================================

export const CHAVE_TELEFONE_PLANTAO = "telefone_plantao";

/** Lê um valor de configuração por chave. */
export function useConfiguracao(chave: string) {
  return useQuery({
    queryKey: ["configuracao", chave],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from("configuracao")
        .select("valor")
        .eq("chave", chave)
        .maybeSingle();
      if (error) throw error;
      return data?.valor ?? null;
    },
  });
}

/** Telefone do plantão (atalho de leitura). */
export function useTelefonePlantao() {
  return useConfiguracao(CHAVE_TELEFONE_PLANTAO);
}

/** Salva (upsert) um valor de configuração. Escrita restrita por RLS. */
export function useSalvarConfiguracao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { chave: string; valor: string }) => {
      const { error } = await supabase.from("configuracao").upsert(
        {
          chave: args.chave,
          valor: args.valor,
          atualizado_em: new Date().toISOString(),
          atualizado_por: usuarioAtual.nome,
        },
        { onConflict: "chave" },
      );
      if (error) throw error;
    },
    onSuccess: (_r, args) => qc.invalidateQueries({ queryKey: ["configuracao", args.chave] }),
  });
}
