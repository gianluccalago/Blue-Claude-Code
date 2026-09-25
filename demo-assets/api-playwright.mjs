// ===========================================================================
// Intercepta o Supabase no Playwright e responde pelo Postgres local COMO O
// USUÁRIO da sessão (RLS e triggers de autoria valem). Leituras, escritas,
// upserts, RPCs e auth falsa. Uso:
//   import { instalarApi, sessaoFalsa } from "./api-playwright.mjs";
//   const page = await ctx.newPage(); await instalarApi(page, { email, nome });
// Defina API_LOCAL_DB antes de importar (banco descartável).
// ===========================================================================
import { rest, restEscrita, sessaoFalsa } from "./api-local.mjs";
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
  await page.route("**/storage/v1/**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
  await page.addInitScript((s) => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s));
    localStorage.setItem("bsl:tema", "claro");
  }, sessaoFalsa(email, usuario.nome));
}
