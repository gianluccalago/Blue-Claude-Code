// ===========================================================================
// GRAVAÇÃO DO PERCURSO — as seis paradas do ROTEIRO-DEMO.md, sem áudio.
// Saída: demo-assets/video/percurso-demo.webm (1920x1080).
// Uso: node demo-assets/gravar.mjs   (com o vite rodando na porta 5199)
// ===========================================================================
import { chromium } from "playwright-core";
import { mkdirSync, readdirSync, renameSync } from "node:fs";
import { rest, sessaoFalsa } from "./api-local.mjs";

const BASE = process.env.APP_URL ?? "http://localhost:5199";
const DIR = "demo-assets/video";
const VIEWPORT = { width: 1920, height: 1080 };

const USUARIOS = {
  master: { email: "demo.diretor@demo.local", nome: "Ricardo Salles Monteiro" },
  coordenacao: { email: "demo.marta@demo.local", nome: "Marta Ribeiro Coelho" },
  familia: { email: "demo.fernanda@demo.local", nome: "Fernanda Andrade Ribeiro" },
};

// Cada parada: caminho, quanto tempo fica na tela e se rola devagar.
const PARADAS = [
  { nome: "1 · CRM — o funil", url: "/app/master/crm", pausa: 4000 },
  { nome: "1 · CRM — o lead da Fernanda", url: "/app/master/crm", selecionar: "todas", clicar: "Família Andrade", pausa: 5000, rolar: true },
  { nome: "2 · Admissão — ficha e IVCF", url: "/app/master/hospede", clicar: "Maria Helena Andrade", pausa: 4000, rolar: true },
  { nome: "3 · Escala de cobertura", url: "/app/coordenacao/cobertura", perfil: "coordenacao", pausa: 4500, rolar: true },
  { nome: "4 · Intercorrência e reavaliação", url: "/app/master/hospede", clicar: "Maria Helena Andrade", pausa: 5000, rolar: true },
  { nome: "5 · Portal da família", url: "/app/familia", perfil: "familia", expandir: "Ver recados anteriores", pausa: 6000 },
  { nome: "5 · Plano de cuidados da família", url: "/app/familia/plano-cuidados", perfil: "familia", pausa: 4500, rolar: true },
  { nome: "6 · Documentação institucional", url: "/app/master/documentos-institucionais", pausa: 4500, rolar: true },
  { nome: "6 · Indicadores RDC 502", url: "/app/master/vigilancia-indicadores", pausa: 4500, rolar: true },
];

/** Rolagem suave até o fim da página, em passos curtos. */
async function rolarSuave(page) {
  await page.evaluate(async () => {
    const alvo = document.querySelector("main") ?? document.scrollingElement;
    const fim = alvo.scrollHeight - alvo.clientHeight;
    for (let y = 0; y < fim; y += 24) {
      alvo.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 16));
    }
    await new Promise((r) => setTimeout(r, 600));
  });
}

mkdirSync(DIR, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await browser.newContext({
  viewport: VIEWPORT, locale: "pt-BR", colorScheme: "light",
  recordVideo: { dir: DIR, size: VIEWPORT },
});
const page = await ctx.newPage();

let atual = "master";
async function usar(perfil) {
  atual = perfil ?? "master";
  const u = USUARIOS[atual];
  const s = sessaoFalsa(u.email, u.nome);
  await page.addInitScript(([x]) => localStorage.setItem("sb-localhost-auth-token", JSON.stringify(x)), [s]);
}
await page.route("**/rest/v1/**", async (r) => {
  const u = new URL(r.request().url());
  const linhas = rest(u.pathname, u.searchParams);
  await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(linhas) });
});
await page.route("**/auth/v1/**", (r) => {
  const s = sessaoFalsa(USUARIOS[atual].email, USUARIOS[atual].nome);
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(r.request().url().includes("/user") ? s.user : s) });
});
await page.route("**/storage/v1/**", (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));

for (const p of PARADAS) {
  await usar(p.perfil);
  await page.goto(BASE + p.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  if (p.selecionar) {
    const sel = page.locator("select").first();
    if (await sel.count()) { await sel.selectOption(p.selecionar).catch(() => {}); await page.waitForTimeout(1000); }
  }
  if (p.expandir) {
    const b = page.getByText(p.expandir, { exact: false }).first();
    if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(800); }
  }
  if (p.clicar) {
    const a = page.getByText(p.clicar, { exact: false }).first();
    if (await a.count()) { await a.click().catch(() => {}); await page.waitForTimeout(1500); }
  }
  await page.waitForTimeout(p.pausa);
  if (p.rolar) await rolarSuave(page);
  console.log("gravado:", p.nome);
}

await ctx.close();
await browser.close();
const arq = readdirSync(DIR).find((f) => f.endsWith(".webm") && f !== "percurso-demo.webm");
if (arq) renameSync(`${DIR}/${arq}`, `${DIR}/percurso-demo.webm`);
console.log("\nvídeo: demo-assets/video/percurso-demo.webm");
