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
  "enfermeira",
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

// O GRAU REAL (último IVCF / grau_dependencia) é uma leitura CLÍNICA. A ponta
// assistencial (cuidadoras e enfermagem) cuida pelo GRAU DE INGRESSO (contratual,
// o que foi contratado/dimensionado); expor o grau real ali só gera ancoragem e
// ruído. Por isso o grau real fica OCULTO para esses perfis — eles veem apenas o
// grau contratual. Gestão e clínica de retaguarda (Master, Médico, Coordenação,
// Administração, Direção) continuam vendo contratual × real para gerir a
// divergência (gatilho de revisão de grau).
const PERFIS_OCULTA_GRAU_REAL: ReadonlySet<PerfilUsuario> = new Set([
  "cuidador",
  "enfermagem",
  "enfermeira",
]);

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

/**
 * Pode ver o GRAU REAL (último IVCF / grau_dependencia). Cuidadoras e enfermagem
 * só veem o grau de ingresso (contratual). Default seguro: perfil desconhecido
 * NÃO vê o grau real (não vaza leitura clínica para fora dos perfis previstos).
 */
export function podeVerGrauReal(perfil: PerfilUsuario | undefined): boolean {
  return !!perfil && !PERFIS_OCULTA_GRAU_REAL.has(perfil);
}
