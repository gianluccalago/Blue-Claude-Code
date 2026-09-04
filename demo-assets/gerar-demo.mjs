// ===========================================================================
// GERADOR DO CENÁRIO "DEMO" — Blue Senior Living
// ---------------------------------------------------------------------------
// UMA fonte de verdade que emite:
//   · seed/DEMO_SEED.sql     → carrega o cenário no Supabase (idempotente)
//   · seed/DEMO_LIMPEZA.sql  → remove TUDO com um comando
//   · dados-demo.json        → mesmos dados para o harness de capturas
//
// ISOLAMENTO: o app não tem multi-tenancy. Todo registro da demo nasce com
// UUID no bloco `de3000xx-…`; a limpeza apaga exatamente esse bloco e nada
// mais. Os NOMES são plausíveis e sem prefixo (as telas precisam parecer
// reais nas capturas) — a identificação é pelo UUID, não pelo texto.
//
// DATAS: tudo relativo a demo_ref() (função criada pelo seed). Por padrão
// demo_ref() = current_date, então rodar o seed no dia da reunião já deixa
// tudo "de hoje". Para fixar outra data, edite a função no topo do SQL.
// ===========================================================================
import { writeFileSync, mkdirSync } from "node:fs";

const q = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const num = (n) => (n == null ? "null" : String(n));
const bool = (b) => (b ? "true" : "false");
/** Data relativa ao dia da demo. */
const D = (dias) => `(demo_ref() - ${dias})`;
/** Timestamp relativo: dia da demo − dias, na hora informada. */
const TS = (dias, hora = "09:00") => `((demo_ref() - ${dias})::timestamp + time '${hora}')`;
/** UUID determinístico dentro de um bloco (2 hex). */
const uid = (bloco, n) => `de3000${bloco}-0000-4000-8000-${String(n).padStart(12, "0")}`;

const B = {
  residente: "10", usuario: "20", crmContato: "30", crmOport: "31", crmEvento: "32",
  ivcf: "40", cognitivo: "41", plano: "42", prescricao: "43", evolucao: "44",
  intercorrencia: "45", sentinela: "46", recado: "47", compromisso: "48",
  turno: "50", documento: "51", npsPesq: "52", npsResp: "53", atividade: "54",
  participacao: "55", enxoval: "56", chamado: "57", cardapio: "58",
};

// ─── EQUIPE ────────────────────────────────────────────────────────────────
const equipe = [
  { n: 1, nome: "Ricardo Salles Monteiro", perfil: "master", email: "demo.diretor@demo.local", funcao: "Diretor" },
  { n: 2, nome: "Rosana Prado Lima", perfil: "enfermeira", email: "demo.rosana@demo.local", funcao: "Enfermeira Responsável Técnica", registro: "COREN-PR 312.884" },
  { n: 3, nome: "Marta Ribeiro Coelho", perfil: "coordenacao", email: "demo.marta@demo.local", funcao: "Coordenação assistencial" },
  { n: 4, nome: "Geraldo Antunes Vaz", perfil: "medico", email: "demo.medico@demo.local", funcao: "Médico geriatra", registro: "CRM-PR 28.417" },
  { n: 5, nome: "Camila Duarte Pinho", perfil: "enfermagem", email: "demo.camila@demo.local", funcao: "Técnica de Enfermagem", vinculo: "CLT" },
  { n: 6, nome: "Juliana Ferraz Amado", perfil: "enfermagem", email: "demo.juliana@demo.local", funcao: "Técnica de Enfermagem", vinculo: "CLT" },
  { n: 7, nome: "Patrícia Gomes Vilela", perfil: "enfermagem", email: "demo.patricia@demo.local", funcao: "Técnica de Enfermagem", vinculo: "CLT" },
  { n: 8, nome: "Simone Barros Tavares", perfil: "enfermagem", email: "demo.simone@demo.local", funcao: "Técnica de Enfermagem", vinculo: "CLT" },
  { n: 9, nome: "Tereza Lopes Andrade", perfil: "cuidador", email: "demo.tereza@demo.local", funcao: "Cuidadora diurna", vinculo: "CLT" },
  { n: 10, nome: "Helena Fontes Vieira", perfil: "nutricionista", email: "demo.helena@demo.local", funcao: "Nutricionista", registro: "CRN-8 9.412" },
  { n: 11, nome: "Sandra Vieira Nogueira", perfil: "multidisciplinar", email: "demo.sandra@demo.local", funcao: "Fisioterapeuta", registro: "CREFITO-8 148.220" },
  { n: 12, nome: "Débora Nunes Carvalho", perfil: "administracao", email: "demo.debora@demo.local", funcao: "Recepção e administrativo" },
  { n: 13, nome: "Paulo Cesar Werneck", perfil: "farmacia", email: "demo.farmacia@demo.local", funcao: "Farmácia" },
  { n: 14, nome: "Fernanda Andrade Ribeiro", perfil: "familia", email: "demo.fernanda@demo.local", funcao: "Filha de Maria Helena", vinculaResidente: 1 },
];

