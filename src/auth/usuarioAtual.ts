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
  /** Registro profissional (CRM/COREN/CRN…), quando houver. */
  registro: string | null;
}

const PADRAO: UsuarioAtual = {
  id: "b0000000-0000-0000-0000-000000000004",
  nome: "Ana Paula",
  perfil: "cuidador",
  residenteVinculado: null,
  registro: null,
};

/** Mesma referência durante toda a vida do app (mutada in-place). */
export const usuarioAtual: UsuarioAtual = { ...PADRAO };

/**
 * Identidade do usuário REALMENTE autenticado, IGNORANDO o Modo Camaleão.
 * Quando o Master encarna outro perfil, `usuarioAtual` vira o encarnado, mas
 * `usuarioAutenticado` continua sendo o Master. Usada onde a autoria legal
 * importa: o médico prescritor de uma receita é SEMPRE o usuário real
 * (se o Master prescreve via Camaleão, o prescritor é o Master — que também é
 * médico —, nunca o perfil encarnado).
 */
export const usuarioAutenticado: UsuarioAtual = { ...PADRAO };

/** Atualiza a identidade REAL (chamado pelo AuthProvider; ignora Camaleão). */
export function setUsuarioAutenticado(u: UsuarioAtual | null) {
  const v = u ?? PADRAO;
  usuarioAutenticado.id = v.id;
  usuarioAutenticado.nome = v.nome;
  usuarioAutenticado.perfil = v.perfil;
  usuarioAutenticado.residenteVinculado = v.residenteVinculado;
  usuarioAutenticado.registro = v.registro;
}

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
  usuarioAtual.registro = v.registro;
  familiaAtual.nome = v.nome;
  familiaAtual.residenteId = v.residenteVinculado ?? "";
}
