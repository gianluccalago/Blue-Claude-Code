import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

// ===========================================================================
// "Editar meu perfil" — disponível em TODOS os acessos. O nome de exibição é
// gravado pela função set_meu_nome (SECURITY DEFINER), que altera SOMENTE a
// coluna `nome` do próprio usuário (não toca em perfil/ativo) — preserva o RLS
// de usuarios. A senha é trocada direto pelo Supabase Auth.
// ===========================================================================

/** Atualiza o nome de exibição do PRÓPRIO usuário autenticado. */
export function useAtualizarMeuNome() {
  return useMutation({
    mutationFn: async (nome: string) => {
      const { error } = await supabase.rpc("set_meu_nome", { p_nome: nome });
      if (error) throw error;
    },
  });
}

/** Troca a senha do usuário autenticado (Supabase Auth). */
export function useAtualizarMinhaSenha() {
  return useMutation({
    mutationFn: async (novaSenha: string) => {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;
    },
  });
}