// ─── MORADORES (12) ────────────────────────────────────────────────────────
// n=1 é a protagonista. grau_dependencia = ATUAL; grau_contratual = do contrato.
const moradores = [
  { n: 1, nome: "Maria Helena Andrade", nasc: "1947-03-18", grau: "II", contratual: "I", suite: "Suíte", quarto: "204", resp: "Fernanda Andrade Ribeiro", respTel: "(41) 99612-4477", freq: 3 },
  { n: 2, nome: "Aparecida Nunes Vidal", nasc: "1944-07-02", grau: "I", contratual: "I", suite: "Suíte", quarto: "201", resp: "Cláudio Nunes Vidal", respTel: "(41) 99845-1120", freq: 1 },
  { n: 3, nome: "Conceição Dias Ferraz", nasc: "1949-11-25", grau: "I", contratual: "I", suite: "Long Stay", quarto: "108", resp: "Beatriz Dias Ferraz", respTel: "(41) 99231-8890", freq: 1 },
  { n: 4, nome: "Waldir Campos Rocha", nasc: "1943-01-09", grau: "I", contratual: "I", suite: "Apartamento", quarto: "302", resp: "Sérgio Campos Rocha", respTel: "(41) 99770-3312", freq: 1 },
  { n: 5, nome: "Nelson Barreto Aguiar", nasc: "1946-05-14", grau: "I", contratual: "I", suite: "Apartamento", quarto: "305", resp: "Marina Barreto Aguiar", respTel: "(41) 99188-7745", freq: 1 },
  { n: 6, nome: "Yolanda Prates Coelho", nasc: "1941-09-30", grau: "I", contratual: "I", suite: "Suíte", quarto: "206", resp: "Rogério Prates Coelho", respTel: "(41) 99554-2201", freq: 1 },
  { n: 7, nome: "Ivone Salgado Reis", nasc: "1948-02-11", grau: "I", contratual: "I", suite: "Long Stay", quarto: "110", resp: "Tatiana Salgado Reis", respTel: "(41) 99903-6678", freq: 1 },
  { n: 8, nome: "Arnaldo Bicudo Franco", nasc: "1945-12-03", grau: "I", contratual: "I", suite: "Apartamento", quarto: "308", resp: "Luiza Bicudo Franco", respTel: "(41) 99417-9024", freq: 1 },
  { n: 9, nome: "Lúcia Moraes Tavares", nasc: "1940-06-21", grau: "II", contratual: "II", suite: "Suíte", quarto: "209", resp: "Paulo Moraes Tavares", respTel: "(41) 99326-5580", freq: 3 },
  { n: 10, nome: "Otávio Prado Sanches", nasc: "1939-08-17", grau: "II", contratual: "II", suite: "Suíte Premium", quarto: "212", resp: "Renata Prado Sanches", respTel: "(41) 99640-1193", freq: 3, alergias: "Dipirona" },
  { n: 11, nome: "Célia Bastos Meireles", nasc: "1942-04-06", grau: "II", contratual: "II", suite: "Suíte", quarto: "215", resp: "André Bastos Meireles", respTel: "(41) 99872-4406", freq: 3 },
  { n: 12, nome: "Therezinha Alves Moreira", nasc: "1936-10-28", grau: "III", contratual: "II", suite: "Suíte Premium", quarto: "218", resp: "Vera Alves Moreira", respTel: "(41) 99205-7731", freq: 5 },
];


// ─── JORNADA DA PROTAGONISTA (dias antes da demo) ──────────────────────────
const J = {
  leadPrimeiroContato: 150, leadVisitaAgendada: 143, leadVisitaFeita: 138,
  leadProposta: 131, leadContrato: 122, admissao: 120,
  queda: 21, reavaliacao: 14,
};

const linhas = [];   // SQL
const add = (s) => linhas.push(s);
const sec = (t) => add(`\n-- ── ${t} ${"─".repeat(Math.max(0, 68 - t.length))}\n`);

// ═══ 1. MORADORES ══════════════════════════════════════════════════════════
sec("0 · Moradores pré-existentes saem de cena (REVERSÍVEL)");
// As migrações do app semeiam ~15 moradores de teste (Alzira e cia.). Se
// ficarem ativos, a demo mostra 27 moradores e os indicadores da RDC 502
// contam gente que não faz parte da história. Guardamos quem estava ATIVO
// numa tabela de backup e inativamos — a limpeza reativa exatamente esses.
add(`create table if not exists public.demo_backup_residentes as
  select id, data_saida from public.residentes
  where status_hospede = 'ativo' and id::text not like 'de300010%';`);
add(`update public.residentes
     set status_hospede = 'inativo',
         data_saida = coalesce(data_saida, demo_ref() - 200)
   where id in (select id from public.demo_backup_residentes);`);

sec("1 · Moradores (12 ativos)");
for (const m of moradores) {
  const admissao = m.n === 1 ? J.admissao : 60 + m.n * 22;
  add(`insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  (${q(uid(B.residente, m.n))}, ${q(m.nome)}, ${q(m.nasc)}, ${q(m.grau)}, ${q(m.contratual)}, ${q(m.quarto)}, 5, ${num(parseInt(m.quarto[0], 10))}, ${q(m.suite)}, 'simples',
   ${q(m.resp)}, ${q(m.respTel)}, ${q(m.resp)}, ${q(m.respTel)}, ${q(m.alergias ?? null)}, ${num(m.grau === "I" ? 9800 : m.grau === "II" ? 12400 : 15200)}, ${D(admissao)},
   ${q(m.n === 1 ? "Professora aposentada da rede estadual, lecionou português por 34 anos. Viúva desde 2019, mãe de duas filhas. Gosta de leitura, palavras cruzadas e do coral às quartas." : null)})
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;`);
}

// ═══ 2. EQUIPE ═════════════════════════════════════════════════════════════
sec("2 · Equipe (login: e-mail abaixo, senha blue)");
for (const p of equipe) {
  const vinc = p.vinculaResidente ? q(uid(B.residente, p.vinculaResidente)) : "null";
  add(`insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  (${q(uid(B.usuario, p.n))}, ${q(p.nome)}, ${q(p.email)}, ${q(p.perfil)}, true, ${q(p.funcao)}, ${q(p.vinculo ?? null)}, ${q(p.registro ?? null)}, ${vinc}, ${D(J.admissao + 30)})
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;`);
}

// ═══ 2. MORADORES ══════════════════════════════════════════════════════════
// ═══ 3. CRM ════════════════════════════════════════════════════════════════
sec("3 · CRM — jornada da Fernanda (ganha) + 2 leads em andamento");
add(`create table if not exists public.demo_backup_crm as
  select id, status from public.crm_oportunidade where id::text not like 'de30003%';`);
add(`update public.crm_oportunidade set status = 'pausada'
  where id in (select id from public.demo_backup_crm);`);
// Origens e etapas já vêm das migrações (nome é UNIQUE) — a demo reusa.
const ORIGEM = (nome) => `(select id from public.crm_origem where nome = ${q(nome)} limit 1)`;

const contatos = [
  { n: 1, nome: "Fernanda Andrade Ribeiro", tel: "(41) 99612-4477", mail: "fernanda.andrade@exemplo.com.br", rel: "Filha", idoso: "Maria Helena Andrade", idade: 79, grau: "I" },
  { n: 2, nome: "Regina Mattos Peixoto", tel: "(41) 99728-5510", mail: "regina.mattos@exemplo.com.br", rel: "Filha", idoso: "Sônia Mattos Peixoto", idade: 81, grau: "II" },
  { n: 3, nome: "Marcos Ferrari Bueno", tel: "(41) 99333-2087", mail: "marcos.ferrari@exemplo.com.br", rel: "Filho", idoso: "João Batista Ferrari", idade: 77, grau: "I" },
];
for (const c of contatos) {
  add(`insert into public.crm_contato (id, nome, telefones, emails, relacao, nome_idoso, idade_idoso, grau_estimado, base_legal_lgpd, criado_em) values
  (${q(uid(B.crmContato, c.n))}, ${q(c.nome)}, array[${q(c.tel)}], array[${q(c.mail)}], ${q(c.rel)}, ${q(c.idoso)}, ${num(c.idade)}, ${q(c.grau)}, 'consentimento', ${TS(c.n === 1 ? J.leadPrimeiroContato : 26 + c.n, "10:20")})
  on conflict (id) do update set nome = excluded.nome, telefones = excluded.telefones, emails = excluded.emails,
    relacao = excluded.relacao, nome_idoso = excluded.nome_idoso, idade_idoso = excluded.idade_idoso;`);
}

