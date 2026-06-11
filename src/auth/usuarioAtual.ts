import type { PerfilUsuario } from "@/types/database";

// ===========================================================================
// Identidade do usuário ATUAL (autenticado).
//
// Este objeto é MUTÁVEL de propósito: o AuthProvider o atualiza a cada
// login/logout. Os hooks legados (checklist, eliminação, medicação, ponto,
// plantão…) leem `id`/`nome` daqui no momento da escrita, então passam a
// registrar o usuário autenticado sem precisar reescrever cada hook.
//
// O valor inicial é a Ana Paula (seed) apenas para não quebrar em
// desenvolvimento antes do login; após o login real ele é sobrescrito pelo
// usuário autenticado (ver setUsuarioAtual).
// ===========================================================================

export interface UsuarioAtual {
  id: string;
  nome: string;
  perfil: PerfilUsuario;
}

const PADRAO: UsuarioAtual = {
  id: "b0000000-0000-0000-0000-000000000004",
  nome: "Ana Paula",
  perfil: "cuidador",
};

/** Mesma referência durante toda a vida do app (mutada in-place). */
export const usuarioAtual: UsuarioAtual = { ...PADRAO };

/** Atualiza a identidade atual (chamado pelo AuthProvider). */
export function setUsuarioAtual(u: UsuarioAtual | null) {
  const v = u ?? PADRAO;
  usuarioAtual.id = v.id;
  usuarioAtual.nome = v.nome;
  usuarioAtual.perfil = v.perfil;
}
