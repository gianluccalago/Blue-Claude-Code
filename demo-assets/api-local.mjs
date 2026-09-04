// ===========================================================================
// EMULADOR MÍNIMO DA API DO SUPABASE (só para gerar as capturas/vídeo).
// ---------------------------------------------------------------------------
// O app fala com o Supabase por HTTP (PostgREST + Auth). Aqui traduzimos
// essas chamadas para SQL no Postgres local que já tem o cenário da demo.
// NÃO faz parte do app; vive só em demo-assets/.
// ===========================================================================
import { execFileSync } from "node:child_process";

const PSQL = ["-h", "/tmp", "-p", "5439", "-U", "postgres", "-d", "blue", "-t", "-A", "-X"];

export function sql(texto) {
  const out = execFileSync("psql", [...PSQL, "-c", texto], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return out.trim();
}

/** Roda uma query e devolve JSON (array de linhas). */
export function consultar(select) {
  const json = sql(`select coalesce(json_agg(t), '[]'::json)::text from (${select}) t`);
  try { return JSON.parse(json || "[]"); } catch { return []; }
}

const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;

/** Traduz um filtro do PostgREST (ex.: "eq.abc", "in.(a,b)") para SQL. */
function filtro(coluna, expr) {
  const i = expr.indexOf(".");
  const op = expr.slice(0, i);
  const val = expr.slice(i + 1);
  const col = `"${coluna}"`;
  switch (op) {
    case "eq": return `${col} = ${lit(val)}`;
    case "neq": return `${col} <> ${lit(val)}`;
    case "gt": return `${col} > ${lit(val)}`;
    case "gte": return `${col} >= ${lit(val)}`;
    case "lt": return `${col} < ${lit(val)}`;
    case "lte": return `${col} <= ${lit(val)}`;
    case "like": return `${col}::text like ${lit(val.replace(/\*/g, "%"))}`;
    case "ilike": return `${col}::text ilike ${lit(val.replace(/\*/g, "%"))}`;
    case "is": return val === "null" ? `${col} is null` : `${col} is ${val}`;
    case "in": {
      const itens = val.replace(/^\(|\)$/g, "").split(",").map((s) => lit(s.replace(/^"|"$/g, "")));
      return itens.length ? `${col} in (${itens.join(", ")})` : "false";
    }
    case "not": return `not (${filtro(coluna, val)})`;
    default: return "true";
  }
}

/** Colunas do select do PostgREST; relações embutidas viram NULL (o app tolera). */
function colunas(select) {
  if (!select || select === "*") return "*";
  // Remove embeds "rel(...)" — o emulador não faz join; devolve as colunas simples.
  const semEmbed = select.replace(/[\w:]+\([^)]*\)/g, "").replace(/,\s*,/g, ",").replace(/^,|,$/g, "");
  if (!semEmbed.trim()) return "*";
  return semEmbed.split(",").map((c) => {
    const nome = c.trim().split(":").pop();
    return /^[a-z_][a-z0-9_]*$/i.test(nome) ? `"${nome}"` : null;
  }).filter(Boolean).join(", ") || "*";
}

/** GET /rest/v1/<tabela>?... → linhas. */
export function rest(caminho, params) {
  const tabela = caminho.replace(/^\/rest\/v1\//, "").split("?")[0];
  if (!/^[a-z_][a-z0-9_]*$/.test(tabela)) return [];
  const where = [];
  let order = "", limite = "";
  for (const [k, v] of params) {
    if (k === "select" || k === "apikey") continue;
    if (k === "order") {
      order = " order by " + v.split(",").map((o) => {
        const [c, dir, nulls] = o.split(".");
        return `"${c}" ${dir === "desc" ? "desc" : "asc"}${nulls === "nullslast" ? " nulls last" : ""}`;
      }).join(", ");
      continue;
    }
    if (k === "limit") { limite = ` limit ${parseInt(v, 10) || 100}`; continue; }
    if (k === "offset" || k === "on_conflict" || k === "columns") continue;
    if (/^[a-z_][a-z0-9_]*$/.test(k)) where.push(filtro(k, v));
  }
  const cols = colunas(params.get("select"));
  const q = `select ${cols} from public."${tabela}"${where.length ? " where " + where.join(" and ") : ""}${order}${limite}`;
  try { return consultar(q); } catch { return []; }
}

/** Sessão falsa no formato que o supabase-js espera (JWT não é verificado no cliente). */
export function sessaoFalsa(email, nome) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const agora = Math.floor(Date.now() / 1000);
  const payload = { sub: "de300020-0000-4000-8000-000000000001", email, role: "authenticated", aud: "authenticated", exp: agora + 86400, iat: agora, user_metadata: { nome } };
  const token = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}.demo`;
  const user = { id: payload.sub, aud: "authenticated", role: "authenticated", email, email_confirmed_at: new Date().toISOString(), app_metadata: { provider: "email", providers: ["email"] }, user_metadata: { nome }, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), identities: [] };
  return { access_token: token, token_type: "bearer", expires_in: 86400, expires_at: agora + 86400, refresh_token: "demo-refresh", user };
}
