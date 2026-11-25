import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { usuarioAtual } from "@/auth/usuarioAtual";
import type { TabelaServico } from "@/types/database";

// Serviços cobrados à parte (Anexo II do contrato), com o preço de tabela.
// Lê: Administração, Direção e Master. Edita: Direção e Master (RLS, 0155).

const KEY = ["tabela-servico"];

export function useTabelaServico() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<TabelaServico[]> => {
      const { data, error } = await supabase.from("tabela_servico").select("*").order("ordem").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSalvarServico() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id?: string; nome: string; valor: number | null; unidade: string; categoria_upselling: string; ativo: boolean; ordem?: number }) => {
      const linha = {
        nome: v.nome.trim(),
        valor: v.valor,
        unidade: v.unidade.trim(),
        categoria_upselling: v.categoria_upselling,
        ativo: v.ativo,
        atualizado_em: new Date().toISOString(),
        atualizado_por: usuarioAtual.nome,
      };
      if (!linha.nome) throw new Error("Informe o nome do serviço.");
      if (!linha.unidade) throw new Error("Informe a unidade (mensal, por sessão…).");
      const { error } = v.id
        ? await supabase.from("tabela_servico").update(linha).eq("id", v.id)
        : await supabase.from("tabela_servico").insert({ ...linha, ordem: v.ordem ?? 99 });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
