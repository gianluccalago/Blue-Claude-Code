// ===========================================================================
// CAPTURAS DA DEMO — telas reais do app, dados reais do cenário DEMO.
// ---------------------------------------------------------------------------
// O app roda normalmente (vite) e todas as chamadas ao Supabase são
// interceptadas e respondidas a partir do Postgres local com o seed aplicado.
// Ou seja: as imagens são do app de verdade, não de um mock de tela.
// Uso:  node demo-assets/capturar.mjs
// ===========================================================================
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync } from "node:fs";
import { rest, sessaoFalsa } from "./api-local.mjs";

const BASE = process.env.APP_URL ?? "http://localhost:5199";
const SAIDA = "demo-assets/screenshots";
const VIEWPORT = { width: 1920, height: 1080 };

const TELAS = [
  { arq: "01-visao-geral-modulos.png", url: "/app/master", esperar: "Painel", desc: "Painel estratégico do Master com o menu completo de módulos à esquerda.", slide: "Abertura — a visão de conjunto: um sistema só, do comercial ao regulatório." },
  { arq: "02-crm-funil.png", url: "/app/master/crm", esperar: "CRM", desc: "Funil comercial com as oportunidades, incluindo a da Maria Helena (ganha) e dois leads ativos.", slide: "Parada 1 — o funil: a decisora é a filha." },
  { arq: "03-crm-lead-fernanda.png", url: "/app/master/crm", esperar: "Maria Helena", selecionar: { valor: "todas" }, clicar: "Família Andrade", desc: "Ficha da oportunidade da Maria Helena com o histórico completo: ligação, visita, proposta e contrato.", slide: "Parada 1 — cinco meses de relacionamento, registrados." },
  { arq: "04-visao360-identificacao.png", url: "/app/master/hospede", esperar: "Maria Helena", clicar: "Maria Helena Andrade", desc: "Visão 360 da Maria Helena: identificação, grau contratual e grau atual lado a lado.", slide: "Parada 2 — a ficha única do morador." },
  { arq: "05-avaliacao-geriatrica-ivcf.png", url: "/app/master/hospede", esperar: "IVCF", clicar: "Maria Helena Andrade", rolarAte: "avaliação IVCF", desc: "Última avaliação IVCF-20: Grau II após a reavaliação, com os domínios alterados.", slide: "Parada 2 — o IVCF define o grau e, com ele, o preço." },
  { arq: "06-plano-de-cuidados.png", url: "/app/master/hospede", esperar: "Plano de cuidado", clicar: "Maria Helena Andrade", rolarAte: "Plano de cuidado ativo", desc: "Plano de cuidados ampliado após a reavaliação: supervisão de banho, medicação assistida, fisioterapia.", slide: "Parada 3 — o plano vira o checklist do turno." },
  { arq: "07-evolucoes-enfermagem.png", url: "/app/master/hospede", esperar: "evoluções", clicar: "Maria Helena Andrade", rolarAte: "Últimas evoluções", desc: "Evoluções de enfermagem assinadas e datadas, incluindo o registro do dia da queda.", slide: "Parada 3 — operação rastreável, não depende de pessoa." },
  { arq: "08-intercorrencia-queda.png", url: "/app/master/hospede", esperar: "Intercorrências", clicar: "Maria Helena Andrade", rolarAte: "Intercorrências recentes", desc: "A queda no banheiro registrada: sem fratura, avaliada pela enfermeira RT e pelo médico no mesmo dia.", slide: "Parada 4 — o que todo mundo teme, tratado com processo." },
  { arq: "09-escala-cobertura.png", url: "/app/coordenacao/cobertura", perfil: "coordenacao", esperar: "Cobertura", desc: "Cobertura assistencial do mês: turnos diurnos e noturnos com profissional designado.", slide: "Parada 3 — a escala mostra o buraco antes de ele virar problema." },
  { arq: "10-portal-familia-inicio.png", url: "/app/familia", perfil: "familia", esperar: "Maria Helena", expandir: "Ver recados anteriores", desc: "O que a Fernanda vê: recados da equipe, incluindo o comunicado da queda no mesmo dia.", slide: "Parada 5 — ela soube em 45 minutos, sem telefonar." },
  { arq: "11-portal-familia-plano.png", url: "/app/familia/plano-cuidados", perfil: "familia", esperar: "Plano de cuidados", desc: "Plano de cuidados na visão da família: o que a equipe faz, por turno, em linguagem clara.", slide: "Parada 5 — transparência é o que sustenta ticket e ocupação." },
  { arq: "12-documentacao-institucional.png", url: "/app/master/documentos-institucionais", esperar: "Documenta", desc: "Documentação regulatória: a maioria em dia e o AVCB VENCIDO em destaque, com plano de ação.", slide: "Parada 6 — o risco é rastreado, não escondido." },
  { arq: "13-indicadores-rdc502.png", url: "/app/master/vigilancia-indicadores", esperar: "Indicadores", desc: "Indicadores obrigatórios da RDC 502/2021 calculados automaticamente; a queda entra na série.", slide: "Parada 6 — o que vai para a Vigilância é calculado, não digitado." },
  { arq: "14-eventos-sentinela.png", url: "/app/master/vigilancia-sentinela", esperar: "sentinela", desc: "Evento sentinela da queda com lesão: registrado, notificado à Vigilância Municipal e com protocolo.", slide: "Parada 6 — o evento adverso vira notificação rastreável." },
  { arq: "15-nutricao-cardapios.png", url: "/app/nutricionista/cardapios", perfil: "nutricionista", esperar: "Cardápio", desc: "Cardápios do dia por restrição alimentar (livre, diabético, pastoso).", slide: "Grade de módulos — nutrição e cozinha." },
  { arq: "16-lavanderia-enxoval.png", url: "/app/lavanderia/enxoval", perfil: "lavanderia", esperar: "Enxoval", desc: "Enxoval com estoque total, disponível e mínimo; fronhas abaixo do mínimo sinalizadas.", slide: "Grade de módulos — lavanderia e patrimônio têxtil." },
];

