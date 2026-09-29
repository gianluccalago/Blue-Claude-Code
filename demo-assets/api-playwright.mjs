// ===========================================================================
// Intercepta o Supabase no Playwright e responde pelo Postgres local COMO O
// USUÁRIO da sessão (RLS e triggers de autoria valem). Leituras, escritas,
// upserts, RPCs e auth falsa. Uso:
//   import { instalarApi, sessaoFalsa } from "./api-playwright.mjs";
//   const page = await ctx.newPage(); await instalarApi(page, { email, nome });
// Defina API_LOCAL_DB antes de importar (banco descartável).
// ===========================================================================
import { createHash } from "node:crypto";
import { rest, restEscrita, sessaoFalsa, sql } from "./api-local.mjs";
export { sessaoFalsa };

export async function instalarApi(page, usuario, opcoes = {}) {
  const email = usuario.email;
  await page.route("**/rest/v1/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const metodo = req.method();
    const prefer = req.headers()["prefer"] ?? "";
    if (opcoes.offline?.()) return route.abort("internetdisconnected");
    if (metodo === "GET" || metodo === "HEAD") {
      let linhas = [];
      try { linhas = rest(u.pathname, u.searchParams, email); } catch { linhas = []; }
      const unico = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
      if (unico) {
        if (linhas.length === 0) return route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify({ code: "PGRST116", message: "0 rows" }) });
        return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(linhas[0]) });
      }
      const range = `0-${Math.max(0, linhas.length - 1)}/${linhas.length}`;
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": range }, body: metodo === "HEAD" ? "" : JSON.stringify(linhas) });
    }
    let corpo = null;
    try { corpo = req.postDataJSON(); } catch { corpo = null; }
    const r = restEscrita(metodo, u.pathname, u.searchParams, corpo, prefer, email);
    if (r.status >= 400) return route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.corpo) });
    const unico = /vnd\.pgrst\.object/.test(req.headers()["accept"] ?? "");
    const representa = /return=representation/.test(prefer) || u.pathname.includes("/rpc/");
    const body = !representa ? "" : unico && Array.isArray(r.corpo) ? JSON.stringify(r.corpo[0] ?? null) : JSON.stringify(r.corpo);
    return route.fulfill({ status: representa ? r.status : 204, contentType: "application/json", body });
  });
  await page.route("**/auth/v1/**", async (route) => {
    const s = sessaoFalsa(email, usuario.nome);
    if (route.request().url().includes("/logout")) return route.fulfill({ status: 204, body: "" });
    if (route.request().url().includes("/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(s.user) });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(s) });
  });
  // Edge Function verify-round (rondas NFC): mesma validação do servidor
  // (supabase/functions/verify-round/validacaoTag.ts) + a RPC como service_role.
  await page.route("**/functions/v1/verify-round", async (route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }, body: "ok" });
    if (opcoes.offline?.()) return route.abort("internetdisconnected");
    const { validateTagRead } = await import("../supabase/functions/verify-round/validacaoTag.ts");
    const corpo = req.postDataJSON() ?? {};
    const leitura = await validateTagRead({ url: corpo.url, serialNumber: corpo.serial_number });
    const token = req.headers()["x-device-token"] ?? "";
    const p = {
      email, device_token_hash: token ? createHash("sha256").update(token).digest("hex") : "",
      tag_uid: leitura.tagUid, contador: leitura.counter, valida: leitura.valid, motivo: leitura.motivo,
      flags: leitura.flags, implementacao: leitura.implementacao, offline: !!corpo.offline,
      capturado_em: corpo.capturado_em ?? null, checklist: corpo.checklist ?? null,
    };
    const lit = JSON.stringify(p).replace(/'/g, "''");
    const saida = sql(`select public.registrar_leitura_nfc('${lit}'::jsonb)::text`);
    const linha = saida.split("\n").filter((l) => l.trim().startsWith("{")).pop() ?? "{}";
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: linha });
  });
  await page.route("**/storage/v1/**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.addInitScript((s) => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s));
    localStorage.setItem("bsl:tema", "claro");
  }, sessaoFalsa(email, usuario.nome));
}
