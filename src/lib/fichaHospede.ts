import type { PerfilUsuario } from "@/types/database";

// ===========================================================================
// Regras de visibilidade/edição da Ficha do Hóspede por perfil.
//  - COMPLETA: financeiro, plano de saúde detalhado e todos os contatos.
//  - ASSISTENCIAL: foco operacional/clínico; OCULTA financeiro, plano de
//    saúde detalhado e contatos financeiros.
//  - Edição de cadastro + upload de foto: só gestão.
//  - Família NÃO recebe ficha (a rota nem é exposta a ela).
// ===========================================================================

const PERFIS_FICHA_COMPLETA: ReadonlySet<PerfilUsuario> = new Set([
  "master",
  "coordenacao",
  "administracao",
  "medico",
]);

const PERFIS_EDITA_FICHA: ReadonlySet<PerfilUsuario> = new Set([
  "master",
  "coordenacao",
  "administracao",
]);

/** Ficha completa (financeiro/plano de saúde/contatos) vs assistencial. */
export function fichaCompleta(perfil: PerfilUsuario | undefined): boolean {
  return !!perfil && PERFIS_FICHA_COMPLETA.has(perfil);
}

/** Pode editar os dados cadastrais e enviar foto do hóspede. */
export function podeEditarFicha(perfil: PerfilUsuario | undefined): boolean {
  return !!perfil && PERFIS_EDITA_FICHA.has(perfil);
}