const oportunidades = [
  { n: 1, contato: 1, nome: "Família Andrade — Maria Helena", etapa: "Admissão", status: "ganha", valor: 9800, suite: "Suíte", criado: J.leadPrimeiroContato, fechado: J.leadContrato, residente: 1, qual: 5 },
  { n: 2, contato: 2, nome: "Família Peixoto — Sônia", etapa: "Visita realizada", status: "em_andamento", valor: 12400, suite: "Suíte", criado: 29, fechado: null, residente: null, qual: 4 },
  { n: 3, contato: 3, nome: "Família Ferrari — João Batista", etapa: "Proposta enviada", status: "em_andamento", valor: 9800, suite: "Long Stay", criado: 34, fechado: null, residente: null, qual: 4 },
];
for (const o of oportunidades) {
  add(`insert into public.crm_oportunidade (id, nome, contato_id, origem_id, qualificacao, valor_mensalidade_estimado, tipo_suite_interesse,
  previsao_fechamento, etapa, status, responsavel, residente_id, criado_em, fechado_em) values
  (${q(uid(B.crmOport, o.n))}, ${q(o.nome)}, ${q(uid(B.crmContato, o.contato))}, ${ORIGEM(o.n === 1 ? "Indicação de família" : "Site")}, ${num(o.qual)}, ${num(o.valor)}, ${q(o.suite)},
   ${o.fechado ? D(o.fechado) : D(-18)}, ${q(o.etapa)}, ${q(o.status)}, 'Débora Nunes Carvalho', ${o.residente ? q(uid(B.residente, o.residente)) : "null"},
   ${TS(o.criado, "10:25")}, ${o.fechado ? TS(o.fechado, "16:40") : "null"})
  on conflict (id) do update set etapa = excluded.etapa, status = excluded.status, qualificacao = excluded.qualificacao,
    valor_mensalidade_estimado = excluded.valor_mensalidade_estimado, criado_em = excluded.criado_em, fechado_em = excluded.fechado_em;`);
}

const eventosCrm = [
  [1, J.leadPrimeiroContato, "ligacao", "Primeiro contato por telefone. Indicação da vizinha, Sra. Neusa. A filha (Fernanda) descreve a mãe como independente, viúva, morando sozinha desde 2019. Preocupação principal: solidão e segurança à noite."],
  [1, J.leadVisitaAgendada, "agendamento", "Visita agendada para o sábado seguinte, às 10h. Fernanda virá com a mãe e com a irmã."],
  [1, J.leadVisitaFeita, "visita", "Visita realizada. Maria Helena gostou do apartamento 204 e do coral das quartas. Perguntas da família: rotina de medicação, o que acontece se a mãe precisar de mais cuidado no futuro, e se a família consegue acompanhar à distância."],
  [1, J.leadProposta, "proposta", "Proposta enviada: Suíte 204, grau I, mensalidade R$ 9.800. Incluída a explicação do reenquadramento de grau caso a necessidade mude."],
  [1, J.leadContrato, "contrato", "Contrato assinado. Admissão agendada. Fernanda cadastrada como responsável e como acesso da família no aplicativo."],
  [2, 29, "ligacao", "Contato pelo site. Mãe com limitação de mobilidade após cirurgia de quadril; busca suporte moderado."],
  [2, 24, "visita", "Visita realizada com a filha e o genro. Interesse na Suíte 209. Aguardando decisão da família."],
  [3, 34, "ligacao", "Indicação médica (geriatra). Pai independente, quer conviver mais."],
  [3, 20, "proposta", "Proposta enviada para Long Stay. Retorno previsto para a próxima semana."],
];
eventosCrm.forEach(([op, dias, tipo, desc], i) =>
  add(`insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  (${q(uid(B.crmEvento, i + 1))}, ${q(uid(B.crmOport, op))}, ${q(tipo)}, ${q(desc)}, 'Débora Nunes Carvalho', ${TS(dias, "14:05")})
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;`));

// ═══ 4. AVALIAÇÃO GERIÁTRICA (IVCF-20) ═════════════════════════════════════
sec("4 · Avaliação geriátrica (IVCF-20) — admissão e reavaliação");
const respIvcf = (p) => JSON.stringify(p);
const ivcfs = [
  // Protagonista: admissão Grau I → reavaliação Grau II (a virada da demo)
  { n: 1, res: 1, dias: J.admissao, pont: 6, cls: "Grau I", dom: [],
    resp: { idade: 0, autopercepcao_saude: 0, avd_instrumental: 0, avd_basica: 0, cognicao: 0, humor: 1, mobilidade: 2, comunicacao: 0, comorbidades: 3 },
    por: "Rosana Prado Lima" },
  { n: 2, res: 1, dias: J.reavaliacao, pont: 17, cls: "Grau II", dom: ["Mobilidade", "Humor", "AVD instrumental"],
    resp: { idade: 0, autopercepcao_saude: 1, avd_instrumental: 4, avd_basica: 2, cognicao: 0, humor: 2, mobilidade: 5, comunicacao: 0, comorbidades: 3 },
    por: "Rosana Prado Lima" },
];
let ivcfN = 2;
for (const m of moradores.filter((x) => x.n !== 1)) {
  ivcfN += 1;
  const pont = m.grau === "I" ? 5 + (m.n % 3) : m.grau === "II" ? 16 + (m.n % 4) : 28;
  ivcfs.push({
    n: ivcfN, res: m.n, dias: 60 + m.n * 22 - 2, pont, cls: `Grau ${m.grau}`,
    dom: m.grau === "I" ? [] : m.grau === "II" ? ["Mobilidade", "AVD instrumental"] : ["Mobilidade", "AVD básica", "Cognição", "Comorbidades"],
    resp: { idade: m.grau === "III" ? 3 : 0, avd_instrumental: m.grau === "I" ? 0 : 4, avd_basica: m.grau === "III" ? 6 : 0, cognicao: m.grau === "III" ? 4 : 0, mobilidade: m.grau === "I" ? 2 : 5, comorbidades: 3 },
    por: "Rosana Prado Lima",
  });
}
for (const a of ivcfs) {
  add(`insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  (${q(uid(B.ivcf, a.n))}, ${q(uid(B.residente, a.res))}, ${q(respIvcf(a.resp))}::jsonb, ${num(a.pont)}, ${q(a.cls)},
   array[${a.dom.map(q).join(", ")}]::text[], array[]::text[], ${q(a.por)}, ${TS(a.dias, "11:15")})
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;`);
}

