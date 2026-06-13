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
  "direcao",
  "medico",
]);

const PERFIS_EDITA_FICHA: ReadonlySet<PerfilUsuario> = new Set([
  "master",
  "coordenacao",
  "administracao",
  "direcao",
]);

// Financeiro (mensalidade/status de pagamento) é dado SENSÍVEL: só gestão
// administrativa, Direção e Master. Nem clínica (médico/coordenação) vê valores.
const PERFIS_VE_FINANCEIRO: ReadonlySet<PerfilUsuario> = new Set(["master", "administracao", "direcao"]);

// Perfis puramente ADMINISTRATIVOS: gerem o hóspede pelo lado de gestão/
// financeiro, sem atuar no cuidado. Para eles o alerta de alergia é só ruído.
const PERFIS_ADMINISTRATIVO: ReadonlySet<PerfilUsuario> = new Set(["administracao", "direcao"]);

/** Ficha completa (plano de saúde/contatos/clínico) vs assistencial. */
export function fichaCompleta(perfil: PerfilUsuario | undefined): boolean {
  return !!perfil && PERFIS_FICHA_COMPLETA.has(perfil);
}

/** Pode ver o resumo FINANCEIRO (mensalidade/status) — só Administração e Master. */
export function podeVerFinanceiro(perfil: PerfilUsuario | undefined): boolean {
  return !!perfil && PERFIS_VE_FINANCEIRO.has(perfil);
}

/**
 * O alerta de ALERGIA é segurança CLÍNICA/ASSISTENCIAL: só faz sentido para
 * quem lida com cuidado/medicação. Some nos perfis administrativos puros
 * (Administração/Direção). Default seguro: mostra quando o perfil é desconhecido.
 */
export function podeVerAlergias(perfil: PerfilUsuario | undefined): boolean {
  return !perfil || !PERFIS_ADMINISTRATIVO.has(perfil);
}

/** Pode editar os dados cadastrais e enviar foto do hóspede. */
export function podeEditarFicha(perfil: PerfilUsuario | undefined): boolean {
  return !!perfil && PERFIS_EDITA_FICHA.has(perfil);
}
