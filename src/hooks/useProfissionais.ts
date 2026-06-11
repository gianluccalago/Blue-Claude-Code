import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { FuncaoProfissional, Usuario, VinculoProfissional } from "@/types/database";

export interface ProfissionalValor {
  nome: string;
  email: string;
  funcao: FuncaoProfissional;
  vinculo: VinculoProfissional;
  registro_profissional: string | null;
  isento_ponto_app: boolean;
  ativo: boolean;
}

/**
 * Mapeia a função de escala para o perfil de sistema, sem quebrar os perfis
 * existentes: Cuidadora → "cuidador"; funções de enfermagem → "enfermagem".
 * A função (funcao) é o diferenciador fino dentro da escala.
 */
function perfilDaFuncao(funcao: FuncaoProfissional): "cuidador" | "enfermagem" {
  return funcao === "Cuidadora" ? "cuidador" : "enfermagem";
}

/**
 * Profissionais de escala = usuarios do grupo de cuidados (perfil cuidador ou
 * enfermagem). Os demais tipos (médico, multidisciplinar, nutricionista,
 * farmácia etc.) são geridos na tela Usuários e acessos do Master (MASTER-3),
 * não aqui — por isso filtramos por perfil e não por "funcao preenchida"
 * (multidisciplinar/nutricionista também usam funcao e não entram na escala).
 */
export function useProfissionais() {
  return useQuery({
    queryKey: ["profissionais"],
    queryFn: async (): Promise<Usuario[]> => {
      const { data, error } = await supabase.from("usuarios").select("*");
      if (error) throw error;
      const lista = (data ?? []).filter(
        (u) => u.perfil === "cuidador" || u.perfil === "enfermagem",
      );
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return lista;
    },
  });
}

export function useAdicionarProfissional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: ProfissionalValor) => {
      const { error } = await supabase.from("usuarios").insert({
        nome: v.nome,
        email: v.email.trim() || null,
        perfil: perfilDaFuncao(v.funcao),
        ativo: v.ativo,
        funcao: v.funcao,
        vinculo: v.vinculo,
        // Registro só faz sentido para enfermagem (cuidadora não tem COREN).
        registro_profissional: v.funcao === "Cuidadora" ? null : v.registro_profissional || null,
        isento_ponto_app: v.isento_ponto_app,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profissionais"] }),
  });
}

export function useEditarProfissional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; valor: ProfissionalValor }) => {
      const v = args.valor;
      const { error } = await supabase
        .from("usuarios")
        .update({
          nome: v.nome,
          email: v.email.trim() || null,
          perfil: perfilDaFuncao(v.funcao),
          ativo: v.ativo,
          funcao: v.funcao,
          vinculo: v.vinculo,
          registro_profissional:
            v.funcao === "Cuidadora" ? null : v.registro_profissional || null,
          isento_ponto_app: v.isento_ponto_app,
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profissionais"] }),
  });
}

/** Inativa (ativo=false) em vez de excluir. */
export function useInativarProfissional() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("usuarios").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profissionais"] }),
  });
}