// ═══ 5. AVALIAÇÃO COGNITIVA ════════════════════════════════════════════════
sec("5 · Avaliação cognitiva (MEEM)");
const cognitivos = [
  { n: 1, res: 1, dias: J.admissao - 1, total: 28, esc: 16, interp: "Dentro da normalidade para a escolaridade (16 anos de estudo). Sem indício de comprometimento cognitivo. Reavaliar em 12 meses ou antes, se houver mudança funcional.",
    resp: { orientacao_temporal: 5, orientacao_espacial: 5, registro: 3, registro_tentativas: 1, atencao_calculo: 4, evocacao: 3, ling_nomear: 2, ling_repetir: 1, ling_comando: 3, ling_ler_executar: 1, ling_escrever: 1, ling_copiar: 0 } },
];
let cogN = 1;
for (const m of moradores.filter((x) => x.n !== 1)) {
  cogN += 1;
  const total = m.grau === "I" ? 27 - (m.n % 3) : m.grau === "II" ? 23 - (m.n % 3) : 14;
  cognitivos.push({ n: cogN, res: m.n, dias: 60 + m.n * 22 - 1, total, esc: 8,
    interp: m.grau === "III" ? "Escore compatível com comprometimento cognitivo. Encaminhado ao geriatra para investigação e ajuste do plano de cuidados." : "Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.",
    resp: { orientacao_temporal: m.grau === "III" ? 2 : 5, orientacao_espacial: m.grau === "III" ? 3 : 5, registro: 3, registro_tentativas: 1, atencao_calculo: m.grau === "III" ? 1 : 4, evocacao: m.grau === "III" ? 0 : 2, ling_nomear: 2, ling_repetir: 1, ling_comando: 3, ling_ler_executar: 1, ling_escrever: 1, ling_copiar: 1 } });
}
for (const c of cognitivos) {
  add(`insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  (${q(uid(B.cognitivo, c.n))}, ${q(uid(B.residente, c.res))}, 'MEEM', ${q(JSON.stringify(c.resp))}::jsonb, ${num(c.total)}, ${num(c.esc)}, ${q(c.interp)}, 'Geraldo Antunes Vaz', ${TS(c.dias, "10:40")})
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;`);
}

// ═══ 6. PLANO DE CUIDADOS ══════════════════════════════════════════════════
sec("6 · Plano de cuidados vigente");
const planoBase = {
  I: [["Aferir pressão arterial", "08:00", "enfermagem"], ["Conferência semanal da medicação de uso contínuo", "09:00", "enfermagem"], ["Estímulo a atividades de convívio", "15:00", "cuidador"]],
  II: [["Supervisão de banho", "07:30", "cuidador"], ["Administração assistida de medicação", "08:00", "enfermagem"], ["Aferir pressão arterial", "08:15", "enfermagem"], ["Acompanhar sessão de fisioterapia", "10:00", "cuidador"], ["Reavaliação de risco de queda", "17:00", "enfermagem"]],
  III: [["Higiene assistida completa", "07:00", "cuidador"], ["Administração de medicação", "08:00", "enfermagem"], ["Mudança de decúbito", "10:00", "cuidador"], ["Acompanhar fisioterapia motora e respiratória", "11:00", "cuidador"], ["Controle de aceitação alimentar", "12:30", "cuidador"], ["Avaliação de integridade da pele", "18:00", "enfermagem"]],
};
let planoN = 0;
for (const m of moradores) {
  for (const [tarefa, horario, resp] of planoBase[m.grau]) {
    planoN += 1;
    add(`insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  (${q(uid(B.plano, planoN))}, ${q(uid(B.residente, m.n))}, ${q(tarefa)}, ${q(horario)}, ${q(resp)}, 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;`);
  }
}

// ═══ 7. PRESCRIÇÕES ════════════════════════════════════════════════════════
sec("7 · Prescrições ativas");
const presBase = {
  I: [["Losartana potássica 50 mg", "1 comprimido", "oral", "manha", "08:00"], ["Colecalciferol 7.000 UI", "1 cápsula", "oral", "almoco", "12:00"]],
  II: [["Losartana potássica 50 mg", "1 comprimido", "oral", "manha", "08:00"], ["Colecalciferol 7.000 UI", "1 cápsula", "oral", "almoco", "12:00"], ["Sinvastatina 20 mg", "1 comprimido", "oral", "noite", "20:00"], ["Carbonato de cálcio 500 mg", "1 comprimido", "oral", "almoco", "12:00"]],
  III: [["Losartana potássica 50 mg", "1 comprimido", "oral", "manha", "08:00"], ["Sinvastatina 20 mg", "1 comprimido", "oral", "noite", "20:00"], ["Donepezila 10 mg", "1 comprimido", "oral", "noite", "20:00"], ["Insulina NPH", "12 UI", "insulina", "jejum", "07:00"], ["Ômega 3 1000 mg", "1 cápsula", "oral", "almoco", "12:00"]],
};
let presN = 0;
for (const m of moradores) {
  for (const [med, dose, via, periodo, horario] of presBase[m.grau]) {
    presN += 1;
    add(`insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  (${q(uid(B.prescricao, presN))}, ${q(uid(B.residente, m.n))}, ${q(med)}, ${q(dose)}, ${q(via)}, ${q(periodo)}, ${q(horario)}, true,
   ${q("Uso contínuo. " + (m.n === 1 ? "Reavaliado na consulta de " + "revisão do plano." : "Revisão trimestral."))}, ${q(uid(B.usuario, 4))}, ${q(m.alergias ? "ALERGIA REGISTRADA: " + m.alergias : null)})
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;`);
  }
}

// ═══ 8. EVOLUÇÕES DE ENFERMAGEM ════════════════════════════════════════════
sec("8 · Evoluções de enfermagem (últimos 30 dias + jornada da protagonista)");
const autores = ["Camila Duarte Pinho", "Juliana Ferraz Amado", "Patrícia Gomes Vilela", "Simone Barros Tavares", "Rosana Prado Lima"];
const textoRotina = {
  I: [
    "Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.",
    "Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.",
    "Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.",
  ],
  II: [
    "Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.",
    "Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.",
    "Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.",
  ],
  III: [
    "Higiene assistida completa realizada. Mudanças de decúbito a cada 2 horas, pele íntegra. Aceitação alimentar parcial no almoço (60%). Glicemia capilar 142 mg/dL, insulina administrada conforme prescrição.",
    "Sonolenta pela manhã, mais responsiva à tarde. Fisioterapia motora e respiratória realizadas no leito. Sem sinais de desconforto respiratório. Diurese e evacuação presentes.",
    "Sem intercorrências. Higiene e mudança de decúbito conforme plano. Aceitação alimentar 75%. Família presente na visita da tarde, orientada quanto à rotina.",
  ],
};
let evoN = 0;
const addEvo = (res, dias, texto, autor, hora = "18:40") => {
  evoN += 1;
  add(`insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  (${q(uid(B.evolucao, evoN))}, ${q(uid(B.residente, res))}, ${q(texto)}, ${q(autor)}, ${TS(dias, hora)})
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;`);
};

