// ===========================================================================
// EMULADOR MÍNIMO DA API DO SUPABASE (só para gerar as capturas/vídeo).
// ---------------------------------------------------------------------------
// O app fala com o Supabase por HTTP (PostgREST + Auth). Aqui traduzimos
// essas chamadas para SQL no Postgres local que já tem o cenário da demo.
// NÃO faz parte do app; vive só em demo-assets/.
// ===========================================================================
import { execFileSync } from "node:child_process";

const DB = process.env.API_LOCAL_DB ?? "blue";
const PSQL = ["-h", "/tmp", "-p", "5439", "-U", "postgres", "-d", DB, "-t", "-A", "-X", "-q", "-v", "ON_ERROR_STOP=1"];

/**
 * Prefixo que faz a consulta rodar COMO o usuário (papel authenticated + JWT
 * com o e-mail): a RLS e os triggers de autoria valem de verdade. Sem e-mail,
 * roda como superusuário (uso das capturas da demo).
 */
function comoUsuario(email) {
  if (!email) return "";
  const claims = JSON.stringify({ email, role: "authenticated" }).replace(/'/g, "''");
  return `set role authenticated; do $x$ begin perform set_config('request.jwt.claims', '${claims}', false); end $x$; `;
}

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
export function rest(caminho, params, email) {
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
  try { return consultarComo(q, email); } catch { return []; }
}

/** Consulta como usuário (RLS) e devolve JSON. */
export function consultarComo(select, email) {
  const json = sql(`${comoUsuario(email)}select coalesce(json_agg(t), '[]'::json)::text from (${select}) t`);
  const linhas = json.trim().split("\n").filter(Boolean);
  try { return JSON.parse(linhas[linhas.length - 1] || "[]"); } catch { return []; }
}

const litJson = (v) => v === null || v === undefined ? "null" : `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
/** Literal SEM tipo (o Postgres converte pelo tipo da coluna/parâmetro); objetos viram jsonb. */
const litValor = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "object") return litJson(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};

/**
 * Escritas do PostgREST: POST (insert / upsert), PATCH (update com filtros),
 * DELETE (com filtros) e POST /rpc/<função>. Devolve { status, corpo }.
 * As linhas voltam como o PostgREST devolveria com Prefer: return=representation.
 * Erros do Postgres viram { status: 4xx, corpo: { message, code } } como no PostgREST.
 */
export function restEscrita(metodo, caminho, params, corpo, prefer, email) {
  const alvo = caminho.replace(/^\/rest\/v1\//, "").split("?")[0];
  const onde = [];
  for (const [k, v] of params) {
    if (["select", "apikey", "columns", "on_conflict", "order", "limit", "offset"].includes(k)) continue;
    if (/^[a-z_][a-z0-9_]*$/.test(k)) onde.push(filtro(k, v));
  }
  const where = onde.length ? " where " + onde.join(" and ") : "";
  let q;
  try {
    if (alvo.startsWith("rpc/")) {
      const fn = alvo.slice(4);
      if (!/^[a-z_][a-z0-9_]*$/.test(fn)) return { status: 404, corpo: { message: "função inválida" } };
      const args2 = Object.entries(corpo ?? {}).map(([k, v]) => `${k} := ${litValor(v)}`).join(", ");
      q = `select to_jsonb(r) from public.${fn}(${args2}) r`;
      const out = sql(`${comoUsuario(email)}select coalesce(json_agg(x), '[]'::json)::text from (${q}) x`);
      const linhas = out.trim().split("\n").filter(Boolean);
      const arr = JSON.parse(linhas[linhas.length - 1] || "[]").map((x) => x.to_jsonb ?? x);
      return { status: 200, corpo: arr.length === 1 && (arr[0] === null || typeof arr[0] !== "object") ? arr[0] : arr };
    }
    if (!/^[a-z_][a-z0-9_]*$/.test(alvo)) return { status: 404, corpo: { message: "tabela inválida" } };
    if (metodo === "POST") {
      const linhas = Array.isArray(corpo) ? corpo : [corpo];
      const cols = [...new Set(linhas.flatMap((l) => Object.keys(l)))];
      const vals2 = linhas.map((l) => "(" + cols.map((c) => l[c] === undefined ? "default" : litValor(l[c])).join(", ") + ")").join(", ");
      const conflito = params.get("on_conflict");
      const ignora = /resolution=ignore-duplicates/.test(prefer);
      const merge = /resolution=merge-duplicates/.test(prefer);
      let onConflict = "";
      if (conflito && ignora) onConflict = ` on conflict (${conflito.split(",").map((c) => `"${c.trim()}"`).join(",")}) do nothing`;
      else if (conflito && merge) onConflict = ` on conflict (${conflito.split(",").map((c) => `"${c.trim()}"`).join(",")}) do update set ` + cols.map((c) => `"${c}" = excluded."${c}"`).join(", ");
      q = `insert into public."${alvo}" (${cols.map((c) => `"${c}"`).join(", ")}) values ${vals2}${onConflict} returning *`;
    } else if (metodo === "PATCH") {
      const sets = Object.entries(corpo ?? {}).map(([c, v]) => `"${c}" = ${litValor(v)}`).join(", ");
      if (!sets) return { status: 200, corpo: [] };
      q = `update public."${alvo}" set ${sets}${where} returning *`;
    } else if (metodo === "DELETE") {
      q = `delete from public."${alvo}"${where} returning *`;
    } else return { status: 405, corpo: { message: "método não suportado" } };
    const out = sql(`${comoUsuario(email)}with r as (${q}) select coalesce(json_agg(r), '[]'::json)::text from r`);
    const linhas = out.trim().split("\n").filter(Boolean);
    return { status: metodo === "POST" ? 201 : 200, corpo: JSON.parse(linhas[linhas.length - 1] || "[]") };
  } catch (e) {
    const msg = String(e.stderr ?? e.message ?? e);
    const m = msg.match(/ERROR:\s*(.*)/);
    const detalhe = m ? m[1].trim() : msg.trim();
    const code = /row-level security/.test(detalhe) ? "42501" : /duplicate key/.test(detalhe) ? "23505" : /violates check/.test(detalhe) ? "23514" : "P0001";
    return { status: code === "42501" ? 403 : 400, corpo: { message: detalhe, code, details: null, hint: null } };
  }
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
