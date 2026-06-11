import type { PerfilUsuario } from "@/types/database";

// ===========================================================================
// Identidade do usuário ATUAL (autenticado).
//
// Objeto MUTÁVEL de propósito: o AuthProvider o atualiza a cada login/logout.
// Os hooks dos vários perfis (checklist, nutrição, atividades, família,
// administração…) leem `nome`/`id` daqui no momento da escrita, passando a
// registrar o usuário autenticado sem reescrever cada hook.
//
// Valor inicial = Ana Paula (seed) só para não quebrar antes do login; depois
// do login é sobrescrito pelo usuário autenticado (ver setUsuarioAtual).
// ===========================================================================

export interface UsuarioAtual {
  id: string;
  nome: string;
  perfil: PerfilUsuario;
  /** Residente vinculado (perfil família); null nos demais. */
  residenteVinculado: string | null;
}

const PADRAO: UsuarioAtual = {
  id: "b0000000-0000-0000-0000-000000000004",
  nome: "Ana Paula",
  perfil: "cuidador",
  residenteVinculado: null,
};

/** Mesma referência durante toda a vida do app (mutada in-place). */
export const usuarioAtual: UsuarioAtual = { ...PADRAO };

/**
 * Identidade da família atual usada pelo Portal da Família. As telas leem
 * `residenteId` e `nome`. Sob autenticação, o residenteId vem do
 * residente_vinculado do usuário-família logado — garantindo que cada família
 * veja SOMENTE o seu hóspede.
 */
export const familiaAtual = {
  nome: PADRAO.nome,
  residenteId: "",
};

/** Atualiza a identidade atual (chamado pelo AuthProvider). */
export function setUsuarioAtual(u: UsuarioAtual | null) {
  const v = u ?? PADRAO;
  usuarioAtual.id = v.id;
  usuarioAtual.nome = v.nome;
  usuarioAtual.perfil = v.perfil;
  usuarioAtual.residenteVinculado = v.residenteVinculado;
  familiaAtual.nome = v.nome;
  familiaAtual.residenteId = v.residenteVinculado ?? "";
}