// Protagonista: 3 meses estáveis (amostra), a queda, e as 2 semanas do novo plano
for (let d = 112; d >= J.queda + 2; d -= 7) {
  addEvo(1, d, textoRotina.I[d % 3], autores[d % 4]);
}
addEvo(1, J.queda,
  "QUEDA. Por volta das 06h50 a moradora foi encontrada sentada no piso do banheiro da suíte, consciente, orientada, referindo ter escorregado ao sair do box. Nega perda de consciência e nega dor em quadril. Ao exame: escoriação superficial em antebraço direito (aproximadamente 3 cm), sem deformidades, sem limitação de movimento, sem dor à palpação de bacia e membros. PA 142x88 mmHg, FC 84 bpm, glicemia 96 mg/dL. Realizada limpeza e curativo da escoriação. Enfermeira RT acionada e presente às 07h05. Médico comunicado por telefone às 07h20, orientou observação e avaliação presencial no mesmo dia. Filha (Fernanda) comunicada às 07h35 pelo aplicativo e por telefone. Registrado evento adverso. Moradora mantida em observação, deambulando com apoio, sem novas queixas até o fim do plantão.",
  "Rosana Prado Lima", "07:50");
addEvo(1, J.queda - 1, "Moradora em observação após a queda de ontem. Avaliada pelo médico geriatra, sem indicação de exame de imagem. Escoriação em antebraço com boa evolução, sem sinais flogísticos. Refere insegurança para o banho. Encaminhada solicitação de reavaliação do grau de dependência e de risco de queda.", "Rosana Prado Lima");
addEvo(1, J.reavaliacao,
  "REAVALIAÇÃO. Aplicado IVCF-20: pontuação 17, classificação Grau II (anterior: Grau I, pontuação 6). Domínios alterados: mobilidade, humor e AVD instrumental. Justificativa clínica: após a queda houve redução da marcha independente, insegurança para banho e higiene, e retraimento social com queda na participação em atividades. Plano de cuidados ampliado: supervisão de banho, administração assistida de medicação, fisioterapia motora duas vezes por semana e reavaliação semanal de risco de queda. Família comunicada e de acordo. Reenquadramento contratual encaminhado à administração.",
  "Rosana Prado Lima", "11:30");
for (let d = J.reavaliacao - 2; d >= 1; d -= 2) {
  addEvo(1, d, textoRotina.II[d % 3], autores[d % 4]);
}
// Demais moradores: 30 dias, frequência conforme o grau
for (const m of moradores.filter((x) => x.n !== 1)) {
  for (let d = 29; d >= 1; d -= m.freq) addEvo(m.n, d, textoRotina[m.grau][(d + m.n) % 3], autores[(d + m.n) % 5]);
}

// ═══ 9. INTERCORRÊNCIA + EVENTO SENTINELA ══════════════════════════════════
sec("9 · Intercorrência e evento adverso (queda da protagonista)");
add(`insert into public.intercorrencia (id, residente_id, tipo, observacao, registrado_por, registrado_em) values
  (${q(uid(B.intercorrencia, 1))}, ${q(uid(B.residente, 1))}, 'Queda',
   'Queda da própria altura no banheiro da suíte, ao sair do box. Sem perda de consciência, sem fratura. Escoriação superficial em antebraço direito. Avaliada pela enfermeira RT e pelo médico no mesmo dia. Família comunicada.',
   'Rosana Prado Lima', ${TS(J.queda, "07:05")})
  on conflict (id) do update set observacao = excluded.observacao, registrado_em = excluded.registrado_em;`);
add(`insert into public.evento_sentinela (id, residente_id, intercorrencia_id, tipo, data_ocorrencia, descricao,
  registrado_por, perfil_registrador, gravidade, notificado, notificado_em, notificado_por, orgao_notificado, protocolo_notificacao, criado_em) values
  (${q(uid(B.sentinela, 1))}, ${q(uid(B.residente, 1))}, ${q(uid(B.intercorrencia, 1))}, 'queda_com_lesao', ${D(J.queda)},
   'Queda no banheiro com lesão de pele superficial (escoriação em antebraço direito), sem fratura e sem necessidade de remoção hospitalar.',
   'Rosana Prado Lima', 'enfermeira', 'leve', true, ${TS(J.queda - 1, "09:10")}, 'Rosana Prado Lima', 'Vigilância Sanitária Municipal de Curitiba', 'NOT-2026-0184', ${TS(J.queda, "07:40")})
  on conflict (id) do update set descricao = excluded.descricao, data_ocorrencia = excluded.data_ocorrencia, notificado = true;`);

// ═══ 10. PORTAL DA FAMÍLIA (recados) ═══════════════════════════════════════
sec("10 · Portal da família — recados");
let recN = 0;
const addRec = (res, dias, msg, autor, hora = "16:00") => {
  recN += 1;
  add(`insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  (${q(uid(B.recado, recN))}, ${q(uid(B.residente, res))}, ${q(msg)}, ${q(autor)}, ${TS(dias, hora)})
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;`);
};
addRec(1, J.queda, "Comunicado de intercorrência. Sua mãe teve uma queda no banheiro hoje de manhã, por volta das 6h50, ao sair do box. Ela está consciente, orientada e sem fratura. Houve uma escoriação superficial no antebraço direito, já limpa e com curativo. A enfermeira responsável avaliou às 7h05 e o médico geriatra a examinou ainda hoje, sem indicação de exame de imagem. Ela seguirá em observação e vamos reavaliar o plano de cuidados nos próximos dias. Estamos à disposição pelo telefone do plantão.", "Rosana Prado Lima", "07:35");
addRec(1, J.reavaliacao, "Plano de cuidados atualizado. Após a reavaliação de hoje, a Maria Helena passou para o grau II de dependência. Na prática: passamos a supervisionar o banho, a medicação passa a ser administrada pela equipe, e ela inicia fisioterapia duas vezes por semana. O plano completo já está disponível para você no aplicativo. A mudança contratual foi encaminhada à administração e a Débora entrará em contato.", "Rosana Prado Lima", "12:10");
addRec(1, 6, "A Maria Helena voltou a participar do coral nesta quarta e cantou duas músicas. A fisioterapeuta relatou boa evolução na marcha com apoio.", "Sandra Vieira Nogueira", "17:20");
addRec(1, 2, "Sessão de fisioterapia realizada hoje, com boa adesão. Ela pediu para avisar que gostaria de receber os netos no próximo domingo.", "Sandra Vieira Nogueira", "15:40");
for (const m of moradores.filter((x) => x.n !== 1)) {
  addRec(m.n, 3 + (m.n % 9), `Registro da semana: ${m.nome.split(" ")[0]} participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.`, "Marta Ribeiro Coelho", "16:30");
}

