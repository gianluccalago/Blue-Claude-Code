// ===========================================================================
// Mensagens de erro para o usuário. O PostgREST/Supabase devolve texto cru em
// inglês ("new row violates row-level security policy", "duplicate key…");
// nossas RPCs e triggers já falam português — essas passam como estão.
// ===========================================================================

const PT_BR = /[ãõçáéíóúâêôà]|\b(não|já|perfil|senha|informe|valor|data|obrigat|permiss|apenas|somente|precisa|confira)\b/i;

export function mensagemAmigavel(e: unknown, padrao = "Não foi possível concluir. Tente de novo."): string {
  const err = (e ?? {}) as { code?: string; message?: string; details?: string; hint?: string };
  const code = String(err.code ?? "");
  const bruto = String(err.message ?? "");
  const msg = bruto.toLowerCase();

  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) {
    return "Seu perfil não tem permissão para esta ação.";
  }
  if (code === "23505" || msg.includes("duplicate key")) return "Já existe um registro igual a este.";
  if (code === "23503" || msg.includes("foreign key")) return "Este registro está ligado a outros e não pode ser alterado assim.";
  if (code === "23514" || msg.includes("check constraint")) return "Algum valor está fora do permitido. Confira os campos.";
  if (code === "23502" || msg.includes("not-null")) return "Falta preencher um campo obrigatório.";
  if (code === "PGRST116") return "Registro não encontrado.";
  if (msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed") || msg.includes("network request failed")) {
    return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  }
  if (msg.includes("jwt") || msg.includes("invalid token") || msg.includes("refresh_token")) {
    return "Sua sessão expirou. Entre de novo.";
  }
  if (bruto && PT_BR.test(bruto)) return bruto;
  return padrao;
}
