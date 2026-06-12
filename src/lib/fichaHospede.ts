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

// Financeiro (mensalidade/status de pagamento) é dado SENSÍVEL: só gestão
// administrativa e Master. Nem clínica (médico/coordenação) vê valores.
const PERFIS_VE_FINANCEIRO: ReadonlySet<PerfilUsuario> = new Set(["master", "administracao"]);

/** Ficha completa (plano de saúde/contatos/clínico) vs assistencial. */
export function fichaCompleta(perfil: PerfilUsuario | undefined): boolean {
  return !!perfil && PERFIS_FICHA_COMPLETA.has(perfil);
}

/** Pode ver o resumo FINANCEIRO (mensalidade/status) — só Administração e Master. */
export function podeVerFinanceiro(perfil: PerfilUsuario | undefined): boolean {
  return !!perfil && PERFIS_VE_FINANCEIRO.has(perfil);
}

/** Pode editar os dados cadastrais e enviar foto do hóspede. */
export function podeEditarFicha(perfil: PerfilUsuario | undefined): boolean {
  return !!perfil && PERFIS_EDITA_FICHA.has(perfil);
}