// ═══ 11. AGENDA (visitas de família e fisioterapia) ════════════════════════
sec("11 · Agenda — visitas da família e compromissos externos");
let compN = 0;
const addComp = (res, dias, titulo, horario, detalhes) => {
  compN += 1;
  add(`insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  (${q(uid(B.compromisso, compN))}, ${q(uid(B.residente, res))}, ${q(titulo)}, ${D(dias)}, ${q(horario)}, ${q(detalhes)})
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;`);
};
// Fisioterapia 2x/semana da protagonista (desde a reavaliação, incluindo futuras)
for (let d = J.reavaliacao; d >= -10; d -= 3) {
  addComp(1, d, "Fisioterapia motora", "10:00", "Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.");
}
addComp(1, -4, "Visita da família — Fernanda e netos", "15:00", "Visita agendada pela filha Fernanda pelo aplicativo.");
addComp(1, 9, "Visita da família — Fernanda", "15:30", "Visita realizada. Moradora recebeu a filha no jardim.");
addComp(1, 23, "Consulta com geriatra", "09:30", "Consulta de rotina com o Dr. Geraldo. Transporte por conta da família.");
for (const m of moradores.filter((x) => x.n !== 1)) {
  addComp(m.n, -(2 + (m.n % 7)), "Visita da família", `1${m.n % 6}:00`, `Visita agendada por ${m.resp}.`);
  addComp(m.n, 5 + (m.n % 11), "Visita da família", "15:00", "Visita realizada.");
}

// ═══ 12. ESCALA DE COBERTURA (mês corrente + anterior) ═════════════════════
sec("12 · Escala de cobertura assistencial (mês corrente e anterior)");
const tecnicos = [5, 6, 7, 8];   // n dos técnicos de enfermagem
const cuidadores = [9];
let turnoN = 0;
for (let d = 45; d >= -12; d--) {
  for (const [categoria, tag, hInicio, hFim, pool] of [
    ["cuidadoras", "diurno", "07:00", "19:00", cuidadores.concat(tecnicos)],
    ["cuidadoras", "noturno", "19:00", "07:00", tecnicos],
    ["enfermeiras", "diurno", "07:00", "19:00", [2]],
  ]) {
    // inicio/fim são timestamptz: o noturno termina no dia seguinte (d − 1).
    const tsInicio = TS(d, hInicio);
    const tsFim = tag === "noturno" ? TS(d - 1, hFim) : TS(d, hFim);
    turnoN += 1;
    const prof = pool[(d + turnoN) % pool.length];
    const passado = d > 0;
    add(`insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  (${q(uid(B.turno, turnoN))}, ${q(uid(B.usuario, prof))}, ${q(categoria)}, ${D(d)}, ${tsInicio}, ${tsFim}, ${q(tag)},
   ${passado ? TS(d, hInicio) : "null"}, ${passado ? TS(d, "19:05") : "null"})
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;`);
  }
}

// ═══ 13. DOCUMENTAÇÃO INSTITUCIONAL (o "checklist" de conformidade) ════════
sec("13 · Documentação institucional — conformidade regulatória");
const docs = [
  ["alvara_funcionamento", "Alvará de Funcionamento", "Prefeitura Municipal de Curitiba", 300, 65, "Renovação anual. Protocolo em dia."],
  ["cmvs", "CMVS — Cadastro Municipal de Vigilância Sanitária", "Secretaria Municipal da Saúde", 280, 22, "Renovação protocolada; aguardando publicação."],
  ["avcb", "AVCB — Auto de Vistoria do Corpo de Bombeiros", "Corpo de Bombeiros Militar do Paraná", 400, -12, "VENCIDO. Vistoria de renovação solicitada; laudo do sistema de alarme em execução pela contratada. Plano de ação em andamento, prazo de conclusão em 30 dias."],
  ["crt", "CRT — Certidão de Responsabilidade Técnica", "COREN-PR", 180, 185, null],
  ["controle_pragas", "Controle de vetores e pragas urbanas", "Empresa licenciada — CEVS", 45, 135, "Aplicação trimestral."],
  ["limpeza_caixa_agua", "Limpeza e desinfecção da caixa d'água", "Empresa licenciada", 70, 110, "Semestral, com laudo de potabilidade."],
  ["contrato_rss", "Contrato de coleta de resíduos de serviços de saúde", "Empresa licenciada — RSS", 320, 12, "Renovação em análise pelo jurídico. Minuta enviada em 20/08."],
  ["regulamento_interno", "Regulamento Interno da instituição", "Direção", 240, null, "Sem validade. Revisão anual concluída."],
  ["pgrss", "PGRSS — Plano de Gerenciamento de RSS", "Responsável Técnico", 210, 155, null],
  ["livro_admissao", "Livro de registro de admissão de residentes", "Direção", 350, null, "Sem validade. Atualizado."],
];
docs.forEach(([tipo, nome, orgao, emissao, validade, obs], i) =>
  add(`insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  (${q(uid(B.documento, i + 1))}, ${q(tipo)}, ${q(nome)}, ${q("DOC-" + String(2026000 + i))}, ${q(orgao)}, ${D(emissao)}, ${validade == null ? "null" : D(-validade)},
   'documentos-institucionais/demo/placeholder.pdf', ${q(obs)}, 'Débora Nunes Carvalho', ${TS(emissao, "10:00")})
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;`));

