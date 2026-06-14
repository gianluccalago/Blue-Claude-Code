import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { NovaEscala } from "@/lib/cozinha";
import type {
  CozinhaEscala,
  CozinhaFuncionario,
  Database,
} from "@/types/database";

// ===========================================================================
// Escala da cozinha (BLOCO N5). Independente da escala assistencial e do ponto;
// é controle interno da Nutricionista (RLS: nutricionista + master).
// ===========================================================================

const FUNC_KEY = ["cozinha-funcionarios"];
const ESCALA_KEY = ["cozinha-escala"];

type FuncionarioInsert = Database["public"]["Tables"]["cozinha_funcionario"]["Insert"];

/** Equipe da cozinha (cadastro completo — ativos e inativos). */
export function useFuncionariosCozinha() {
  return useQuery({
    queryKey: FUNC_KEY,
    queryFn: async (): Promise<CozinhaFuncionario[]> => {
      const { data, error } = await supabase
        .from("cozinha_funcionario")
        .select("*")
        .order("grupo", { ascending: true })
        .order("funcao", { ascending: true })
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Cria ou atualiza um funcionário da cozinha. */
export function useSalvarFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FuncionarioInsert & { id?: string }) => {
      if (input.id) {
        const { id, ...patch } = input;
        const { error } = await supabase.from("cozinha_funcionario").update(patch).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cozinha_funcionario").insert(input);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNC_KEY }),
  });
}

/** Ativa/inativa um funcionário (não apaga histórico de escala). */
export function useDefinirAtivoFuncionario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("cozinha_funcionario").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: FUNC_KEY }),
  });
}

/** Escala num período [de, ate] (datas ISO inclusivas). */
export function useEscalaCozinha(de: string, ate: string) {
  return useQuery({
    queryKey: [...ESCALA_KEY, de, ate],
    queryFn: async (): Promise<CozinhaEscala[]> => {
      const { data, error } = await supabase
        .from("cozinha_escala")
        .select("*")
        .gte("data", de)
        .lte("data", ate)
        .order("data", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Insere em lote as linhas de escala geradas automaticamente. */
export function useGerarEscala() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novas: NovaEscala[]) => {
      if (novas.length === 0) return 0;
      const { error } = await supabase.from("cozinha_escala").insert(novas);
      if (error) throw error;
      return novas.length;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ESCALA_KEY }),
  });
}

/** Ajuste manual de uma linha (troca de pessoa, presença/falta, observação). */
export function useAtualizarEscala() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<CozinhaEscala, "funcionario_id" | "presente" | "observacao" | "inicio" | "fim">>;
    }) => {
      const { error } = await supabase.from("cozinha_escala").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ESCALA_KEY }),
  });
}

/** Remove uma linha de escala (folga/cancelamento pontual). */
export function useRemoverEscala() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cozinha_escala").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ESCALA_KEY }),
  });
}