const USUARIOS = {
  master: { email: "demo.diretor@demo.local", nome: "Ricardo Salles Monteiro" },
  coordenacao: { email: "demo.marta@demo.local", nome: "Marta Ribeiro Coelho" },
  familia: { email: "demo.fernanda@demo.local", nome: "Fernanda Andrade Ribeiro" },
  nutricionista: { email: "demo.helena@demo.local", nome: "Helena Fontes Vieira" },
  lavanderia: { email: "demo.debora@demo.local", nome: "Débora Nunes Carvalho" },
};

async function instalarApi(page, usuario) {
  await page.route("**/rest/v1/**", async (route) => {
    const u = new URL(route.request().url());
    const linhas = rest(u.pathname, u.searchParams);
    const prefer = route.request().headers()["prefer"] ?? "";
    const corpo = prefer.includes("return=representation") || route.request().method() !== "GET" ? linhas : linhas;
    await route.fulfill({ status: 200, contentType: "application/json", headers: { "content-range": `0-${Math.max(0, corpo.length - 1)}/${corpo.length}` }, body: JSON.stringify(corpo) });
  });
  await page.route("**/auth/v1/**", async (route) => {
    const url = route.request().url();
    const s = sessaoFalsa(usuario.email, usuario.nome);
    if (url.includes("/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(s.user) });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(s) });
  });
  // Storage: sem arquivos reais na demo — o app já trata a ausência.
  await page.route("**/storage/v1/**", (route) => route.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
}

async function novaSessao(browser, perfil) {
  const usuario = USUARIOS[perfil ?? "master"];
  const ctx = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, locale: "pt-BR", colorScheme: "light" });
  const page = await ctx.newPage();
  await instalarApi(page, usuario);
  const sessao = sessaoFalsa(usuario.email, usuario.nome);
  await ctx.addInitScript(([s]) => {
    localStorage.setItem("sb-localhost-auth-token", JSON.stringify(s));
    localStorage.setItem("bsl:tema", "claro");
  }, [sessao]);
  return { ctx, page };
}

const erros = [];
mkdirSync(SAIDA, { recursive: true });
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

for (const t of TELAS) {
  const { ctx, page } = await novaSessao(browser, t.perfil);
  try {
    page.on("pageerror", (e) => erros.push(`${t.arq}: ${e.message}`));
    await page.goto(BASE + t.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1800);
    if (t.selecionar) {
      const sel = page.locator("select").first();
      if (await sel.count()) { await sel.selectOption(t.selecionar.valor).catch(() => {}); await page.waitForTimeout(1200); }
    }
    if (t.expandir) {
      const btn = page.getByText(t.expandir, { exact: false }).first();
      if (await btn.count()) { await btn.click({ timeout: 4000 }).catch(() => {}); await page.waitForTimeout(700); }
    }
    if (t.clicar) {
      const alvo = page.getByText(t.clicar, { exact: false }).first();
      if (await alvo.count()) { await alvo.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(1500); }
    }
    if (t.rolarAte) {
      const sec = page.getByText(t.rolarAte, { exact: false }).first();
      if (await sec.count()) { await sec.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(700); }
    }
    await page.screenshot({ path: `${SAIDA}/${t.arq}` });
    const texto = await page.locator("body").innerText();
    const ok = !t.esperar || texto.toLowerCase().includes(t.esperar.toLowerCase());
    console.log(`${ok ? "OK  " : "FRACA"} ${t.arq}${ok ? "" : `  (não achei "${t.esperar}")`}`);
    if (!ok) erros.push(`${t.arq}: esperado "${t.esperar}" não apareceu`);
  } catch (e) {
    console.log(`ERRO ${t.arq}: ${e.message.split("\n")[0]}`);
    erros.push(`${t.arq}: ${e.message.split("\n")[0]}`);
  }
  await ctx.close();
}
await browser.close();

const index = `# Índice das capturas — demo RPLK

Todas em 1920 x 1080 (retina 2x), tema claro, com o cenário DEMO carregado.
Geradas por \`node demo-assets/capturar.mjs\` — telas reais do app.

| Arquivo | O que mostra | Para qual slide |
|---|---|---|
${TELAS.map((t) => `| \`${t.arq}\` | ${t.desc} | ${t.slide} |`).join("\n")}

> Fallback ao vivo: se uma tela falhar durante a demo, abra a imagem correspondente desta pasta.
`;
writeFileSync(`${SAIDA}/INDEX.md`, index);
console.log(`\n${TELAS.length} telas processadas. Problemas: ${erros.length}`);
if (erros.length) console.log(erros.join("\n"));