// ═══ 14. NPS ═══════════════════════════════════════════════════════════════
sec("14 · NPS das famílias");
const dimensoes = ["geral", "limpeza_suites", "limpeza_areas_comuns", "atendimento_equipe", "comida", "atividades_fisicas", "atividades_lazer", "lavanderia"];
let pesqN = 0, respN = 0;
for (const m of moradores) {
  pesqN += 1;
  const notaBase = m.n === 12 ? 8 : m.n % 4 === 0 ? 8 : 9;
  add(`insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  (${q(uid(B.npsPesq, pesqN))}, ${q(uid(B.residente, m.n))}, 'familiar', 'Débora Nunes Carvalho', 'administracao', ${D(12 + (m.n % 9))},
   ${q(m.n === 1 ? "A comunicação no dia da queda foi elogiada pela família: soube na mesma hora, pelo aplicativo e por telefone." : null)})
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;`);
  dimensoes.forEach((dim, j) => {
    respN += 1;
    add(`insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  (${q(uid(B.npsResp, respN))}, ${q(uid(B.npsPesq, pesqN))}, ${q(dim)}, ${num(Math.min(10, notaBase + (j % 2)))}, ${q(j === 3 && m.n === 1 ? "Fui avisada imediatamente e com detalhes. Isso faz muita diferença para quem mora longe." : null)})
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;`);
  });
}

// ═══ 15. ATIVIDADES / NUTRIÇÃO / LAVANDERIA / MANUTENÇÃO ═══════════════════
sec("15 · Atividades, nutrição, enxoval e manutenção");
const atividades = [
  ["Coral", "Ensaio do coral com acompanhamento de violão.", "10:00", ["qua"]],
  ["Oficina de memória", "Jogos de linguagem, palavras cruzadas e recordação orientada.", "15:00", ["ter", "qui"]],
  ["Ginástica funcional", "Exercícios de mobilidade e equilíbrio conduzidos pela fisioterapeuta.", "09:00", ["seg", "qua", "sex"]],
];
atividades.forEach(([titulo, desc, horario, dias], i) =>
  add(`insert into public.atividade (id, titulo, descricao, horario, recorrente, dias_semana, criada_por, criado_em) values
  (${q(uid(B.atividade, i + 1))}, ${q(titulo)}, ${q(desc)}, ${q(horario)}, true, array[${dias.map(q).join(", ")}]::text[], 'Sandra Vieira Nogueira', ${TS(J.admissao, "09:00")})
  on conflict (id) do update set titulo = excluded.titulo, descricao = excluded.descricao, horario = excluded.horario;`));
let partN = 0;
for (const m of moradores) {
  for (const d of [2, 6, 9]) {
    partN += 1;
    add(`insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  (${q(uid(B.participacao, partN))}, ${q(uid(B.atividade, ((m.n + d) % 3) + 1))}, ${D(d)}, ${q(uid(B.residente, m.n))},
   ${bool(!(m.n === 12 && d === 6))}, 'Sandra Vieira Nogueira', ${TS(d, "16:00")})
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;`);
  }
}
const cardapios = [["livre", null], ["diabetico", "Sem açúcar de adição; sobremesa de fruta."], ["pastosa", "Consistência pastosa homogênea, conforme avaliação fonoaudiológica."]];
for (let d = 2; d >= -5; d--) {
  cardapios.forEach(([tipo, obs], i) =>
    add(`insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  (${q(uid(B.cardapio, (2 - d) * 3 + i + 1))}, ${D(d)}, ${q(tipo)}, ${q(obs)}, 'Helena Fontes Vieira', ${TS(d + 3, "08:00")})
  on conflict (data, tipo_restricao) do nothing;`));
}
const enxovais = [
  ["roupa_cama", "Jogo de lençol solteiro — algodão 200 fios", 96, 74, 30],
  ["toalha_banho", "Toalha de banho branca", 120, 88, 40],
  ["toalha_rosto", "Toalha de rosto branca", 120, 96, 40],
  ["cobertor_manta", "Manta antialérgica solteiro", 48, 41, 20],
  ["fronha", "Fronha branca avulsa", 144, 26, 48],
];
enxovais.forEach(([cat, desc, total, disp, min], i) =>
  add(`insert into public.enxoval (id, categoria, descricao, quantidade_total, quantidade_disponivel, estoque_minimo, observacao, atualizado_em) values
  (${q(uid(B.enxoval, i + 1))}, ${q(cat)}, ${q(desc)}, ${num(total)}, ${num(disp)}, ${num(min)},
   ${q(disp < min ? "Abaixo do estoque mínimo. Reposição solicitada à administração." : null)}, ${TS(1, "11:00")})
  on conflict (id) do update set quantidade_total = excluded.quantidade_total,
    quantidade_disponivel = excluded.quantidade_disponivel, estoque_minimo = excluded.estoque_minimo, observacao = excluded.observacao;`));
add(`insert into public.chamado_manutencao (id, local, residente_id, problema, urgencia, status, aberto_por, perfil_solicitante, destino, responsavel, criado_em) values
  (${q(uid(B.chamado, 1))}, 'Suíte 204 — banheiro', ${q(uid(B.residente, 1))},
   'Instalação de barra de apoio adicional no box e troca do piso por revestimento antiderrapante, após a queda da moradora.',
   'alta', 'em_andamento', 'Rosana Prado Lima', 'coordenacao', 'servicos_gerais', 'Manutenção predial', ${TS(J.queda - 1, "08:30")}),
  (${q(uid(B.chamado, 2))}, 'Área comum — jardim', null, 'Revisão da iluminação do caminho do jardim.', 'baixa', 'aberto', 'Débora Nunes Carvalho', 'master', 'servicos_gerais', null, ${TS(4, "14:00")})
  on conflict (id) do update set problema = excluded.problema, status = excluded.status, urgencia = excluded.urgencia;`);

// ═══ 16. LOGINS ════════════════════════════════════════════════════════════
sec("16 · Logins (senha: blue)");
add(`do $$
declare u record; uid_novo uuid; ok int := 0;
begin
  for u in select * from public.usuarios where email ilike 'demo.%@demo.local' loop
    begin
      delete from auth.identities i using auth.users au
        where au.id = i.user_id and lower(au.email) = lower(u.email);
      delete from auth.users where lower(email) = lower(u.email);
      uid_novo := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid_novo, 'authenticated', 'authenticated',
        lower(u.email), crypt('blue', gen_salt('bf')),
        now(), now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        '', '', '', '', '', '', '', ''
      );
      begin
        insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
        values (gen_random_uuid(), lower(u.email), uid_novo,
          jsonb_build_object('sub', uid_novo::text, 'email', lower(u.email), 'email_verified', true),
          'email', now(), now(), now());
      exception when others then
        insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
        values (lower(u.email), uid_novo,
          jsonb_build_object('sub', uid_novo::text, 'email', lower(u.email), 'email_verified', true),
          'email', now(), now(), now());
      end;
      ok := ok + 1;
    exception when others then
      raise notice 'login FALHOU para %: %', u.email, sqlerrm;
    end;
  end loop;
  raise notice 'Logins da demo criados/atualizados: %', ok;
end $$;`);

