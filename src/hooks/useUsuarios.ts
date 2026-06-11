import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { PerfilUsuario, Usuario } from "@/types/database";

// ===========================================================================
// MASTER-3 · Usuários e acessos — CRUD da tabela `usuarios` e gestão dos
// vínculos cuidador↔hóspede (cuidador_residente).
//
// PREPARAÇÃO PARA AUTENTICAÇÃO (ainda sem login):
//  - O `email` será o identificador de login de cada usuário.
//  - Cada perfil cairá direto nas suas telas (sem tela de seleção de perfil).
//  - Família verá apenas o `residente_vinculado`.
//  - Cuidador verá apenas seus hóspedes de `cuidador_residente`.
//  - Usuário inativo (ativo=false) NÃO loga e não aparece para seleção.
// Por isso inativamos (ativo=false) em vez de excluir — preserva histórico e
// as referências (turnos, cuidador_residente, registros).
// ===========================================================================

/** Valor do formulário de usuário. `perfil` já é o valor REAL do banco. */
export interface UsuarioValor {
  nome: string;
  email: string;
  perfil: PerfilUsuario;
  funcao: string | null;
  vinculo: string | null;
  registro_profissional: string | null;
  isento_ponto_app: boolean;
  // A remuneração (mensal/plantão) é gerida pela Administração (Remuneração da
  // equipe), não aqui — por isso não entra no cadastro de usuário do Master.
  residente_vinculado: string | null;
  ativo: boolean;
}

/** Todos os usuários, ordenados por nome. */
export function useUsuarios() {
  return useQuery({
    queryKey: ["usuarios"],
    queryFn: async (): Promise<Usuario[]> => {
      const { data, error } = await supabase.from("usuarios").select("*");
      if (error) throw error;
      const lista = data ?? [];
      lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
      return lista;
    },
  });
}

/** Monta o payload de insert/update a partir do valor do formulário. */
function paraRegistro(v: UsuarioValor) {
  return {
    nome: v.nome.trim(),
    email: v.email.trim() || null,
    perfil: v.perfil,
    ativo: v.ativo,
    funcao: v.funcao,
    vinculo: v.vinculo,
    registro_profissional: v.registro_profissional?.trim() || null,
    isento_ponto_app: v.isento_ponto_app,
    residente_vinculado: v.residente_vinculado,
  };
}

export function useCriarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: UsuarioValor) => {
      const { error } = await supabase.from("usuarios").insert(paraRegistro(v));
      if (error) throw error;
    },
    onSuccess: () => invalidarUsuarios(qc),
  });
}

export function useEditarUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; valor: UsuarioValor }) => {
      const { error } = await supabase
        .from("usuarios")
        .update(paraRegistro(args.valor))
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarUsuarios(qc),
  });
}

/** Ativa/inativa um usuário (inativo não loga; reativável). */
export function useDefinirAtivoUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("usuarios")
        .update({ ativo: args.ativo })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarUsuarios(qc),
  });
}

/** Define o horário fixo de trabalho (mensalistas administrativos/operacionais). */
export function useDefinirHorarioTrabalho() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; horario: string | null }) => {
      const { error } = await supabase
        .from("usuarios")
        .update({ horario_trabalho: args.horario?.trim() || null })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: () => invalidarUsuarios(qc),
  });
}

function invalidarUsuarios(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["usuarios"] });
  // O módulo de Escalas lista profissionais a partir de usuarios.
  qc.invalidateQueries({ queryKey: ["profissionais"] });
}

// ---------------------------------------------------------------------------
// Vínculo cuidador ↔ hóspede (cuidador_residente) — designação do checklist.
// ---------------------------------------------------------------------------

/** Residente_ids atendidos por um cuidador. */
export function useVinculosCuidador(cuidadorId: string | undefined) {
  return useQuery({
    queryKey: ["vinculos-cuidador", cuidadorId],
    enabled: !!cuidadorId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from("cuidador_residente")
        .select("residente_id")
        .eq("cuidador_id", cuidadorId!);
      if (error) throw error;
      return (data ?? []).map((l) => l.residente_id);
    },
  });
}

/** Liga ou desliga um hóspede de um cuidador (alimenta o checklist do cuidador). */
export function useAlternarVinculo(cuidadorId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { residenteId: string; vincular: boolean }) => {
      if (args.vincular) {
        const { error } = await supabase
          .from("cuidador_residente")
          .insert({ cuidador_id: cuidadorId, residente_id: args.residenteId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cuidador_residente")
          .delete()
          .eq("cuidador_id", cuidadorId)
          .eq("residente_id", args.residenteId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vinculos-cuidador", cuidadorId] });
      // O checklist do cuidador lê hospedes designados.
      qc.invalidateQueries({ queryKey: ["hospedes", cuidadorId] });
    },
  });
}