// ═══════════════════════════════════════════════════════════════════════════
// EMISSÃO
// ═══════════════════════════════════════════════════════════════════════════
const cabecalho = `-- ===========================================================================
-- CENÁRIO "DEMO" — Blue Senior Living  ·  GERADO AUTOMATICAMENTE
-- Fonte: demo-assets/gerar-demo.mjs   ·   NÃO EDITE ESTE ARQUIVO À MÃO.
-- ---------------------------------------------------------------------------
-- COMO USAR
--   1. Supabase → SQL Editor → cole este arquivo inteiro → Run.
--   2. Rodar duas vezes NÃO duplica nada (tudo é idempotente por id).
--   3. Para remover: rode demo-assets/seed/DEMO_LIMPEZA.sql.
--
-- ISOLAMENTO: todo registro nasce no bloco de UUID de3000xx-…, e a limpeza
-- apaga exatamente esse bloco. Nomes são plausíveis e SEM prefixo, porque as
-- telas precisam parecer reais nas capturas.
--
-- DEMO_REFERENCE_DATE: a função demo_ref() abaixo define o "hoje" do cenário.
-- Por padrão é a data em que você roda o seed — rode no dia da reunião e as
-- evoluções, a agenda e os indicadores aparecem como "de hoje".
-- Para fixar uma data, troque current_date pela data desejada, por exemplo:
--   ... as $$ select date '2026-09-15' $$;
-- ===========================================================================

create extension if not exists pgcrypto;

create or replace function public.demo_ref() returns date
  language sql stable as $$ select current_date $$;

`;

const rodape = `

-- ── Conferência ────────────────────────────────────────────────────────────
do $$
declare n_res int; n_usu int; n_evo int; n_tur int;
begin
  select count(*) into n_res from public.residentes  where id::text like 'de300010%';
  select count(*) into n_usu from public.usuarios    where id::text like 'de300020%';
  select count(*) into n_evo from public.evolucao    where id::text like 'de300044%';
  select count(*) into n_tur from public.turnos      where id::text like 'de300050%';
  raise notice 'DEMO carregada: % moradores, % usuários, % evoluções, % turnos.', n_res, n_usu, n_evo, n_tur;
end $$;
`;

mkdirSync("demo-assets/seed", { recursive: true });
writeFileSync("demo-assets/seed/DEMO_SEED.sql", cabecalho + linhas.join("\n") + rodape);

// ─── LIMPEZA ───────────────────────────────────────────────────────────────
const tabelasPorId = [
  ["nps_resposta", B.npsResp], ["nps_pesquisa", B.npsPesq], ["atividade_participacao", B.participacao],
  ["atividade", B.atividade], ["cardapio", B.cardapio], ["enxoval_movimento", null],
  ["enxoval", B.enxoval], ["chamado_manutencao", B.chamado], ["documento_institucional", B.documento],
  ["turnos", B.turno], ["compromisso_externo", B.compromisso], ["recado_familia", B.recado],
  ["evento_sentinela", B.sentinela], ["intercorrencia", B.intercorrencia], ["evolucao", B.evolucao],
  ["prescricao", B.prescricao], ["plano_cuidado_item", B.plano], ["teste_cognitivo", B.cognitivo],
  ["avaliacao_ivcf", B.ivcf], ["crm_evento", B.crmEvento], ["crm_oportunidade", B.crmOport],
  ["crm_contato", B.crmContato],
];
const limpeza = `-- ===========================================================================
-- LIMPEZA DO CENÁRIO "DEMO" — Blue Senior Living  ·  GERADO AUTOMATICAMENTE
-- ---------------------------------------------------------------------------
-- Remove TUDO que o DEMO_SEED.sql criou e NADA além disso: apaga apenas os
-- registros no bloco de UUID de3000xx-… e os logins @demo.local.
-- Pode rodar quantas vezes quiser. Supabase → SQL Editor → cole → Run.
-- ===========================================================================

-- 1) Registros criados DURANTE a demo que apontam para os moradores fictícios
--    (administração de medicação, checklist, solicitações, etc.).
delete from public.administracao        where residente_id::text like 'de300010%';
delete from public.tarefa_registro      where residente_id::text like 'de300010%';
delete from public.eliminacao           where residente_id::text like 'de300010%';
delete from public.solicitacao_familia  where residente_id::text like 'de300010%';
delete from public.dispensacao          where residente_id::text like 'de300010%';
delete from public.estoque_hospede      where residente_id::text like 'de300010%';
delete from public.dieta                where residente_id::text like 'de300010%';
delete from public.pagamento_mensalidade where residente_id::text like 'de300010%';
delete from public.upselling            where residente_id::text like 'de300010%';

-- 2) Tudo o que o seed criou, na ordem de dependência.
${tabelasPorId.filter(([, b]) => b).map(([t, b]) => `delete from public.${t} where id::text like 'de3000${b}%';`).join("\n")}
delete from public.chamado_manutencao   where residente_id::text like 'de300010%';
delete from public.evolucao             where residente_id::text like 'de300010%';

-- 3) Devolve o funil comercial e os moradores ao estado anterior.
update public.crm_oportunidade o set status = b.status
  from public.demo_backup_crm b where o.id = b.id;
drop table if exists public.demo_backup_crm;

update public.residentes r
   set status_hospede = 'ativo', data_saida = b.data_saida
  from public.demo_backup_residentes b where r.id = b.id;
drop table if exists public.demo_backup_residentes;

-- 4) Equipe e moradores — nesta ordem: usuarios.residente_vinculado
--    referencia residentes, então a equipe precisa sair primeiro.
delete from public.usuarios   where id::text like 'de300020%';
delete from public.residentes where id::text like 'de300010%';

-- 5) Logins da demo.
delete from auth.identities i using auth.users au
  where au.id = i.user_id and lower(au.email) like 'demo.%@demo.local';
delete from auth.users where lower(email) like 'demo.%@demo.local';

-- 6) A função de data de referência.
drop function if exists public.demo_ref();

do $$
declare n int;
begin
  select count(*) into n from public.residentes where id::text like 'de300010%';
  raise notice 'Limpeza concluída. Moradores da demo restantes: % (esperado: 0).', n;
end $$;
`;
writeFileSync("demo-assets/seed/DEMO_LIMPEZA.sql", limpeza);

// ─── DADOS PARA O HARNESS DE CAPTURAS ──────────────────────────────────────
writeFileSync("demo-assets/dados-demo.json", JSON.stringify({ equipe, moradores, jornada: J, uid: { bloco: B } }, null, 2));

console.log(`DEMO_SEED.sql      → ${linhas.length} comandos`);
console.log(`DEMO_LIMPEZA.sql   → ok`);
console.log(`dados-demo.json    → ${moradores.length} moradores, ${equipe.length} usuários`);
