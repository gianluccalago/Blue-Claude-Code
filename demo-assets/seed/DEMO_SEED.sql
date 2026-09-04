-- ===========================================================================
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


-- ── 0 · Moradores pré-existentes saem de cena (REVERSÍVEL) ──────────────

create table if not exists public.demo_backup_residentes as
  select id, data_saida from public.residentes
  where status_hospede = 'ativo' and id::text not like 'de300010%';
update public.residentes
     set status_hospede = 'inativo',
         data_saida = coalesce(data_saida, demo_ref() - 200)
   where id in (select id from public.demo_backup_residentes);

-- ── 1 · Moradores (12 ativos) ───────────────────────────────────────────

insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000001', 'Maria Helena Andrade', '1947-03-18', 'II', 'I', '204', 5, 2, 'Suíte', 'simples',
   'Fernanda Andrade Ribeiro', '(41) 99612-4477', 'Fernanda Andrade Ribeiro', '(41) 99612-4477', null, 12400, (demo_ref() - 120),
   'Professora aposentada da rede estadual, lecionou português por 34 anos. Viúva desde 2019, mãe de duas filhas. Gosta de leitura, palavras cruzadas e do coral às quartas.')
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000002', 'Aparecida Nunes Vidal', '1944-07-02', 'I', 'I', '201', 5, 2, 'Suíte', 'simples',
   'Cláudio Nunes Vidal', '(41) 99845-1120', 'Cláudio Nunes Vidal', '(41) 99845-1120', null, 9800, (demo_ref() - 104),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000003', 'Conceição Dias Ferraz', '1949-11-25', 'I', 'I', '108', 5, 1, 'Long Stay', 'simples',
   'Beatriz Dias Ferraz', '(41) 99231-8890', 'Beatriz Dias Ferraz', '(41) 99231-8890', null, 9800, (demo_ref() - 126),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000004', 'Waldir Campos Rocha', '1943-01-09', 'I', 'I', '302', 5, 3, 'Apartamento', 'simples',
   'Sérgio Campos Rocha', '(41) 99770-3312', 'Sérgio Campos Rocha', '(41) 99770-3312', null, 9800, (demo_ref() - 148),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000005', 'Nelson Barreto Aguiar', '1946-05-14', 'I', 'I', '305', 5, 3, 'Apartamento', 'simples',
   'Marina Barreto Aguiar', '(41) 99188-7745', 'Marina Barreto Aguiar', '(41) 99188-7745', null, 9800, (demo_ref() - 170),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000006', 'Yolanda Prates Coelho', '1941-09-30', 'I', 'I', '206', 5, 2, 'Suíte', 'simples',
   'Rogério Prates Coelho', '(41) 99554-2201', 'Rogério Prates Coelho', '(41) 99554-2201', null, 9800, (demo_ref() - 192),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000007', 'Ivone Salgado Reis', '1948-02-11', 'I', 'I', '110', 5, 1, 'Long Stay', 'simples',
   'Tatiana Salgado Reis', '(41) 99903-6678', 'Tatiana Salgado Reis', '(41) 99903-6678', null, 9800, (demo_ref() - 214),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000008', 'Arnaldo Bicudo Franco', '1945-12-03', 'I', 'I', '308', 5, 3, 'Apartamento', 'simples',
   'Luiza Bicudo Franco', '(41) 99417-9024', 'Luiza Bicudo Franco', '(41) 99417-9024', null, 9800, (demo_ref() - 236),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000009', 'Lúcia Moraes Tavares', '1940-06-21', 'II', 'II', '209', 5, 2, 'Suíte', 'simples',
   'Paulo Moraes Tavares', '(41) 99326-5580', 'Paulo Moraes Tavares', '(41) 99326-5580', null, 12400, (demo_ref() - 258),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000010', 'Otávio Prado Sanches', '1939-08-17', 'II', 'II', '212', 5, 2, 'Suíte Premium', 'simples',
   'Renata Prado Sanches', '(41) 99640-1193', 'Renata Prado Sanches', '(41) 99640-1193', 'Dipirona', 12400, (demo_ref() - 280),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000011', 'Célia Bastos Meireles', '1942-04-06', 'II', 'II', '215', 5, 2, 'Suíte', 'simples',
   'André Bastos Meireles', '(41) 99872-4406', 'André Bastos Meireles', '(41) 99872-4406', null, 12400, (demo_ref() - 302),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;
insert into public.residentes (id, nome, data_nascimento, grau_dependencia, grau_contratual, quarto, modulo, andar, tipo_suite, ocupacao,
  responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone, alergias, mensalidade_valor, data_admissao, historia_vida) values
  ('de300010-0000-4000-8000-000000000012', 'Therezinha Alves Moreira', '1936-10-28', 'III', 'II', '218', 5, 2, 'Suíte Premium', 'simples',
   'Vera Alves Moreira', '(41) 99205-7731', 'Vera Alves Moreira', '(41) 99205-7731', null, 15200, (demo_ref() - 324),
   null)
  on conflict (id) do update set nome = excluded.nome, grau_dependencia = excluded.grau_dependencia,
    grau_contratual = excluded.grau_contratual, quarto = excluded.quarto, modulo = excluded.modulo,
    andar = excluded.andar, tipo_suite = excluded.tipo_suite,
    responsavel_legal = excluded.responsavel_legal, contato = excluded.contato, alergias = excluded.alergias,
    mensalidade_valor = excluded.mensalidade_valor, data_admissao = excluded.data_admissao, historia_vida = excluded.historia_vida;

-- ── 2 · Equipe (login: e-mail abaixo, senha blue) ───────────────────────

insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000001', 'Ricardo Salles Monteiro', 'demo.diretor@demo.local', 'master', true, 'Diretor', null, null, null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000002', 'Rosana Prado Lima', 'demo.rosana@demo.local', 'enfermeira', true, 'Enfermeira Responsável Técnica', null, 'COREN-PR 312.884', null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000003', 'Marta Ribeiro Coelho', 'demo.marta@demo.local', 'coordenacao', true, 'Coordenação assistencial', null, null, null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000004', 'Geraldo Antunes Vaz', 'demo.medico@demo.local', 'medico', true, 'Médico geriatra', null, 'CRM-PR 28.417', null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000005', 'Camila Duarte Pinho', 'demo.camila@demo.local', 'enfermagem', true, 'Técnica de Enfermagem', 'CLT', null, null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000006', 'Juliana Ferraz Amado', 'demo.juliana@demo.local', 'enfermagem', true, 'Técnica de Enfermagem', 'CLT', null, null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000007', 'Patrícia Gomes Vilela', 'demo.patricia@demo.local', 'enfermagem', true, 'Técnica de Enfermagem', 'CLT', null, null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000008', 'Simone Barros Tavares', 'demo.simone@demo.local', 'enfermagem', true, 'Técnica de Enfermagem', 'CLT', null, null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000009', 'Tereza Lopes Andrade', 'demo.tereza@demo.local', 'cuidador', true, 'Cuidadora diurna', 'CLT', null, null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000010', 'Helena Fontes Vieira', 'demo.helena@demo.local', 'nutricionista', true, 'Nutricionista', null, 'CRN-8 9.412', null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000011', 'Sandra Vieira Nogueira', 'demo.sandra@demo.local', 'multidisciplinar', true, 'Fisioterapeuta', null, 'CREFITO-8 148.220', null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000012', 'Débora Nunes Carvalho', 'demo.debora@demo.local', 'administracao', true, 'Recepção e administrativo', null, null, null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000013', 'Paulo Cesar Werneck', 'demo.farmacia@demo.local', 'farmacia', true, 'Farmácia', null, null, null, (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, residente_vinculado, data_admissao) values
  ('de300020-0000-4000-8000-000000000014', 'Fernanda Andrade Ribeiro', 'demo.fernanda@demo.local', 'familia', true, 'Filha de Maria Helena', null, null, 'de300010-0000-4000-8000-000000000001', (demo_ref() - 150))
  on conflict (id) do update set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
    funcao = excluded.funcao, registro_profissional = excluded.registro_profissional,
    residente_vinculado = excluded.residente_vinculado, ativo = true;

-- ── 3 · CRM — jornada da Fernanda (ganha) + 2 leads em andamento ────────

create table if not exists public.demo_backup_crm as
  select id, status from public.crm_oportunidade where id::text not like 'de30003%';
update public.crm_oportunidade set status = 'pausada'
  where id in (select id from public.demo_backup_crm);
insert into public.crm_contato (id, nome, telefones, emails, relacao, nome_idoso, idade_idoso, grau_estimado, base_legal_lgpd, criado_em) values
  ('de300030-0000-4000-8000-000000000001', 'Fernanda Andrade Ribeiro', array['(41) 99612-4477'], array['fernanda.andrade@exemplo.com.br'], 'Filha', 'Maria Helena Andrade', 79, 'I', 'consentimento', ((demo_ref() - 150)::timestamp + time '10:20'))
  on conflict (id) do update set nome = excluded.nome, telefones = excluded.telefones, emails = excluded.emails,
    relacao = excluded.relacao, nome_idoso = excluded.nome_idoso, idade_idoso = excluded.idade_idoso;
insert into public.crm_contato (id, nome, telefones, emails, relacao, nome_idoso, idade_idoso, grau_estimado, base_legal_lgpd, criado_em) values
  ('de300030-0000-4000-8000-000000000002', 'Regina Mattos Peixoto', array['(41) 99728-5510'], array['regina.mattos@exemplo.com.br'], 'Filha', 'Sônia Mattos Peixoto', 81, 'II', 'consentimento', ((demo_ref() - 28)::timestamp + time '10:20'))
  on conflict (id) do update set nome = excluded.nome, telefones = excluded.telefones, emails = excluded.emails,
    relacao = excluded.relacao, nome_idoso = excluded.nome_idoso, idade_idoso = excluded.idade_idoso;
insert into public.crm_contato (id, nome, telefones, emails, relacao, nome_idoso, idade_idoso, grau_estimado, base_legal_lgpd, criado_em) values
  ('de300030-0000-4000-8000-000000000003', 'Marcos Ferrari Bueno', array['(41) 99333-2087'], array['marcos.ferrari@exemplo.com.br'], 'Filho', 'João Batista Ferrari', 77, 'I', 'consentimento', ((demo_ref() - 29)::timestamp + time '10:20'))
  on conflict (id) do update set nome = excluded.nome, telefones = excluded.telefones, emails = excluded.emails,
    relacao = excluded.relacao, nome_idoso = excluded.nome_idoso, idade_idoso = excluded.idade_idoso;
insert into public.crm_oportunidade (id, nome, contato_id, origem_id, qualificacao, valor_mensalidade_estimado, tipo_suite_interesse,
  previsao_fechamento, etapa, status, responsavel, residente_id, criado_em, fechado_em) values
  ('de300031-0000-4000-8000-000000000001', 'Família Andrade — Maria Helena', 'de300030-0000-4000-8000-000000000001', (select id from public.crm_origem where nome = 'Indicação de família' limit 1), 5, 9800, 'Suíte',
   (demo_ref() - 122), 'Admissão', 'ganha', 'Débora Nunes Carvalho', 'de300010-0000-4000-8000-000000000001',
   ((demo_ref() - 150)::timestamp + time '10:25'), ((demo_ref() - 122)::timestamp + time '16:40'))
  on conflict (id) do update set etapa = excluded.etapa, status = excluded.status, qualificacao = excluded.qualificacao,
    valor_mensalidade_estimado = excluded.valor_mensalidade_estimado, criado_em = excluded.criado_em, fechado_em = excluded.fechado_em;
insert into public.crm_oportunidade (id, nome, contato_id, origem_id, qualificacao, valor_mensalidade_estimado, tipo_suite_interesse,
  previsao_fechamento, etapa, status, responsavel, residente_id, criado_em, fechado_em) values
  ('de300031-0000-4000-8000-000000000002', 'Família Peixoto — Sônia', 'de300030-0000-4000-8000-000000000002', (select id from public.crm_origem where nome = 'Site' limit 1), 4, 12400, 'Suíte',
   (demo_ref() - -18), 'Visita realizada', 'em_andamento', 'Débora Nunes Carvalho', null,
   ((demo_ref() - 29)::timestamp + time '10:25'), null)
  on conflict (id) do update set etapa = excluded.etapa, status = excluded.status, qualificacao = excluded.qualificacao,
    valor_mensalidade_estimado = excluded.valor_mensalidade_estimado, criado_em = excluded.criado_em, fechado_em = excluded.fechado_em;
insert into public.crm_oportunidade (id, nome, contato_id, origem_id, qualificacao, valor_mensalidade_estimado, tipo_suite_interesse,
  previsao_fechamento, etapa, status, responsavel, residente_id, criado_em, fechado_em) values
  ('de300031-0000-4000-8000-000000000003', 'Família Ferrari — João Batista', 'de300030-0000-4000-8000-000000000003', (select id from public.crm_origem where nome = 'Site' limit 1), 4, 9800, 'Long Stay',
   (demo_ref() - -18), 'Proposta enviada', 'em_andamento', 'Débora Nunes Carvalho', null,
   ((demo_ref() - 34)::timestamp + time '10:25'), null)
  on conflict (id) do update set etapa = excluded.etapa, status = excluded.status, qualificacao = excluded.qualificacao,
    valor_mensalidade_estimado = excluded.valor_mensalidade_estimado, criado_em = excluded.criado_em, fechado_em = excluded.fechado_em;
insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  ('de300032-0000-4000-8000-000000000001', 'de300031-0000-4000-8000-000000000001', 'ligacao', 'Primeiro contato por telefone. Indicação da vizinha, Sra. Neusa. A filha (Fernanda) descreve a mãe como independente, viúva, morando sozinha desde 2019. Preocupação principal: solidão e segurança à noite.', 'Débora Nunes Carvalho', ((demo_ref() - 150)::timestamp + time '14:05'))
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;
insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  ('de300032-0000-4000-8000-000000000002', 'de300031-0000-4000-8000-000000000001', 'agendamento', 'Visita agendada para o sábado seguinte, às 10h. Fernanda virá com a mãe e com a irmã.', 'Débora Nunes Carvalho', ((demo_ref() - 143)::timestamp + time '14:05'))
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;
insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  ('de300032-0000-4000-8000-000000000003', 'de300031-0000-4000-8000-000000000001', 'visita', 'Visita realizada. Maria Helena gostou do apartamento 204 e do coral das quartas. Perguntas da família: rotina de medicação, o que acontece se a mãe precisar de mais cuidado no futuro, e se a família consegue acompanhar à distância.', 'Débora Nunes Carvalho', ((demo_ref() - 138)::timestamp + time '14:05'))
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;
insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  ('de300032-0000-4000-8000-000000000004', 'de300031-0000-4000-8000-000000000001', 'proposta', 'Proposta enviada: Suíte 204, grau I, mensalidade R$ 9.800. Incluída a explicação do reenquadramento de grau caso a necessidade mude.', 'Débora Nunes Carvalho', ((demo_ref() - 131)::timestamp + time '14:05'))
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;
insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  ('de300032-0000-4000-8000-000000000005', 'de300031-0000-4000-8000-000000000001', 'contrato', 'Contrato assinado. Admissão agendada. Fernanda cadastrada como responsável e como acesso da família no aplicativo.', 'Débora Nunes Carvalho', ((demo_ref() - 122)::timestamp + time '14:05'))
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;
insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  ('de300032-0000-4000-8000-000000000006', 'de300031-0000-4000-8000-000000000002', 'ligacao', 'Contato pelo site. Mãe com limitação de mobilidade após cirurgia de quadril; busca suporte moderado.', 'Débora Nunes Carvalho', ((demo_ref() - 29)::timestamp + time '14:05'))
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;
insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  ('de300032-0000-4000-8000-000000000007', 'de300031-0000-4000-8000-000000000002', 'visita', 'Visita realizada com a filha e o genro. Interesse na Suíte 209. Aguardando decisão da família.', 'Débora Nunes Carvalho', ((demo_ref() - 24)::timestamp + time '14:05'))
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;
insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  ('de300032-0000-4000-8000-000000000008', 'de300031-0000-4000-8000-000000000003', 'ligacao', 'Indicação médica (geriatra). Pai independente, quer conviver mais.', 'Débora Nunes Carvalho', ((demo_ref() - 34)::timestamp + time '14:05'))
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;
insert into public.crm_evento (id, oportunidade_id, tipo, descricao, autor, criado_em) values
  ('de300032-0000-4000-8000-000000000009', 'de300031-0000-4000-8000-000000000003', 'proposta', 'Proposta enviada para Long Stay. Retorno previsto para a próxima semana.', 'Débora Nunes Carvalho', ((demo_ref() - 20)::timestamp + time '14:05'))
  on conflict (id) do update set descricao = excluded.descricao, criado_em = excluded.criado_em;

-- ── 4 · Avaliação geriátrica (IVCF-20) — admissão e reavaliação ─────────

insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', '{"idade":0,"autopercepcao_saude":0,"avd_instrumental":0,"avd_basica":0,"cognicao":0,"humor":1,"mobilidade":2,"comunicacao":0,"comorbidades":3}'::jsonb, 6, 'Grau I',
   array[]::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 120)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000002', 'de300010-0000-4000-8000-000000000001', '{"idade":0,"autopercepcao_saude":1,"avd_instrumental":4,"avd_basica":2,"cognicao":0,"humor":2,"mobilidade":5,"comunicacao":0,"comorbidades":3}'::jsonb, 17, 'Grau II',
   array['Mobilidade', 'Humor', 'AVD instrumental']::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 14)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000003', 'de300010-0000-4000-8000-000000000002', '{"idade":0,"avd_instrumental":0,"avd_basica":0,"cognicao":0,"mobilidade":2,"comorbidades":3}'::jsonb, 7, 'Grau I',
   array[]::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 102)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000004', 'de300010-0000-4000-8000-000000000003', '{"idade":0,"avd_instrumental":0,"avd_basica":0,"cognicao":0,"mobilidade":2,"comorbidades":3}'::jsonb, 5, 'Grau I',
   array[]::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 124)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000005', 'de300010-0000-4000-8000-000000000004', '{"idade":0,"avd_instrumental":0,"avd_basica":0,"cognicao":0,"mobilidade":2,"comorbidades":3}'::jsonb, 6, 'Grau I',
   array[]::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 146)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000006', 'de300010-0000-4000-8000-000000000005', '{"idade":0,"avd_instrumental":0,"avd_basica":0,"cognicao":0,"mobilidade":2,"comorbidades":3}'::jsonb, 7, 'Grau I',
   array[]::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 168)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000007', 'de300010-0000-4000-8000-000000000006', '{"idade":0,"avd_instrumental":0,"avd_basica":0,"cognicao":0,"mobilidade":2,"comorbidades":3}'::jsonb, 5, 'Grau I',
   array[]::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 190)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000008', 'de300010-0000-4000-8000-000000000007', '{"idade":0,"avd_instrumental":0,"avd_basica":0,"cognicao":0,"mobilidade":2,"comorbidades":3}'::jsonb, 6, 'Grau I',
   array[]::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 212)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000009', 'de300010-0000-4000-8000-000000000008', '{"idade":0,"avd_instrumental":0,"avd_basica":0,"cognicao":0,"mobilidade":2,"comorbidades":3}'::jsonb, 7, 'Grau I',
   array[]::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 234)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000010', 'de300010-0000-4000-8000-000000000009', '{"idade":0,"avd_instrumental":4,"avd_basica":0,"cognicao":0,"mobilidade":5,"comorbidades":3}'::jsonb, 17, 'Grau II',
   array['Mobilidade', 'AVD instrumental']::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 256)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000011', 'de300010-0000-4000-8000-000000000010', '{"idade":0,"avd_instrumental":4,"avd_basica":0,"cognicao":0,"mobilidade":5,"comorbidades":3}'::jsonb, 18, 'Grau II',
   array['Mobilidade', 'AVD instrumental']::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 278)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000012', 'de300010-0000-4000-8000-000000000011', '{"idade":0,"avd_instrumental":4,"avd_basica":0,"cognicao":0,"mobilidade":5,"comorbidades":3}'::jsonb, 19, 'Grau II',
   array['Mobilidade', 'AVD instrumental']::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 300)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;
insert into public.avaliacao_ivcf (id, residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, itens_indisponiveis, registrado_por, registrado_em) values
  ('de300040-0000-4000-8000-000000000013', 'de300010-0000-4000-8000-000000000012', '{"idade":3,"avd_instrumental":4,"avd_basica":6,"cognicao":4,"mobilidade":5,"comorbidades":3}'::jsonb, 28, 'Grau III',
   array['Mobilidade', 'AVD básica', 'Cognição', 'Comorbidades']::text[], array[]::text[], 'Rosana Prado Lima', ((demo_ref() - 322)::timestamp + time '11:15'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    classificacao = excluded.classificacao, dominios_alterados = excluded.dominios_alterados, registrado_em = excluded.registrado_em;

-- ── 5 · Avaliação cognitiva (MEEM) ──────────────────────────────────────

insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":3,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":0}'::jsonb, 28, 16, 'Dentro da normalidade para a escolaridade (16 anos de estudo). Sem indício de comprometimento cognitivo. Reavaliar em 12 meses ou antes, se houver mudança funcional.', 'Geraldo Antunes Vaz', ((demo_ref() - 119)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000002', 'de300010-0000-4000-8000-000000000002', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 25, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 103)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000003', 'de300010-0000-4000-8000-000000000003', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 27, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 125)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000004', 'de300010-0000-4000-8000-000000000004', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 26, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 147)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000005', 'de300010-0000-4000-8000-000000000005', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 25, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 169)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000006', 'de300010-0000-4000-8000-000000000006', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 27, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 191)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000007', 'de300010-0000-4000-8000-000000000007', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 26, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 213)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000008', 'de300010-0000-4000-8000-000000000008', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 25, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 235)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000009', 'de300010-0000-4000-8000-000000000009', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 23, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 257)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000010', 'de300010-0000-4000-8000-000000000010', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 22, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 279)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000011', 'de300010-0000-4000-8000-000000000011', 'MEEM', '{"orientacao_temporal":5,"orientacao_espacial":5,"registro":3,"registro_tentativas":1,"atencao_calculo":4,"evocacao":2,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 21, 8, 'Escore dentro do esperado para a escolaridade. Manter acompanhamento de rotina.', 'Geraldo Antunes Vaz', ((demo_ref() - 301)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;
insert into public.teste_cognitivo (id, residente_id, tipo, respostas, pontuacao_total, escolaridade_anos, interpretacao, aplicado_por, aplicado_em) values
  ('de300041-0000-4000-8000-000000000012', 'de300010-0000-4000-8000-000000000012', 'MEEM', '{"orientacao_temporal":2,"orientacao_espacial":3,"registro":3,"registro_tentativas":1,"atencao_calculo":1,"evocacao":0,"ling_nomear":2,"ling_repetir":1,"ling_comando":3,"ling_ler_executar":1,"ling_escrever":1,"ling_copiar":1}'::jsonb, 14, 8, 'Escore compatível com comprometimento cognitivo. Encaminhado ao geriatra para investigação e ajuste do plano de cuidados.', 'Geraldo Antunes Vaz', ((demo_ref() - 323)::timestamp + time '10:40'))
  on conflict (id) do update set respostas = excluded.respostas, pontuacao_total = excluded.pontuacao_total,
    interpretacao = excluded.interpretacao, aplicado_em = excluded.aplicado_em;

-- ── 6 · Plano de cuidados vigente ───────────────────────────────────────

insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', 'Supervisão de banho', '07:30', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000002', 'de300010-0000-4000-8000-000000000001', 'Administração assistida de medicação', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000003', 'de300010-0000-4000-8000-000000000001', 'Aferir pressão arterial', '08:15', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000004', 'de300010-0000-4000-8000-000000000001', 'Acompanhar sessão de fisioterapia', '10:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000005', 'de300010-0000-4000-8000-000000000001', 'Reavaliação de risco de queda', '17:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000006', 'de300010-0000-4000-8000-000000000002', 'Aferir pressão arterial', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000007', 'de300010-0000-4000-8000-000000000002', 'Conferência semanal da medicação de uso contínuo', '09:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000008', 'de300010-0000-4000-8000-000000000002', 'Estímulo a atividades de convívio', '15:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000009', 'de300010-0000-4000-8000-000000000003', 'Aferir pressão arterial', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000010', 'de300010-0000-4000-8000-000000000003', 'Conferência semanal da medicação de uso contínuo', '09:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000011', 'de300010-0000-4000-8000-000000000003', 'Estímulo a atividades de convívio', '15:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000012', 'de300010-0000-4000-8000-000000000004', 'Aferir pressão arterial', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000013', 'de300010-0000-4000-8000-000000000004', 'Conferência semanal da medicação de uso contínuo', '09:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000014', 'de300010-0000-4000-8000-000000000004', 'Estímulo a atividades de convívio', '15:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000015', 'de300010-0000-4000-8000-000000000005', 'Aferir pressão arterial', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000016', 'de300010-0000-4000-8000-000000000005', 'Conferência semanal da medicação de uso contínuo', '09:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000017', 'de300010-0000-4000-8000-000000000005', 'Estímulo a atividades de convívio', '15:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000018', 'de300010-0000-4000-8000-000000000006', 'Aferir pressão arterial', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000019', 'de300010-0000-4000-8000-000000000006', 'Conferência semanal da medicação de uso contínuo', '09:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000020', 'de300010-0000-4000-8000-000000000006', 'Estímulo a atividades de convívio', '15:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000021', 'de300010-0000-4000-8000-000000000007', 'Aferir pressão arterial', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000022', 'de300010-0000-4000-8000-000000000007', 'Conferência semanal da medicação de uso contínuo', '09:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000023', 'de300010-0000-4000-8000-000000000007', 'Estímulo a atividades de convívio', '15:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000024', 'de300010-0000-4000-8000-000000000008', 'Aferir pressão arterial', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000025', 'de300010-0000-4000-8000-000000000008', 'Conferência semanal da medicação de uso contínuo', '09:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000026', 'de300010-0000-4000-8000-000000000008', 'Estímulo a atividades de convívio', '15:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000027', 'de300010-0000-4000-8000-000000000009', 'Supervisão de banho', '07:30', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000028', 'de300010-0000-4000-8000-000000000009', 'Administração assistida de medicação', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000029', 'de300010-0000-4000-8000-000000000009', 'Aferir pressão arterial', '08:15', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000030', 'de300010-0000-4000-8000-000000000009', 'Acompanhar sessão de fisioterapia', '10:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000031', 'de300010-0000-4000-8000-000000000009', 'Reavaliação de risco de queda', '17:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000032', 'de300010-0000-4000-8000-000000000010', 'Supervisão de banho', '07:30', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000033', 'de300010-0000-4000-8000-000000000010', 'Administração assistida de medicação', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000034', 'de300010-0000-4000-8000-000000000010', 'Aferir pressão arterial', '08:15', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000035', 'de300010-0000-4000-8000-000000000010', 'Acompanhar sessão de fisioterapia', '10:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000036', 'de300010-0000-4000-8000-000000000010', 'Reavaliação de risco de queda', '17:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000037', 'de300010-0000-4000-8000-000000000011', 'Supervisão de banho', '07:30', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000038', 'de300010-0000-4000-8000-000000000011', 'Administração assistida de medicação', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000039', 'de300010-0000-4000-8000-000000000011', 'Aferir pressão arterial', '08:15', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000040', 'de300010-0000-4000-8000-000000000011', 'Acompanhar sessão de fisioterapia', '10:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000041', 'de300010-0000-4000-8000-000000000011', 'Reavaliação de risco de queda', '17:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000042', 'de300010-0000-4000-8000-000000000012', 'Higiene assistida completa', '07:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000043', 'de300010-0000-4000-8000-000000000012', 'Administração de medicação', '08:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000044', 'de300010-0000-4000-8000-000000000012', 'Mudança de decúbito', '10:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000045', 'de300010-0000-4000-8000-000000000012', 'Acompanhar fisioterapia motora e respiratória', '11:00', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000046', 'de300010-0000-4000-8000-000000000012', 'Controle de aceitação alimentar', '12:30', 'cuidador', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;
insert into public.plano_cuidado_item (id, residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
  ('de300042-0000-4000-8000-000000000047', 'de300010-0000-4000-8000-000000000012', 'Avaliação de integridade da pele', '18:00', 'enfermagem', 30, true)
  on conflict (id) do update set tarefa = excluded.tarefa, horario = excluded.horario, responsavel = excluded.responsavel, ativa = true;

-- ── 7 · Prescrições ativas ──────────────────────────────────────────────

insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Reavaliado na consulta de revisão do plano.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000002', 'de300010-0000-4000-8000-000000000001', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Reavaliado na consulta de revisão do plano.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000003', 'de300010-0000-4000-8000-000000000001', 'Sinvastatina 20 mg', '1 comprimido', 'oral', 'noite', '20:00', true,
   'Uso contínuo. Reavaliado na consulta de revisão do plano.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000004', 'de300010-0000-4000-8000-000000000001', 'Carbonato de cálcio 500 mg', '1 comprimido', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Reavaliado na consulta de revisão do plano.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000005', 'de300010-0000-4000-8000-000000000002', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000006', 'de300010-0000-4000-8000-000000000002', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000007', 'de300010-0000-4000-8000-000000000003', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000008', 'de300010-0000-4000-8000-000000000003', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000009', 'de300010-0000-4000-8000-000000000004', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000010', 'de300010-0000-4000-8000-000000000004', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000011', 'de300010-0000-4000-8000-000000000005', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000012', 'de300010-0000-4000-8000-000000000005', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000013', 'de300010-0000-4000-8000-000000000006', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000014', 'de300010-0000-4000-8000-000000000006', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000015', 'de300010-0000-4000-8000-000000000007', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000016', 'de300010-0000-4000-8000-000000000007', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000017', 'de300010-0000-4000-8000-000000000008', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000018', 'de300010-0000-4000-8000-000000000008', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000019', 'de300010-0000-4000-8000-000000000009', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000020', 'de300010-0000-4000-8000-000000000009', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000021', 'de300010-0000-4000-8000-000000000009', 'Sinvastatina 20 mg', '1 comprimido', 'oral', 'noite', '20:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000022', 'de300010-0000-4000-8000-000000000009', 'Carbonato de cálcio 500 mg', '1 comprimido', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000023', 'de300010-0000-4000-8000-000000000010', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', 'ALERGIA REGISTRADA: Dipirona')
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000024', 'de300010-0000-4000-8000-000000000010', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', 'ALERGIA REGISTRADA: Dipirona')
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000025', 'de300010-0000-4000-8000-000000000010', 'Sinvastatina 20 mg', '1 comprimido', 'oral', 'noite', '20:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', 'ALERGIA REGISTRADA: Dipirona')
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000026', 'de300010-0000-4000-8000-000000000010', 'Carbonato de cálcio 500 mg', '1 comprimido', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', 'ALERGIA REGISTRADA: Dipirona')
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000027', 'de300010-0000-4000-8000-000000000011', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000028', 'de300010-0000-4000-8000-000000000011', 'Colecalciferol 7.000 UI', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000029', 'de300010-0000-4000-8000-000000000011', 'Sinvastatina 20 mg', '1 comprimido', 'oral', 'noite', '20:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000030', 'de300010-0000-4000-8000-000000000011', 'Carbonato de cálcio 500 mg', '1 comprimido', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000031', 'de300010-0000-4000-8000-000000000012', 'Losartana potássica 50 mg', '1 comprimido', 'oral', 'manha', '08:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000032', 'de300010-0000-4000-8000-000000000012', 'Sinvastatina 20 mg', '1 comprimido', 'oral', 'noite', '20:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000033', 'de300010-0000-4000-8000-000000000012', 'Donepezila 10 mg', '1 comprimido', 'oral', 'noite', '20:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000034', 'de300010-0000-4000-8000-000000000012', 'Insulina NPH', '12 UI', 'insulina', 'jejum', '07:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;
insert into public.prescricao (id, residente_id, medicamento, dose, via, periodo, horario, ativa, posologia, prescrito_por, alerta_alergia) values
  ('de300043-0000-4000-8000-000000000035', 'de300010-0000-4000-8000-000000000012', 'Ômega 3 1000 mg', '1 cápsula', 'oral', 'almoco', '12:00', true,
   'Uso contínuo. Revisão trimestral.', 'de300020-0000-4000-8000-000000000004', null)
  on conflict (id) do update set medicamento = excluded.medicamento, dose = excluded.dose, via = excluded.via,
    periodo = excluded.periodo, horario = excluded.horario, ativa = true;

-- ── 8 · Evoluções de enfermagem (últimos 30 dias + jornada da protagonista) 

insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 112)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000002', 'de300010-0000-4000-8000-000000000001', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 105)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000003', 'de300010-0000-4000-8000-000000000001', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 98)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000004', 'de300010-0000-4000-8000-000000000001', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 91)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000005', 'de300010-0000-4000-8000-000000000001', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 84)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000006', 'de300010-0000-4000-8000-000000000001', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 77)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000007', 'de300010-0000-4000-8000-000000000001', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 70)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000008', 'de300010-0000-4000-8000-000000000001', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 63)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000009', 'de300010-0000-4000-8000-000000000001', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 56)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000010', 'de300010-0000-4000-8000-000000000001', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 49)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000011', 'de300010-0000-4000-8000-000000000001', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 42)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000012', 'de300010-0000-4000-8000-000000000001', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 35)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000013', 'de300010-0000-4000-8000-000000000001', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 28)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000014', 'de300010-0000-4000-8000-000000000001', 'QUEDA. Por volta das 06h50 a moradora foi encontrada sentada no piso do banheiro da suíte, consciente, orientada, referindo ter escorregado ao sair do box. Nega perda de consciência e nega dor em quadril. Ao exame: escoriação superficial em antebraço direito (aproximadamente 3 cm), sem deformidades, sem limitação de movimento, sem dor à palpação de bacia e membros. PA 142x88 mmHg, FC 84 bpm, glicemia 96 mg/dL. Realizada limpeza e curativo da escoriação. Enfermeira RT acionada e presente às 07h05. Médico comunicado por telefone às 07h20, orientou observação e avaliação presencial no mesmo dia. Filha (Fernanda) comunicada às 07h35 pelo aplicativo e por telefone. Registrado evento adverso. Moradora mantida em observação, deambulando com apoio, sem novas queixas até o fim do plantão.', 'Rosana Prado Lima', ((demo_ref() - 21)::timestamp + time '07:50'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000015', 'de300010-0000-4000-8000-000000000001', 'Moradora em observação após a queda de ontem. Avaliada pelo médico geriatra, sem indicação de exame de imagem. Escoriação em antebraço com boa evolução, sem sinais flogísticos. Refere insegurança para o banho. Encaminhada solicitação de reavaliação do grau de dependência e de risco de queda.', 'Rosana Prado Lima', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000016', 'de300010-0000-4000-8000-000000000001', 'REAVALIAÇÃO. Aplicado IVCF-20: pontuação 17, classificação Grau II (anterior: Grau I, pontuação 6). Domínios alterados: mobilidade, humor e AVD instrumental. Justificativa clínica: após a queda houve redução da marcha independente, insegurança para banho e higiene, e retraimento social com queda na participação em atividades. Plano de cuidados ampliado: supervisão de banho, administração assistida de medicação, fisioterapia motora duas vezes por semana e reavaliação semanal de risco de queda. Família comunicada e de acordo. Reenquadramento contratual encaminhado à administração.', 'Rosana Prado Lima', ((demo_ref() - 14)::timestamp + time '11:30'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000017', 'de300010-0000-4000-8000-000000000001', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Camila Duarte Pinho', ((demo_ref() - 12)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000018', 'de300010-0000-4000-8000-000000000001', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Patrícia Gomes Vilela', ((demo_ref() - 10)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000019', 'de300010-0000-4000-8000-000000000001', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Camila Duarte Pinho', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000020', 'de300010-0000-4000-8000-000000000001', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Patrícia Gomes Vilela', ((demo_ref() - 6)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000021', 'de300010-0000-4000-8000-000000000001', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Camila Duarte Pinho', ((demo_ref() - 4)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000022', 'de300010-0000-4000-8000-000000000001', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Patrícia Gomes Vilela', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000023', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000024', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 28)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000025', 'de300010-0000-4000-8000-000000000002', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 27)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000026', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000027', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 25)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000028', 'de300010-0000-4000-8000-000000000002', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 24)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000029', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000030', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 22)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000031', 'de300010-0000-4000-8000-000000000002', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 21)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000032', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000033', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 19)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000034', 'de300010-0000-4000-8000-000000000002', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 18)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000035', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000036', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 16)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000037', 'de300010-0000-4000-8000-000000000002', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 15)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000038', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000039', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 13)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000040', 'de300010-0000-4000-8000-000000000002', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 12)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000041', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000042', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 10)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000043', 'de300010-0000-4000-8000-000000000002', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 9)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000044', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000045', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 7)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000046', 'de300010-0000-4000-8000-000000000002', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 6)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000047', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000048', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 4)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000049', 'de300010-0000-4000-8000-000000000002', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 3)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000050', 'de300010-0000-4000-8000-000000000002', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000051', 'de300010-0000-4000-8000-000000000002', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 1)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000052', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000053', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 28)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000054', 'de300010-0000-4000-8000-000000000003', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 27)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000055', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000056', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 25)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000057', 'de300010-0000-4000-8000-000000000003', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 24)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000058', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000059', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 22)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000060', 'de300010-0000-4000-8000-000000000003', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 21)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000061', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000062', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 19)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000063', 'de300010-0000-4000-8000-000000000003', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 18)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000064', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000065', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 16)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000066', 'de300010-0000-4000-8000-000000000003', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 15)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000067', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000068', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 13)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000069', 'de300010-0000-4000-8000-000000000003', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 12)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000070', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000071', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 10)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000072', 'de300010-0000-4000-8000-000000000003', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 9)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000073', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000074', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 7)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000075', 'de300010-0000-4000-8000-000000000003', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 6)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000076', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000077', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 4)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000078', 'de300010-0000-4000-8000-000000000003', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 3)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000079', 'de300010-0000-4000-8000-000000000003', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000080', 'de300010-0000-4000-8000-000000000003', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 1)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000081', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000082', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 28)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000083', 'de300010-0000-4000-8000-000000000004', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 27)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000084', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000085', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 25)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000086', 'de300010-0000-4000-8000-000000000004', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 24)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000087', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000088', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 22)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000089', 'de300010-0000-4000-8000-000000000004', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 21)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000090', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000091', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 19)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000092', 'de300010-0000-4000-8000-000000000004', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 18)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000093', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000094', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 16)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000095', 'de300010-0000-4000-8000-000000000004', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 15)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000096', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000097', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 13)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000098', 'de300010-0000-4000-8000-000000000004', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 12)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000099', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000100', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 10)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000101', 'de300010-0000-4000-8000-000000000004', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 9)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000102', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000103', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 7)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000104', 'de300010-0000-4000-8000-000000000004', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 6)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000105', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000106', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 4)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000107', 'de300010-0000-4000-8000-000000000004', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 3)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000108', 'de300010-0000-4000-8000-000000000004', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000109', 'de300010-0000-4000-8000-000000000004', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 1)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000110', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000111', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 28)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000112', 'de300010-0000-4000-8000-000000000005', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 27)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000113', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000114', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 25)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000115', 'de300010-0000-4000-8000-000000000005', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 24)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000116', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000117', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 22)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000118', 'de300010-0000-4000-8000-000000000005', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 21)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000119', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000120', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 19)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000121', 'de300010-0000-4000-8000-000000000005', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 18)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000122', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000123', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 16)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000124', 'de300010-0000-4000-8000-000000000005', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 15)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000125', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000126', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 13)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000127', 'de300010-0000-4000-8000-000000000005', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 12)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000128', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000129', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 10)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000130', 'de300010-0000-4000-8000-000000000005', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 9)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000131', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000132', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 7)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000133', 'de300010-0000-4000-8000-000000000005', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 6)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000134', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000135', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 4)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000136', 'de300010-0000-4000-8000-000000000005', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 3)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000137', 'de300010-0000-4000-8000-000000000005', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000138', 'de300010-0000-4000-8000-000000000005', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 1)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000139', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000140', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 28)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000141', 'de300010-0000-4000-8000-000000000006', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 27)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000142', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000143', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 25)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000144', 'de300010-0000-4000-8000-000000000006', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 24)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000145', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000146', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 22)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000147', 'de300010-0000-4000-8000-000000000006', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 21)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000148', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000149', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 19)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000150', 'de300010-0000-4000-8000-000000000006', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 18)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000151', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000152', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 16)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000153', 'de300010-0000-4000-8000-000000000006', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 15)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000154', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000155', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 13)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000156', 'de300010-0000-4000-8000-000000000006', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 12)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000157', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000158', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 10)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000159', 'de300010-0000-4000-8000-000000000006', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 9)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000160', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000161', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 7)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000162', 'de300010-0000-4000-8000-000000000006', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 6)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000163', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000164', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 4)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000165', 'de300010-0000-4000-8000-000000000006', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 3)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000166', 'de300010-0000-4000-8000-000000000006', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000167', 'de300010-0000-4000-8000-000000000006', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 1)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000168', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000169', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 28)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000170', 'de300010-0000-4000-8000-000000000007', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 27)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000171', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000172', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 25)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000173', 'de300010-0000-4000-8000-000000000007', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 24)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000174', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000175', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 22)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000176', 'de300010-0000-4000-8000-000000000007', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 21)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000177', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000178', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 19)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000179', 'de300010-0000-4000-8000-000000000007', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 18)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000180', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000181', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 16)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000182', 'de300010-0000-4000-8000-000000000007', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 15)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000183', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000184', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 13)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000185', 'de300010-0000-4000-8000-000000000007', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 12)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000186', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000187', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 10)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000188', 'de300010-0000-4000-8000-000000000007', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 9)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000189', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000190', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 7)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000191', 'de300010-0000-4000-8000-000000000007', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 6)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000192', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000193', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 4)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000194', 'de300010-0000-4000-8000-000000000007', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 3)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000195', 'de300010-0000-4000-8000-000000000007', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000196', 'de300010-0000-4000-8000-000000000007', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 1)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000197', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000198', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 28)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000199', 'de300010-0000-4000-8000-000000000008', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 27)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000200', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000201', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 25)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000202', 'de300010-0000-4000-8000-000000000008', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 24)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000203', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000204', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 22)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000205', 'de300010-0000-4000-8000-000000000008', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 21)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000206', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000207', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 19)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000208', 'de300010-0000-4000-8000-000000000008', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 18)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000209', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000210', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 16)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000211', 'de300010-0000-4000-8000-000000000008', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Simone Barros Tavares', ((demo_ref() - 15)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000212', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Patrícia Gomes Vilela', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000213', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Juliana Ferraz Amado', ((demo_ref() - 13)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000214', 'de300010-0000-4000-8000-000000000008', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Camila Duarte Pinho', ((demo_ref() - 12)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000215', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Rosana Prado Lima', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000216', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Simone Barros Tavares', ((demo_ref() - 10)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000217', 'de300010-0000-4000-8000-000000000008', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Patrícia Gomes Vilela', ((demo_ref() - 9)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000218', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Juliana Ferraz Amado', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000219', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Camila Duarte Pinho', ((demo_ref() - 7)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000220', 'de300010-0000-4000-8000-000000000008', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Rosana Prado Lima', ((demo_ref() - 6)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000221', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Simone Barros Tavares', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000222', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Patrícia Gomes Vilela', ((demo_ref() - 4)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000223', 'de300010-0000-4000-8000-000000000008', 'Refere ter dormido bem. Circulou pelas áreas comuns e recebeu visita da família. PA 126x80 mmHg. Sem alterações dignas de nota.', 'Juliana Ferraz Amado', ((demo_ref() - 3)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000224', 'de300010-0000-4000-8000-000000000008', 'Sem intercorrências no plantão. Autonomia preservada para higiene e vestuário. Medicação de uso contínuo conferida e em dia. PA 132x84 mmHg. Boa aceitação alimentar.', 'Camila Duarte Pinho', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000225', 'de300010-0000-4000-8000-000000000008', 'Moradora lúcida, orientada em tempo e espaço. Deambula sem auxílio. Aceitou bem as refeições. PA 128x82 mmHg. Participou da oficina de memória à tarde. Sem queixas.', 'Rosana Prado Lima', ((demo_ref() - 1)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000226', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Simone Barros Tavares', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000227', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Camila Duarte Pinho', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000228', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Patrícia Gomes Vilela', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000229', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Rosana Prado Lima', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000230', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Juliana Ferraz Amado', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000231', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Simone Barros Tavares', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000232', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Camila Duarte Pinho', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000233', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Patrícia Gomes Vilela', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000234', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Rosana Prado Lima', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000235', 'de300010-0000-4000-8000-000000000009', 'Plantão sem intercorrências. Supervisão de banho e apoio para vestuário. Medicação assistida administrada nos horários. Humor estável, participou do coral.', 'Juliana Ferraz Amado', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000236', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Rosana Prado Lima', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000237', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Juliana Ferraz Amado', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000238', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Simone Barros Tavares', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000239', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Camila Duarte Pinho', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000240', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Patrícia Gomes Vilela', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000241', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Rosana Prado Lima', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000242', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Juliana Ferraz Amado', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000243', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Simone Barros Tavares', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000244', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Camila Duarte Pinho', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000245', 'de300010-0000-4000-8000-000000000010', 'Banho realizado com supervisão. Deambula com apoio de bengala em percursos curtos. Medicação administrada conforme prescrição. PA 138x86 mmHg. Aceitação alimentar boa.', 'Patrícia Gomes Vilela', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000246', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Camila Duarte Pinho', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000247', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Patrícia Gomes Vilela', ((demo_ref() - 26)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000248', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Rosana Prado Lima', ((demo_ref() - 23)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000249', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Juliana Ferraz Amado', ((demo_ref() - 20)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000250', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Simone Barros Tavares', ((demo_ref() - 17)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000251', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Camila Duarte Pinho', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000252', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Patrícia Gomes Vilela', ((demo_ref() - 11)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000253', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Rosana Prado Lima', ((demo_ref() - 8)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000254', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Juliana Ferraz Amado', ((demo_ref() - 5)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000255', 'de300010-0000-4000-8000-000000000011', 'Realizada fisioterapia motora pela manhã, com boa adesão. Refere leve desconforto em joelho direito ao final da sessão, sem limitação. PA 134x84 mmHg.', 'Simone Barros Tavares', ((demo_ref() - 2)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000256', 'de300010-0000-4000-8000-000000000012', 'Sem intercorrências. Higiene e mudança de decúbito conforme plano. Aceitação alimentar 75%. Família presente na visita da tarde, orientada quanto à rotina.', 'Juliana Ferraz Amado', ((demo_ref() - 29)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000257', 'de300010-0000-4000-8000-000000000012', 'Higiene assistida completa realizada. Mudanças de decúbito a cada 2 horas, pele íntegra. Aceitação alimentar parcial no almoço (60%). Glicemia capilar 142 mg/dL, insulina administrada conforme prescrição.', 'Juliana Ferraz Amado', ((demo_ref() - 24)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000258', 'de300010-0000-4000-8000-000000000012', 'Sonolenta pela manhã, mais responsiva à tarde. Fisioterapia motora e respiratória realizadas no leito. Sem sinais de desconforto respiratório. Diurese e evacuação presentes.', 'Juliana Ferraz Amado', ((demo_ref() - 19)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000259', 'de300010-0000-4000-8000-000000000012', 'Sem intercorrências. Higiene e mudança de decúbito conforme plano. Aceitação alimentar 75%. Família presente na visita da tarde, orientada quanto à rotina.', 'Juliana Ferraz Amado', ((demo_ref() - 14)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000260', 'de300010-0000-4000-8000-000000000012', 'Higiene assistida completa realizada. Mudanças de decúbito a cada 2 horas, pele íntegra. Aceitação alimentar parcial no almoço (60%). Glicemia capilar 142 mg/dL, insulina administrada conforme prescrição.', 'Juliana Ferraz Amado', ((demo_ref() - 9)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;
insert into public.evolucao (id, residente_id, texto, registrado_por, registrado_em) values
  ('de300044-0000-4000-8000-000000000261', 'de300010-0000-4000-8000-000000000012', 'Sonolenta pela manhã, mais responsiva à tarde. Fisioterapia motora e respiratória realizadas no leito. Sem sinais de desconforto respiratório. Diurese e evacuação presentes.', 'Juliana Ferraz Amado', ((demo_ref() - 4)::timestamp + time '18:40'))
  on conflict (id) do update set texto = excluded.texto, registrado_em = excluded.registrado_em;

-- ── 9 · Intercorrência e evento adverso (queda da protagonista) ─────────

insert into public.intercorrencia (id, residente_id, tipo, observacao, registrado_por, registrado_em) values
  ('de300045-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', 'Queda',
   'Queda da própria altura no banheiro da suíte, ao sair do box. Sem perda de consciência, sem fratura. Escoriação superficial em antebraço direito. Avaliada pela enfermeira RT e pelo médico no mesmo dia. Família comunicada.',
   'Rosana Prado Lima', ((demo_ref() - 21)::timestamp + time '07:05'))
  on conflict (id) do update set observacao = excluded.observacao, registrado_em = excluded.registrado_em;
insert into public.evento_sentinela (id, residente_id, intercorrencia_id, tipo, data_ocorrencia, descricao,
  registrado_por, perfil_registrador, gravidade, notificado, notificado_em, notificado_por, orgao_notificado, protocolo_notificacao, criado_em) values
  ('de300046-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', 'de300045-0000-4000-8000-000000000001', 'queda_com_lesao', (demo_ref() - 21),
   'Queda no banheiro com lesão de pele superficial (escoriação em antebraço direito), sem fratura e sem necessidade de remoção hospitalar.',
   'Rosana Prado Lima', 'enfermeira', 'leve', true, ((demo_ref() - 20)::timestamp + time '09:10'), 'Rosana Prado Lima', 'Vigilância Sanitária Municipal de Curitiba', 'NOT-2026-0184', ((demo_ref() - 21)::timestamp + time '07:40'))
  on conflict (id) do update set descricao = excluded.descricao, data_ocorrencia = excluded.data_ocorrencia, notificado = true;

-- ── 10 · Portal da família — recados ────────────────────────────────────

insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', 'Comunicado de intercorrência. Sua mãe teve uma queda no banheiro hoje de manhã, por volta das 6h50, ao sair do box. Ela está consciente, orientada e sem fratura. Houve uma escoriação superficial no antebraço direito, já limpa e com curativo. A enfermeira responsável avaliou às 7h05 e o médico geriatra a examinou ainda hoje, sem indicação de exame de imagem. Ela seguirá em observação e vamos reavaliar o plano de cuidados nos próximos dias. Estamos à disposição pelo telefone do plantão.', 'Rosana Prado Lima', ((demo_ref() - 21)::timestamp + time '07:35'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000002', 'de300010-0000-4000-8000-000000000001', 'Plano de cuidados atualizado. Após a reavaliação de hoje, a Maria Helena passou para o grau II de dependência. Na prática: passamos a supervisionar o banho, a medicação passa a ser administrada pela equipe, e ela inicia fisioterapia duas vezes por semana. O plano completo já está disponível para você no aplicativo. A mudança contratual foi encaminhada à administração e a Débora entrará em contato.', 'Rosana Prado Lima', ((demo_ref() - 14)::timestamp + time '12:10'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000003', 'de300010-0000-4000-8000-000000000001', 'A Maria Helena voltou a participar do coral nesta quarta e cantou duas músicas. A fisioterapeuta relatou boa evolução na marcha com apoio.', 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '17:20'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000004', 'de300010-0000-4000-8000-000000000001', 'Sessão de fisioterapia realizada hoje, com boa adesão. Ela pediu para avisar que gostaria de receber os netos no próximo domingo.', 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '15:40'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000005', 'de300010-0000-4000-8000-000000000002', 'Registro da semana: Aparecida participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 5)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000006', 'de300010-0000-4000-8000-000000000003', 'Registro da semana: Conceição participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 6)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000007', 'de300010-0000-4000-8000-000000000004', 'Registro da semana: Waldir participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 7)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000008', 'de300010-0000-4000-8000-000000000005', 'Registro da semana: Nelson participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 8)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000009', 'de300010-0000-4000-8000-000000000006', 'Registro da semana: Yolanda participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 9)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000010', 'de300010-0000-4000-8000-000000000007', 'Registro da semana: Ivone participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 10)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000011', 'de300010-0000-4000-8000-000000000008', 'Registro da semana: Arnaldo participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 11)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000012', 'de300010-0000-4000-8000-000000000009', 'Registro da semana: Lúcia participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 3)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000013', 'de300010-0000-4000-8000-000000000010', 'Registro da semana: Otávio participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 4)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000014', 'de300010-0000-4000-8000-000000000011', 'Registro da semana: Célia participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 5)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;
insert into public.recado_familia (id, residente_id, mensagem, autor, criado_em) values
  ('de300047-0000-4000-8000-000000000015', 'de300010-0000-4000-8000-000000000012', 'Registro da semana: Therezinha participou das atividades de convívio e está com boa aceitação alimentar. Sem intercorrências no período.', 'Marta Ribeiro Coelho', ((demo_ref() - 6)::timestamp + time '16:30'))
  on conflict (id) do update set mensagem = excluded.mensagem, criado_em = excluded.criado_em;

-- ── 11 · Agenda — visitas da família e compromissos externos ────────────

insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', 'Fisioterapia motora', (demo_ref() - 14), '10:00', 'Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000002', 'de300010-0000-4000-8000-000000000001', 'Fisioterapia motora', (demo_ref() - 11), '10:00', 'Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000003', 'de300010-0000-4000-8000-000000000001', 'Fisioterapia motora', (demo_ref() - 8), '10:00', 'Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000004', 'de300010-0000-4000-8000-000000000001', 'Fisioterapia motora', (demo_ref() - 5), '10:00', 'Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000005', 'de300010-0000-4000-8000-000000000001', 'Fisioterapia motora', (demo_ref() - 2), '10:00', 'Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000006', 'de300010-0000-4000-8000-000000000001', 'Fisioterapia motora', (demo_ref() - -1), '10:00', 'Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000007', 'de300010-0000-4000-8000-000000000001', 'Fisioterapia motora', (demo_ref() - -4), '10:00', 'Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000008', 'de300010-0000-4000-8000-000000000001', 'Fisioterapia motora', (demo_ref() - -7), '10:00', 'Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000009', 'de300010-0000-4000-8000-000000000001', 'Fisioterapia motora', (demo_ref() - -10), '10:00', 'Sessão no espaço multiuso, com a fisioterapeuta Sandra. Duas vezes por semana, conforme plano de cuidados ampliado.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000010', 'de300010-0000-4000-8000-000000000001', 'Visita da família — Fernanda e netos', (demo_ref() - -4), '15:00', 'Visita agendada pela filha Fernanda pelo aplicativo.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000011', 'de300010-0000-4000-8000-000000000001', 'Visita da família — Fernanda', (demo_ref() - 9), '15:30', 'Visita realizada. Moradora recebeu a filha no jardim.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000012', 'de300010-0000-4000-8000-000000000001', 'Consulta com geriatra', (demo_ref() - 23), '09:30', 'Consulta de rotina com o Dr. Geraldo. Transporte por conta da família.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000013', 'de300010-0000-4000-8000-000000000002', 'Visita da família', (demo_ref() - -4), '12:00', 'Visita agendada por Cláudio Nunes Vidal.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000014', 'de300010-0000-4000-8000-000000000002', 'Visita da família', (demo_ref() - 7), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000015', 'de300010-0000-4000-8000-000000000003', 'Visita da família', (demo_ref() - -5), '13:00', 'Visita agendada por Beatriz Dias Ferraz.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000016', 'de300010-0000-4000-8000-000000000003', 'Visita da família', (demo_ref() - 8), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000017', 'de300010-0000-4000-8000-000000000004', 'Visita da família', (demo_ref() - -6), '14:00', 'Visita agendada por Sérgio Campos Rocha.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000018', 'de300010-0000-4000-8000-000000000004', 'Visita da família', (demo_ref() - 9), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000019', 'de300010-0000-4000-8000-000000000005', 'Visita da família', (demo_ref() - -7), '15:00', 'Visita agendada por Marina Barreto Aguiar.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000020', 'de300010-0000-4000-8000-000000000005', 'Visita da família', (demo_ref() - 10), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000021', 'de300010-0000-4000-8000-000000000006', 'Visita da família', (demo_ref() - -8), '10:00', 'Visita agendada por Rogério Prates Coelho.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000022', 'de300010-0000-4000-8000-000000000006', 'Visita da família', (demo_ref() - 11), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000023', 'de300010-0000-4000-8000-000000000007', 'Visita da família', (demo_ref() - -2), '11:00', 'Visita agendada por Tatiana Salgado Reis.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000024', 'de300010-0000-4000-8000-000000000007', 'Visita da família', (demo_ref() - 12), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000025', 'de300010-0000-4000-8000-000000000008', 'Visita da família', (demo_ref() - -3), '12:00', 'Visita agendada por Luiza Bicudo Franco.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000026', 'de300010-0000-4000-8000-000000000008', 'Visita da família', (demo_ref() - 13), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000027', 'de300010-0000-4000-8000-000000000009', 'Visita da família', (demo_ref() - -4), '13:00', 'Visita agendada por Paulo Moraes Tavares.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000028', 'de300010-0000-4000-8000-000000000009', 'Visita da família', (demo_ref() - 14), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000029', 'de300010-0000-4000-8000-000000000010', 'Visita da família', (demo_ref() - -5), '14:00', 'Visita agendada por Renata Prado Sanches.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000030', 'de300010-0000-4000-8000-000000000010', 'Visita da família', (demo_ref() - 15), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000031', 'de300010-0000-4000-8000-000000000011', 'Visita da família', (demo_ref() - -6), '15:00', 'Visita agendada por André Bastos Meireles.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000032', 'de300010-0000-4000-8000-000000000011', 'Visita da família', (demo_ref() - 5), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000033', 'de300010-0000-4000-8000-000000000012', 'Visita da família', (demo_ref() - -7), '10:00', 'Visita agendada por Vera Alves Moreira.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;
insert into public.compromisso_externo (id, residente_id, titulo, data, horario, detalhes) values
  ('de300048-0000-4000-8000-000000000034', 'de300010-0000-4000-8000-000000000012', 'Visita da família', (demo_ref() - 6), '15:00', 'Visita realizada.')
  on conflict (id) do update set titulo = excluded.titulo, data = excluded.data, horario = excluded.horario, detalhes = excluded.detalhes;

-- ── 12 · Escala de cobertura assistencial (mês corrente e anterior) ─────

insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000001', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 45), ((demo_ref() - 45)::timestamp + time '07:00'), ((demo_ref() - 45)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 45)::timestamp + time '07:00'), ((demo_ref() - 45)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000002', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 45), ((demo_ref() - 45)::timestamp + time '19:00'), ((demo_ref() - 44)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 45)::timestamp + time '19:00'), ((demo_ref() - 45)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000003', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 45), ((demo_ref() - 45)::timestamp + time '07:00'), ((demo_ref() - 45)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 45)::timestamp + time '07:00'), ((demo_ref() - 45)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000004', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - 44), ((demo_ref() - 44)::timestamp + time '07:00'), ((demo_ref() - 44)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 44)::timestamp + time '07:00'), ((demo_ref() - 44)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000005', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 44), ((demo_ref() - 44)::timestamp + time '19:00'), ((demo_ref() - 43)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 44)::timestamp + time '19:00'), ((demo_ref() - 44)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000006', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 44), ((demo_ref() - 44)::timestamp + time '07:00'), ((demo_ref() - 44)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 44)::timestamp + time '07:00'), ((demo_ref() - 44)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000007', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - 43), ((demo_ref() - 43)::timestamp + time '07:00'), ((demo_ref() - 43)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 43)::timestamp + time '07:00'), ((demo_ref() - 43)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000008', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 43), ((demo_ref() - 43)::timestamp + time '19:00'), ((demo_ref() - 42)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 43)::timestamp + time '19:00'), ((demo_ref() - 43)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000009', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 43), ((demo_ref() - 43)::timestamp + time '07:00'), ((demo_ref() - 43)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 43)::timestamp + time '07:00'), ((demo_ref() - 43)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000010', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 42), ((demo_ref() - 42)::timestamp + time '07:00'), ((demo_ref() - 42)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 42)::timestamp + time '07:00'), ((demo_ref() - 42)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000011', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 42), ((demo_ref() - 42)::timestamp + time '19:00'), ((demo_ref() - 41)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 42)::timestamp + time '19:00'), ((demo_ref() - 42)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000012', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 42), ((demo_ref() - 42)::timestamp + time '07:00'), ((demo_ref() - 42)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 42)::timestamp + time '07:00'), ((demo_ref() - 42)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000013', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 41), ((demo_ref() - 41)::timestamp + time '07:00'), ((demo_ref() - 41)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 41)::timestamp + time '07:00'), ((demo_ref() - 41)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000014', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 41), ((demo_ref() - 41)::timestamp + time '19:00'), ((demo_ref() - 40)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 41)::timestamp + time '19:00'), ((demo_ref() - 41)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000015', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 41), ((demo_ref() - 41)::timestamp + time '07:00'), ((demo_ref() - 41)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 41)::timestamp + time '07:00'), ((demo_ref() - 41)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000016', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 40), ((demo_ref() - 40)::timestamp + time '07:00'), ((demo_ref() - 40)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 40)::timestamp + time '07:00'), ((demo_ref() - 40)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000017', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 40), ((demo_ref() - 40)::timestamp + time '19:00'), ((demo_ref() - 39)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 40)::timestamp + time '19:00'), ((demo_ref() - 40)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000018', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 40), ((demo_ref() - 40)::timestamp + time '07:00'), ((demo_ref() - 40)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 40)::timestamp + time '07:00'), ((demo_ref() - 40)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000019', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - 39), ((demo_ref() - 39)::timestamp + time '07:00'), ((demo_ref() - 39)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 39)::timestamp + time '07:00'), ((demo_ref() - 39)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000020', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 39), ((demo_ref() - 39)::timestamp + time '19:00'), ((demo_ref() - 38)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 39)::timestamp + time '19:00'), ((demo_ref() - 39)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000021', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 39), ((demo_ref() - 39)::timestamp + time '07:00'), ((demo_ref() - 39)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 39)::timestamp + time '07:00'), ((demo_ref() - 39)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000022', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - 38), ((demo_ref() - 38)::timestamp + time '07:00'), ((demo_ref() - 38)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 38)::timestamp + time '07:00'), ((demo_ref() - 38)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000023', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 38), ((demo_ref() - 38)::timestamp + time '19:00'), ((demo_ref() - 37)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 38)::timestamp + time '19:00'), ((demo_ref() - 38)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000024', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 38), ((demo_ref() - 38)::timestamp + time '07:00'), ((demo_ref() - 38)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 38)::timestamp + time '07:00'), ((demo_ref() - 38)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000025', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 37), ((demo_ref() - 37)::timestamp + time '07:00'), ((demo_ref() - 37)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 37)::timestamp + time '07:00'), ((demo_ref() - 37)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000026', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 37), ((demo_ref() - 37)::timestamp + time '19:00'), ((demo_ref() - 36)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 37)::timestamp + time '19:00'), ((demo_ref() - 37)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000027', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 37), ((demo_ref() - 37)::timestamp + time '07:00'), ((demo_ref() - 37)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 37)::timestamp + time '07:00'), ((demo_ref() - 37)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000028', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 36), ((demo_ref() - 36)::timestamp + time '07:00'), ((demo_ref() - 36)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 36)::timestamp + time '07:00'), ((demo_ref() - 36)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000029', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 36), ((demo_ref() - 36)::timestamp + time '19:00'), ((demo_ref() - 35)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 36)::timestamp + time '19:00'), ((demo_ref() - 36)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000030', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 36), ((demo_ref() - 36)::timestamp + time '07:00'), ((demo_ref() - 36)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 36)::timestamp + time '07:00'), ((demo_ref() - 36)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000031', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 35), ((demo_ref() - 35)::timestamp + time '07:00'), ((demo_ref() - 35)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 35)::timestamp + time '07:00'), ((demo_ref() - 35)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000032', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 35), ((demo_ref() - 35)::timestamp + time '19:00'), ((demo_ref() - 34)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 35)::timestamp + time '19:00'), ((demo_ref() - 35)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000033', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 35), ((demo_ref() - 35)::timestamp + time '07:00'), ((demo_ref() - 35)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 35)::timestamp + time '07:00'), ((demo_ref() - 35)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000034', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - 34), ((demo_ref() - 34)::timestamp + time '07:00'), ((demo_ref() - 34)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 34)::timestamp + time '07:00'), ((demo_ref() - 34)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000035', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 34), ((demo_ref() - 34)::timestamp + time '19:00'), ((demo_ref() - 33)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 34)::timestamp + time '19:00'), ((demo_ref() - 34)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000036', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 34), ((demo_ref() - 34)::timestamp + time '07:00'), ((demo_ref() - 34)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 34)::timestamp + time '07:00'), ((demo_ref() - 34)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000037', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - 33), ((demo_ref() - 33)::timestamp + time '07:00'), ((demo_ref() - 33)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 33)::timestamp + time '07:00'), ((demo_ref() - 33)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000038', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 33), ((demo_ref() - 33)::timestamp + time '19:00'), ((demo_ref() - 32)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 33)::timestamp + time '19:00'), ((demo_ref() - 33)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000039', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 33), ((demo_ref() - 33)::timestamp + time '07:00'), ((demo_ref() - 33)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 33)::timestamp + time '07:00'), ((demo_ref() - 33)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000040', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 32), ((demo_ref() - 32)::timestamp + time '07:00'), ((demo_ref() - 32)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 32)::timestamp + time '07:00'), ((demo_ref() - 32)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000041', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 32), ((demo_ref() - 32)::timestamp + time '19:00'), ((demo_ref() - 31)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 32)::timestamp + time '19:00'), ((demo_ref() - 32)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000042', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 32), ((demo_ref() - 32)::timestamp + time '07:00'), ((demo_ref() - 32)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 32)::timestamp + time '07:00'), ((demo_ref() - 32)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000043', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 31), ((demo_ref() - 31)::timestamp + time '07:00'), ((demo_ref() - 31)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 31)::timestamp + time '07:00'), ((demo_ref() - 31)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000044', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 31), ((demo_ref() - 31)::timestamp + time '19:00'), ((demo_ref() - 30)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 31)::timestamp + time '19:00'), ((demo_ref() - 31)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000045', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 31), ((demo_ref() - 31)::timestamp + time '07:00'), ((demo_ref() - 31)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 31)::timestamp + time '07:00'), ((demo_ref() - 31)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000046', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 30), ((demo_ref() - 30)::timestamp + time '07:00'), ((demo_ref() - 30)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 30)::timestamp + time '07:00'), ((demo_ref() - 30)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000047', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 30), ((demo_ref() - 30)::timestamp + time '19:00'), ((demo_ref() - 29)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 30)::timestamp + time '19:00'), ((demo_ref() - 30)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000048', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 30), ((demo_ref() - 30)::timestamp + time '07:00'), ((demo_ref() - 30)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 30)::timestamp + time '07:00'), ((demo_ref() - 30)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000049', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - 29), ((demo_ref() - 29)::timestamp + time '07:00'), ((demo_ref() - 29)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 29)::timestamp + time '07:00'), ((demo_ref() - 29)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000050', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 29), ((demo_ref() - 29)::timestamp + time '19:00'), ((demo_ref() - 28)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 29)::timestamp + time '19:00'), ((demo_ref() - 29)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000051', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 29), ((demo_ref() - 29)::timestamp + time '07:00'), ((demo_ref() - 29)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 29)::timestamp + time '07:00'), ((demo_ref() - 29)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000052', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - 28), ((demo_ref() - 28)::timestamp + time '07:00'), ((demo_ref() - 28)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 28)::timestamp + time '07:00'), ((demo_ref() - 28)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000053', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 28), ((demo_ref() - 28)::timestamp + time '19:00'), ((demo_ref() - 27)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 28)::timestamp + time '19:00'), ((demo_ref() - 28)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000054', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 28), ((demo_ref() - 28)::timestamp + time '07:00'), ((demo_ref() - 28)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 28)::timestamp + time '07:00'), ((demo_ref() - 28)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000055', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 27), ((demo_ref() - 27)::timestamp + time '07:00'), ((demo_ref() - 27)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 27)::timestamp + time '07:00'), ((demo_ref() - 27)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000056', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 27), ((demo_ref() - 27)::timestamp + time '19:00'), ((demo_ref() - 26)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 27)::timestamp + time '19:00'), ((demo_ref() - 27)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000057', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 27), ((demo_ref() - 27)::timestamp + time '07:00'), ((demo_ref() - 27)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 27)::timestamp + time '07:00'), ((demo_ref() - 27)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000058', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 26), ((demo_ref() - 26)::timestamp + time '07:00'), ((demo_ref() - 26)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 26)::timestamp + time '07:00'), ((demo_ref() - 26)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000059', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 26), ((demo_ref() - 26)::timestamp + time '19:00'), ((demo_ref() - 25)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 26)::timestamp + time '19:00'), ((demo_ref() - 26)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000060', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 26), ((demo_ref() - 26)::timestamp + time '07:00'), ((demo_ref() - 26)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 26)::timestamp + time '07:00'), ((demo_ref() - 26)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000061', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 25), ((demo_ref() - 25)::timestamp + time '07:00'), ((demo_ref() - 25)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 25)::timestamp + time '07:00'), ((demo_ref() - 25)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000062', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 25), ((demo_ref() - 25)::timestamp + time '19:00'), ((demo_ref() - 24)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 25)::timestamp + time '19:00'), ((demo_ref() - 25)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000063', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 25), ((demo_ref() - 25)::timestamp + time '07:00'), ((demo_ref() - 25)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 25)::timestamp + time '07:00'), ((demo_ref() - 25)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000064', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - 24), ((demo_ref() - 24)::timestamp + time '07:00'), ((demo_ref() - 24)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 24)::timestamp + time '07:00'), ((demo_ref() - 24)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000065', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 24), ((demo_ref() - 24)::timestamp + time '19:00'), ((demo_ref() - 23)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 24)::timestamp + time '19:00'), ((demo_ref() - 24)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000066', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 24), ((demo_ref() - 24)::timestamp + time '07:00'), ((demo_ref() - 24)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 24)::timestamp + time '07:00'), ((demo_ref() - 24)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000067', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - 23), ((demo_ref() - 23)::timestamp + time '07:00'), ((demo_ref() - 23)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 23)::timestamp + time '07:00'), ((demo_ref() - 23)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000068', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 23), ((demo_ref() - 23)::timestamp + time '19:00'), ((demo_ref() - 22)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 23)::timestamp + time '19:00'), ((demo_ref() - 23)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000069', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 23), ((demo_ref() - 23)::timestamp + time '07:00'), ((demo_ref() - 23)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 23)::timestamp + time '07:00'), ((demo_ref() - 23)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000070', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 22), ((demo_ref() - 22)::timestamp + time '07:00'), ((demo_ref() - 22)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 22)::timestamp + time '07:00'), ((demo_ref() - 22)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000071', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 22), ((demo_ref() - 22)::timestamp + time '19:00'), ((demo_ref() - 21)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 22)::timestamp + time '19:00'), ((demo_ref() - 22)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000072', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 22), ((demo_ref() - 22)::timestamp + time '07:00'), ((demo_ref() - 22)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 22)::timestamp + time '07:00'), ((demo_ref() - 22)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000073', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 21), ((demo_ref() - 21)::timestamp + time '07:00'), ((demo_ref() - 21)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 21)::timestamp + time '07:00'), ((demo_ref() - 21)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000074', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 21), ((demo_ref() - 21)::timestamp + time '19:00'), ((demo_ref() - 20)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 21)::timestamp + time '19:00'), ((demo_ref() - 21)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000075', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 21), ((demo_ref() - 21)::timestamp + time '07:00'), ((demo_ref() - 21)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 21)::timestamp + time '07:00'), ((demo_ref() - 21)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000076', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 20), ((demo_ref() - 20)::timestamp + time '07:00'), ((demo_ref() - 20)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 20)::timestamp + time '07:00'), ((demo_ref() - 20)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000077', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 20), ((demo_ref() - 20)::timestamp + time '19:00'), ((demo_ref() - 19)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 20)::timestamp + time '19:00'), ((demo_ref() - 20)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000078', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 20), ((demo_ref() - 20)::timestamp + time '07:00'), ((demo_ref() - 20)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 20)::timestamp + time '07:00'), ((demo_ref() - 20)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000079', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - 19), ((demo_ref() - 19)::timestamp + time '07:00'), ((demo_ref() - 19)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 19)::timestamp + time '07:00'), ((demo_ref() - 19)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000080', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 19), ((demo_ref() - 19)::timestamp + time '19:00'), ((demo_ref() - 18)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 19)::timestamp + time '19:00'), ((demo_ref() - 19)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000081', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 19), ((demo_ref() - 19)::timestamp + time '07:00'), ((demo_ref() - 19)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 19)::timestamp + time '07:00'), ((demo_ref() - 19)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000082', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - 18), ((demo_ref() - 18)::timestamp + time '07:00'), ((demo_ref() - 18)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 18)::timestamp + time '07:00'), ((demo_ref() - 18)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000083', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 18), ((demo_ref() - 18)::timestamp + time '19:00'), ((demo_ref() - 17)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 18)::timestamp + time '19:00'), ((demo_ref() - 18)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000084', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 18), ((demo_ref() - 18)::timestamp + time '07:00'), ((demo_ref() - 18)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 18)::timestamp + time '07:00'), ((demo_ref() - 18)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000085', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 17), ((demo_ref() - 17)::timestamp + time '07:00'), ((demo_ref() - 17)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 17)::timestamp + time '07:00'), ((demo_ref() - 17)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000086', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 17), ((demo_ref() - 17)::timestamp + time '19:00'), ((demo_ref() - 16)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 17)::timestamp + time '19:00'), ((demo_ref() - 17)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000087', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 17), ((demo_ref() - 17)::timestamp + time '07:00'), ((demo_ref() - 17)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 17)::timestamp + time '07:00'), ((demo_ref() - 17)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000088', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 16), ((demo_ref() - 16)::timestamp + time '07:00'), ((demo_ref() - 16)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 16)::timestamp + time '07:00'), ((demo_ref() - 16)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000089', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 16), ((demo_ref() - 16)::timestamp + time '19:00'), ((demo_ref() - 15)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 16)::timestamp + time '19:00'), ((demo_ref() - 16)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000090', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 16), ((demo_ref() - 16)::timestamp + time '07:00'), ((demo_ref() - 16)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 16)::timestamp + time '07:00'), ((demo_ref() - 16)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000091', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 15), ((demo_ref() - 15)::timestamp + time '07:00'), ((demo_ref() - 15)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 15)::timestamp + time '07:00'), ((demo_ref() - 15)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000092', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 15), ((demo_ref() - 15)::timestamp + time '19:00'), ((demo_ref() - 14)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 15)::timestamp + time '19:00'), ((demo_ref() - 15)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000093', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 15), ((demo_ref() - 15)::timestamp + time '07:00'), ((demo_ref() - 15)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 15)::timestamp + time '07:00'), ((demo_ref() - 15)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000094', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - 14), ((demo_ref() - 14)::timestamp + time '07:00'), ((demo_ref() - 14)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 14)::timestamp + time '07:00'), ((demo_ref() - 14)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000095', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 14), ((demo_ref() - 14)::timestamp + time '19:00'), ((demo_ref() - 13)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 14)::timestamp + time '19:00'), ((demo_ref() - 14)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000096', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 14), ((demo_ref() - 14)::timestamp + time '07:00'), ((demo_ref() - 14)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 14)::timestamp + time '07:00'), ((demo_ref() - 14)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000097', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - 13), ((demo_ref() - 13)::timestamp + time '07:00'), ((demo_ref() - 13)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 13)::timestamp + time '07:00'), ((demo_ref() - 13)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000098', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 13), ((demo_ref() - 13)::timestamp + time '19:00'), ((demo_ref() - 12)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 13)::timestamp + time '19:00'), ((demo_ref() - 13)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000099', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 13), ((demo_ref() - 13)::timestamp + time '07:00'), ((demo_ref() - 13)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 13)::timestamp + time '07:00'), ((demo_ref() - 13)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000100', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 12), ((demo_ref() - 12)::timestamp + time '07:00'), ((demo_ref() - 12)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 12)::timestamp + time '07:00'), ((demo_ref() - 12)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000101', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 12), ((demo_ref() - 12)::timestamp + time '19:00'), ((demo_ref() - 11)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 12)::timestamp + time '19:00'), ((demo_ref() - 12)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000102', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 12), ((demo_ref() - 12)::timestamp + time '07:00'), ((demo_ref() - 12)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 12)::timestamp + time '07:00'), ((demo_ref() - 12)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000103', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 11), ((demo_ref() - 11)::timestamp + time '07:00'), ((demo_ref() - 11)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 11)::timestamp + time '07:00'), ((demo_ref() - 11)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000104', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 11), ((demo_ref() - 11)::timestamp + time '19:00'), ((demo_ref() - 10)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 11)::timestamp + time '19:00'), ((demo_ref() - 11)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000105', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 11), ((demo_ref() - 11)::timestamp + time '07:00'), ((demo_ref() - 11)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 11)::timestamp + time '07:00'), ((demo_ref() - 11)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000106', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 10), ((demo_ref() - 10)::timestamp + time '07:00'), ((demo_ref() - 10)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 10)::timestamp + time '07:00'), ((demo_ref() - 10)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000107', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 10), ((demo_ref() - 10)::timestamp + time '19:00'), ((demo_ref() - 9)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 10)::timestamp + time '19:00'), ((demo_ref() - 10)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000108', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 10), ((demo_ref() - 10)::timestamp + time '07:00'), ((demo_ref() - 10)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 10)::timestamp + time '07:00'), ((demo_ref() - 10)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000109', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - 9), ((demo_ref() - 9)::timestamp + time '07:00'), ((demo_ref() - 9)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 9)::timestamp + time '07:00'), ((demo_ref() - 9)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000110', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 9), ((demo_ref() - 9)::timestamp + time '19:00'), ((demo_ref() - 8)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 9)::timestamp + time '19:00'), ((demo_ref() - 9)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000111', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 9), ((demo_ref() - 9)::timestamp + time '07:00'), ((demo_ref() - 9)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 9)::timestamp + time '07:00'), ((demo_ref() - 9)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000112', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - 8), ((demo_ref() - 8)::timestamp + time '07:00'), ((demo_ref() - 8)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 8)::timestamp + time '07:00'), ((demo_ref() - 8)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000113', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 8), ((demo_ref() - 8)::timestamp + time '19:00'), ((demo_ref() - 7)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 8)::timestamp + time '19:00'), ((demo_ref() - 8)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000114', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 8), ((demo_ref() - 8)::timestamp + time '07:00'), ((demo_ref() - 8)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 8)::timestamp + time '07:00'), ((demo_ref() - 8)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000115', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 7), ((demo_ref() - 7)::timestamp + time '07:00'), ((demo_ref() - 7)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 7)::timestamp + time '07:00'), ((demo_ref() - 7)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000116', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 7), ((demo_ref() - 7)::timestamp + time '19:00'), ((demo_ref() - 6)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 7)::timestamp + time '19:00'), ((demo_ref() - 7)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000117', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 7), ((demo_ref() - 7)::timestamp + time '07:00'), ((demo_ref() - 7)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 7)::timestamp + time '07:00'), ((demo_ref() - 7)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000118', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 6), ((demo_ref() - 6)::timestamp + time '07:00'), ((demo_ref() - 6)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 6)::timestamp + time '07:00'), ((demo_ref() - 6)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000119', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 6), ((demo_ref() - 6)::timestamp + time '19:00'), ((demo_ref() - 5)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 6)::timestamp + time '19:00'), ((demo_ref() - 6)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000120', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 6), ((demo_ref() - 6)::timestamp + time '07:00'), ((demo_ref() - 6)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 6)::timestamp + time '07:00'), ((demo_ref() - 6)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000121', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 5), ((demo_ref() - 5)::timestamp + time '07:00'), ((demo_ref() - 5)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 5)::timestamp + time '07:00'), ((demo_ref() - 5)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000122', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 5), ((demo_ref() - 5)::timestamp + time '19:00'), ((demo_ref() - 4)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 5)::timestamp + time '19:00'), ((demo_ref() - 5)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000123', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 5), ((demo_ref() - 5)::timestamp + time '07:00'), ((demo_ref() - 5)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 5)::timestamp + time '07:00'), ((demo_ref() - 5)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000124', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - 4), ((demo_ref() - 4)::timestamp + time '07:00'), ((demo_ref() - 4)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 4)::timestamp + time '07:00'), ((demo_ref() - 4)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000125', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 4), ((demo_ref() - 4)::timestamp + time '19:00'), ((demo_ref() - 3)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 4)::timestamp + time '19:00'), ((demo_ref() - 4)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000126', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 4), ((demo_ref() - 4)::timestamp + time '07:00'), ((demo_ref() - 4)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 4)::timestamp + time '07:00'), ((demo_ref() - 4)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000127', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - 3), ((demo_ref() - 3)::timestamp + time '07:00'), ((demo_ref() - 3)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 3)::timestamp + time '07:00'), ((demo_ref() - 3)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000128', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 3), ((demo_ref() - 3)::timestamp + time '19:00'), ((demo_ref() - 2)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 3)::timestamp + time '19:00'), ((demo_ref() - 3)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000129', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 3), ((demo_ref() - 3)::timestamp + time '07:00'), ((demo_ref() - 3)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 3)::timestamp + time '07:00'), ((demo_ref() - 3)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000130', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 2), ((demo_ref() - 2)::timestamp + time '07:00'), ((demo_ref() - 2)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 2)::timestamp + time '07:00'), ((demo_ref() - 2)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000131', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 2), ((demo_ref() - 2)::timestamp + time '19:00'), ((demo_ref() - 1)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 2)::timestamp + time '19:00'), ((demo_ref() - 2)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000132', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 2), ((demo_ref() - 2)::timestamp + time '07:00'), ((demo_ref() - 2)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 2)::timestamp + time '07:00'), ((demo_ref() - 2)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000133', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 1), ((demo_ref() - 1)::timestamp + time '07:00'), ((demo_ref() - 1)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 1)::timestamp + time '07:00'), ((demo_ref() - 1)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000134', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - 1), ((demo_ref() - 1)::timestamp + time '19:00'), ((demo_ref() - 0)::timestamp + time '07:00'), 'noturno',
   ((demo_ref() - 1)::timestamp + time '19:00'), ((demo_ref() - 1)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000135', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 1), ((demo_ref() - 1)::timestamp + time '07:00'), ((demo_ref() - 1)::timestamp + time '19:00'), 'diurno',
   ((demo_ref() - 1)::timestamp + time '07:00'), ((demo_ref() - 1)::timestamp + time '19:05'))
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000136', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - 0), ((demo_ref() - 0)::timestamp + time '07:00'), ((demo_ref() - 0)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000137', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - 0), ((demo_ref() - 0)::timestamp + time '19:00'), ((demo_ref() - -1)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000138', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - 0), ((demo_ref() - 0)::timestamp + time '07:00'), ((demo_ref() - 0)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000139', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - -1), ((demo_ref() - -1)::timestamp + time '07:00'), ((demo_ref() - -1)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000140', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - -1), ((demo_ref() - -1)::timestamp + time '19:00'), ((demo_ref() - -2)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000141', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -1), ((demo_ref() - -1)::timestamp + time '07:00'), ((demo_ref() - -1)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000142', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - -2), ((demo_ref() - -2)::timestamp + time '07:00'), ((demo_ref() - -2)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000143', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - -2), ((demo_ref() - -2)::timestamp + time '19:00'), ((demo_ref() - -3)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000144', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -2), ((demo_ref() - -2)::timestamp + time '07:00'), ((demo_ref() - -2)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000145', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - -3), ((demo_ref() - -3)::timestamp + time '07:00'), ((demo_ref() - -3)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000146', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - -3), ((demo_ref() - -3)::timestamp + time '19:00'), ((demo_ref() - -4)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000147', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -3), ((demo_ref() - -3)::timestamp + time '07:00'), ((demo_ref() - -3)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000148', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - -4), ((demo_ref() - -4)::timestamp + time '07:00'), ((demo_ref() - -4)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000149', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - -4), ((demo_ref() - -4)::timestamp + time '19:00'), ((demo_ref() - -5)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000150', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -4), ((demo_ref() - -4)::timestamp + time '07:00'), ((demo_ref() - -4)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000151', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - -5), ((demo_ref() - -5)::timestamp + time '07:00'), ((demo_ref() - -5)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000152', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - -5), ((demo_ref() - -5)::timestamp + time '19:00'), ((demo_ref() - -6)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000153', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -5), ((demo_ref() - -5)::timestamp + time '07:00'), ((demo_ref() - -5)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000154', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - -6), ((demo_ref() - -6)::timestamp + time '07:00'), ((demo_ref() - -6)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000155', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - -6), ((demo_ref() - -6)::timestamp + time '19:00'), ((demo_ref() - -7)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000156', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -6), ((demo_ref() - -6)::timestamp + time '07:00'), ((demo_ref() - -6)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000157', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - -7), ((demo_ref() - -7)::timestamp + time '07:00'), ((demo_ref() - -7)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000158', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - -7), ((demo_ref() - -7)::timestamp + time '19:00'), ((demo_ref() - -8)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000159', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -7), ((demo_ref() - -7)::timestamp + time '07:00'), ((demo_ref() - -7)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000160', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - -8), ((demo_ref() - -8)::timestamp + time '07:00'), ((demo_ref() - -8)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000161', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - -8), ((demo_ref() - -8)::timestamp + time '19:00'), ((demo_ref() - -9)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000162', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -8), ((demo_ref() - -8)::timestamp + time '07:00'), ((demo_ref() - -8)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000163', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - -9), ((demo_ref() - -9)::timestamp + time '07:00'), ((demo_ref() - -9)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000164', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - -9), ((demo_ref() - -9)::timestamp + time '19:00'), ((demo_ref() - -10)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000165', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -9), ((demo_ref() - -9)::timestamp + time '07:00'), ((demo_ref() - -9)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000166', 'de300020-0000-4000-8000-000000000005', 'cuidadoras', (demo_ref() - -10), ((demo_ref() - -10)::timestamp + time '07:00'), ((demo_ref() - -10)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000167', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - -10), ((demo_ref() - -10)::timestamp + time '19:00'), ((demo_ref() - -11)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000168', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -10), ((demo_ref() - -10)::timestamp + time '07:00'), ((demo_ref() - -10)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000169', 'de300020-0000-4000-8000-000000000007', 'cuidadoras', (demo_ref() - -11), ((demo_ref() - -11)::timestamp + time '07:00'), ((demo_ref() - -11)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000170', 'de300020-0000-4000-8000-000000000008', 'cuidadoras', (demo_ref() - -11), ((demo_ref() - -11)::timestamp + time '19:00'), ((demo_ref() - -12)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000171', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -11), ((demo_ref() - -11)::timestamp + time '07:00'), ((demo_ref() - -11)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000172', 'de300020-0000-4000-8000-000000000009', 'cuidadoras', (demo_ref() - -12), ((demo_ref() - -12)::timestamp + time '07:00'), ((demo_ref() - -12)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000173', 'de300020-0000-4000-8000-000000000006', 'cuidadoras', (demo_ref() - -12), ((demo_ref() - -12)::timestamp + time '19:00'), ((demo_ref() - -13)::timestamp + time '07:00'), 'noturno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag, check_in, check_out) values
  ('de300050-0000-4000-8000-000000000174', 'de300020-0000-4000-8000-000000000002', 'enfermeiras', (demo_ref() - -12), ((demo_ref() - -12)::timestamp + time '07:00'), ((demo_ref() - -12)::timestamp + time '19:00'), 'diurno',
   null, null)
  on conflict (id) do update set profissional_id = excluded.profissional_id, data = excluded.data,
    inicio = excluded.inicio, fim = excluded.fim, tag = excluded.tag, check_in = excluded.check_in, check_out = excluded.check_out;

-- ── 13 · Documentação institucional — conformidade regulatória ──────────

insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000001', 'alvara_funcionamento', 'Alvará de Funcionamento', 'DOC-2026000', 'Prefeitura Municipal de Curitiba', (demo_ref() - 300), (demo_ref() - -65),
   'documentos-institucionais/demo/placeholder.pdf', 'Renovação anual. Protocolo em dia.', 'Débora Nunes Carvalho', ((demo_ref() - 300)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;
insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000002', 'cmvs', 'CMVS — Cadastro Municipal de Vigilância Sanitária', 'DOC-2026001', 'Secretaria Municipal da Saúde', (demo_ref() - 280), (demo_ref() - -22),
   'documentos-institucionais/demo/placeholder.pdf', 'Renovação protocolada; aguardando publicação.', 'Débora Nunes Carvalho', ((demo_ref() - 280)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;
insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000003', 'avcb', 'AVCB — Auto de Vistoria do Corpo de Bombeiros', 'DOC-2026002', 'Corpo de Bombeiros Militar do Paraná', (demo_ref() - 400), (demo_ref() - 12),
   'documentos-institucionais/demo/placeholder.pdf', 'VENCIDO. Vistoria de renovação solicitada; laudo do sistema de alarme em execução pela contratada. Plano de ação em andamento, prazo de conclusão em 30 dias.', 'Débora Nunes Carvalho', ((demo_ref() - 400)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;
insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000004', 'crt', 'CRT — Certidão de Responsabilidade Técnica', 'DOC-2026003', 'COREN-PR', (demo_ref() - 180), (demo_ref() - -185),
   'documentos-institucionais/demo/placeholder.pdf', null, 'Débora Nunes Carvalho', ((demo_ref() - 180)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;
insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000005', 'controle_pragas', 'Controle de vetores e pragas urbanas', 'DOC-2026004', 'Empresa licenciada — CEVS', (demo_ref() - 45), (demo_ref() - -135),
   'documentos-institucionais/demo/placeholder.pdf', 'Aplicação trimestral.', 'Débora Nunes Carvalho', ((demo_ref() - 45)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;
insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000006', 'limpeza_caixa_agua', 'Limpeza e desinfecção da caixa d''água', 'DOC-2026005', 'Empresa licenciada', (demo_ref() - 70), (demo_ref() - -110),
   'documentos-institucionais/demo/placeholder.pdf', 'Semestral, com laudo de potabilidade.', 'Débora Nunes Carvalho', ((demo_ref() - 70)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;
insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000007', 'contrato_rss', 'Contrato de coleta de resíduos de serviços de saúde', 'DOC-2026006', 'Empresa licenciada — RSS', (demo_ref() - 320), (demo_ref() - -12),
   'documentos-institucionais/demo/placeholder.pdf', 'Renovação em análise pelo jurídico. Minuta enviada em 20/08.', 'Débora Nunes Carvalho', ((demo_ref() - 320)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;
insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000008', 'regulamento_interno', 'Regulamento Interno da instituição', 'DOC-2026007', 'Direção', (demo_ref() - 240), null,
   'documentos-institucionais/demo/placeholder.pdf', 'Sem validade. Revisão anual concluída.', 'Débora Nunes Carvalho', ((demo_ref() - 240)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;
insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000009', 'pgrss', 'PGRSS — Plano de Gerenciamento de RSS', 'DOC-2026008', 'Responsável Técnico', (demo_ref() - 210), (demo_ref() - -155),
   'documentos-institucionais/demo/placeholder.pdf', null, 'Débora Nunes Carvalho', ((demo_ref() - 210)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;
insert into public.documento_institucional (id, tipo, nome, identificador, orgao_emissor, data_emissao, data_validade, arquivo_url, observacao, registrado_por, criado_em) values
  ('de300051-0000-4000-8000-000000000010', 'livro_admissao', 'Livro de registro de admissão de residentes', 'DOC-2026009', 'Direção', (demo_ref() - 350), null,
   'documentos-institucionais/demo/placeholder.pdf', 'Sem validade. Atualizado.', 'Débora Nunes Carvalho', ((demo_ref() - 350)::timestamp + time '10:00'))
  on conflict (id) do update set nome = excluded.nome, data_emissao = excluded.data_emissao,
    data_validade = excluded.data_validade, observacao = excluded.observacao;

-- ── 14 · NPS das famílias ───────────────────────────────────────────────

insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000001', 'de300010-0000-4000-8000-000000000001', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 13),
   'A comunicação no dia da queda foi elogiada pela família: soube na mesma hora, pelo aplicativo e por telefone.')
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000001', 'de300052-0000-4000-8000-000000000001', 'geral', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000002', 'de300052-0000-4000-8000-000000000001', 'limpeza_suites', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000003', 'de300052-0000-4000-8000-000000000001', 'limpeza_areas_comuns', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000004', 'de300052-0000-4000-8000-000000000001', 'atendimento_equipe', 10, 'Fui avisada imediatamente e com detalhes. Isso faz muita diferença para quem mora longe.')
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000005', 'de300052-0000-4000-8000-000000000001', 'comida', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000006', 'de300052-0000-4000-8000-000000000001', 'atividades_fisicas', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000007', 'de300052-0000-4000-8000-000000000001', 'atividades_lazer', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000008', 'de300052-0000-4000-8000-000000000001', 'lavanderia', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000002', 'de300010-0000-4000-8000-000000000002', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 14),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000009', 'de300052-0000-4000-8000-000000000002', 'geral', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000010', 'de300052-0000-4000-8000-000000000002', 'limpeza_suites', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000011', 'de300052-0000-4000-8000-000000000002', 'limpeza_areas_comuns', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000012', 'de300052-0000-4000-8000-000000000002', 'atendimento_equipe', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000013', 'de300052-0000-4000-8000-000000000002', 'comida', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000014', 'de300052-0000-4000-8000-000000000002', 'atividades_fisicas', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000015', 'de300052-0000-4000-8000-000000000002', 'atividades_lazer', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000016', 'de300052-0000-4000-8000-000000000002', 'lavanderia', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000003', 'de300010-0000-4000-8000-000000000003', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 15),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000017', 'de300052-0000-4000-8000-000000000003', 'geral', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000018', 'de300052-0000-4000-8000-000000000003', 'limpeza_suites', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000019', 'de300052-0000-4000-8000-000000000003', 'limpeza_areas_comuns', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000020', 'de300052-0000-4000-8000-000000000003', 'atendimento_equipe', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000021', 'de300052-0000-4000-8000-000000000003', 'comida', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000022', 'de300052-0000-4000-8000-000000000003', 'atividades_fisicas', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000023', 'de300052-0000-4000-8000-000000000003', 'atividades_lazer', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000024', 'de300052-0000-4000-8000-000000000003', 'lavanderia', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000004', 'de300010-0000-4000-8000-000000000004', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 16),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000025', 'de300052-0000-4000-8000-000000000004', 'geral', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000026', 'de300052-0000-4000-8000-000000000004', 'limpeza_suites', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000027', 'de300052-0000-4000-8000-000000000004', 'limpeza_areas_comuns', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000028', 'de300052-0000-4000-8000-000000000004', 'atendimento_equipe', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000029', 'de300052-0000-4000-8000-000000000004', 'comida', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000030', 'de300052-0000-4000-8000-000000000004', 'atividades_fisicas', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000031', 'de300052-0000-4000-8000-000000000004', 'atividades_lazer', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000032', 'de300052-0000-4000-8000-000000000004', 'lavanderia', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000005', 'de300010-0000-4000-8000-000000000005', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 17),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000033', 'de300052-0000-4000-8000-000000000005', 'geral', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000034', 'de300052-0000-4000-8000-000000000005', 'limpeza_suites', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000035', 'de300052-0000-4000-8000-000000000005', 'limpeza_areas_comuns', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000036', 'de300052-0000-4000-8000-000000000005', 'atendimento_equipe', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000037', 'de300052-0000-4000-8000-000000000005', 'comida', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000038', 'de300052-0000-4000-8000-000000000005', 'atividades_fisicas', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000039', 'de300052-0000-4000-8000-000000000005', 'atividades_lazer', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000040', 'de300052-0000-4000-8000-000000000005', 'lavanderia', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000006', 'de300010-0000-4000-8000-000000000006', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 18),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000041', 'de300052-0000-4000-8000-000000000006', 'geral', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000042', 'de300052-0000-4000-8000-000000000006', 'limpeza_suites', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000043', 'de300052-0000-4000-8000-000000000006', 'limpeza_areas_comuns', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000044', 'de300052-0000-4000-8000-000000000006', 'atendimento_equipe', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000045', 'de300052-0000-4000-8000-000000000006', 'comida', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000046', 'de300052-0000-4000-8000-000000000006', 'atividades_fisicas', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000047', 'de300052-0000-4000-8000-000000000006', 'atividades_lazer', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000048', 'de300052-0000-4000-8000-000000000006', 'lavanderia', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000007', 'de300010-0000-4000-8000-000000000007', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 19),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000049', 'de300052-0000-4000-8000-000000000007', 'geral', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000050', 'de300052-0000-4000-8000-000000000007', 'limpeza_suites', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000051', 'de300052-0000-4000-8000-000000000007', 'limpeza_areas_comuns', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000052', 'de300052-0000-4000-8000-000000000007', 'atendimento_equipe', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000053', 'de300052-0000-4000-8000-000000000007', 'comida', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000054', 'de300052-0000-4000-8000-000000000007', 'atividades_fisicas', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000055', 'de300052-0000-4000-8000-000000000007', 'atividades_lazer', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000056', 'de300052-0000-4000-8000-000000000007', 'lavanderia', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000008', 'de300010-0000-4000-8000-000000000008', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 20),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000057', 'de300052-0000-4000-8000-000000000008', 'geral', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000058', 'de300052-0000-4000-8000-000000000008', 'limpeza_suites', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000059', 'de300052-0000-4000-8000-000000000008', 'limpeza_areas_comuns', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000060', 'de300052-0000-4000-8000-000000000008', 'atendimento_equipe', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000061', 'de300052-0000-4000-8000-000000000008', 'comida', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000062', 'de300052-0000-4000-8000-000000000008', 'atividades_fisicas', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000063', 'de300052-0000-4000-8000-000000000008', 'atividades_lazer', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000064', 'de300052-0000-4000-8000-000000000008', 'lavanderia', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000009', 'de300010-0000-4000-8000-000000000009', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 12),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000065', 'de300052-0000-4000-8000-000000000009', 'geral', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000066', 'de300052-0000-4000-8000-000000000009', 'limpeza_suites', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000067', 'de300052-0000-4000-8000-000000000009', 'limpeza_areas_comuns', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000068', 'de300052-0000-4000-8000-000000000009', 'atendimento_equipe', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000069', 'de300052-0000-4000-8000-000000000009', 'comida', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000070', 'de300052-0000-4000-8000-000000000009', 'atividades_fisicas', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000071', 'de300052-0000-4000-8000-000000000009', 'atividades_lazer', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000072', 'de300052-0000-4000-8000-000000000009', 'lavanderia', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000010', 'de300010-0000-4000-8000-000000000010', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 13),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000073', 'de300052-0000-4000-8000-000000000010', 'geral', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000074', 'de300052-0000-4000-8000-000000000010', 'limpeza_suites', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000075', 'de300052-0000-4000-8000-000000000010', 'limpeza_areas_comuns', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000076', 'de300052-0000-4000-8000-000000000010', 'atendimento_equipe', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000077', 'de300052-0000-4000-8000-000000000010', 'comida', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000078', 'de300052-0000-4000-8000-000000000010', 'atividades_fisicas', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000079', 'de300052-0000-4000-8000-000000000010', 'atividades_lazer', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000080', 'de300052-0000-4000-8000-000000000010', 'lavanderia', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000011', 'de300010-0000-4000-8000-000000000011', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 14),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000081', 'de300052-0000-4000-8000-000000000011', 'geral', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000082', 'de300052-0000-4000-8000-000000000011', 'limpeza_suites', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000083', 'de300052-0000-4000-8000-000000000011', 'limpeza_areas_comuns', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000084', 'de300052-0000-4000-8000-000000000011', 'atendimento_equipe', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000085', 'de300052-0000-4000-8000-000000000011', 'comida', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000086', 'de300052-0000-4000-8000-000000000011', 'atividades_fisicas', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000087', 'de300052-0000-4000-8000-000000000011', 'atividades_lazer', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000088', 'de300052-0000-4000-8000-000000000011', 'lavanderia', 10, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_pesquisa (id, residente_id, respondente, aplicada_por, perfil_aplicador, data, observacao_geral) values
  ('de300052-0000-4000-8000-000000000012', 'de300010-0000-4000-8000-000000000012', 'familiar', 'Débora Nunes Carvalho', 'administracao', (demo_ref() - 15),
   null)
  on conflict (id) do update set data = excluded.data, observacao_geral = excluded.observacao_geral;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000089', 'de300052-0000-4000-8000-000000000012', 'geral', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000090', 'de300052-0000-4000-8000-000000000012', 'limpeza_suites', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000091', 'de300052-0000-4000-8000-000000000012', 'limpeza_areas_comuns', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000092', 'de300052-0000-4000-8000-000000000012', 'atendimento_equipe', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000093', 'de300052-0000-4000-8000-000000000012', 'comida', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000094', 'de300052-0000-4000-8000-000000000012', 'atividades_fisicas', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000095', 'de300052-0000-4000-8000-000000000012', 'atividades_lazer', 8, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;
insert into public.nps_resposta (id, pesquisa_id, dimensao, nota, comentario) values
  ('de300053-0000-4000-8000-000000000096', 'de300052-0000-4000-8000-000000000012', 'lavanderia', 9, null)
  on conflict (id) do update set nota = excluded.nota, comentario = excluded.comentario;

-- ── 15 · Atividades, nutrição, enxoval e manutenção ─────────────────────

insert into public.atividade (id, titulo, descricao, horario, recorrente, dias_semana, criada_por, criado_em) values
  ('de300054-0000-4000-8000-000000000001', 'Coral', 'Ensaio do coral com acompanhamento de violão.', '10:00', true, array['qua']::text[], 'Sandra Vieira Nogueira', ((demo_ref() - 120)::timestamp + time '09:00'))
  on conflict (id) do update set titulo = excluded.titulo, descricao = excluded.descricao, horario = excluded.horario;
insert into public.atividade (id, titulo, descricao, horario, recorrente, dias_semana, criada_por, criado_em) values
  ('de300054-0000-4000-8000-000000000002', 'Oficina de memória', 'Jogos de linguagem, palavras cruzadas e recordação orientada.', '15:00', true, array['ter', 'qui']::text[], 'Sandra Vieira Nogueira', ((demo_ref() - 120)::timestamp + time '09:00'))
  on conflict (id) do update set titulo = excluded.titulo, descricao = excluded.descricao, horario = excluded.horario;
insert into public.atividade (id, titulo, descricao, horario, recorrente, dias_semana, criada_por, criado_em) values
  ('de300054-0000-4000-8000-000000000003', 'Ginástica funcional', 'Exercícios de mobilidade e equilíbrio conduzidos pela fisioterapeuta.', '09:00', true, array['seg', 'qua', 'sex']::text[], 'Sandra Vieira Nogueira', ((demo_ref() - 120)::timestamp + time '09:00'))
  on conflict (id) do update set titulo = excluded.titulo, descricao = excluded.descricao, horario = excluded.horario;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000001', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000001',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000002', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000001',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000003', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000001',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000004', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000002',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000005', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000002',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000006', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000002',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000007', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000003',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000008', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000003',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000009', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000003',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000010', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000004',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000011', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000004',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000012', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000004',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000013', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000005',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000014', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000005',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000015', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000005',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000016', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000006',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000017', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000006',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000018', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000006',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000019', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000007',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000020', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000007',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000021', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000007',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000022', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000008',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000023', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000008',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000024', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000008',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000025', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000009',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000026', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000009',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000027', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000009',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000028', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000010',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000029', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000010',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000030', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000010',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000031', 'de300054-0000-4000-8000-000000000002', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000011',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000032', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000011',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000033', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000011',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000034', 'de300054-0000-4000-8000-000000000003', (demo_ref() - 2), 'de300010-0000-4000-8000-000000000012',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 2)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000035', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 6), 'de300010-0000-4000-8000-000000000012',
   false, 'Sandra Vieira Nogueira', ((demo_ref() - 6)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.atividade_participacao (id, atividade_id, data, residente_id, presente, registrado_por, registrado_em) values
  ('de300055-0000-4000-8000-000000000036', 'de300054-0000-4000-8000-000000000001', (demo_ref() - 9), 'de300010-0000-4000-8000-000000000012',
   true, 'Sandra Vieira Nogueira', ((demo_ref() - 9)::timestamp + time '16:00'))
  on conflict (id) do update set presente = excluded.presente, data = excluded.data;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000001', (demo_ref() - 2), 'livre', null, 'Helena Fontes Vieira', ((demo_ref() - 5)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000002', (demo_ref() - 2), 'diabetico', 'Sem açúcar de adição; sobremesa de fruta.', 'Helena Fontes Vieira', ((demo_ref() - 5)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000003', (demo_ref() - 2), 'pastosa', 'Consistência pastosa homogênea, conforme avaliação fonoaudiológica.', 'Helena Fontes Vieira', ((demo_ref() - 5)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000004', (demo_ref() - 1), 'livre', null, 'Helena Fontes Vieira', ((demo_ref() - 4)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000005', (demo_ref() - 1), 'diabetico', 'Sem açúcar de adição; sobremesa de fruta.', 'Helena Fontes Vieira', ((demo_ref() - 4)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000006', (demo_ref() - 1), 'pastosa', 'Consistência pastosa homogênea, conforme avaliação fonoaudiológica.', 'Helena Fontes Vieira', ((demo_ref() - 4)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000007', (demo_ref() - 0), 'livre', null, 'Helena Fontes Vieira', ((demo_ref() - 3)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000008', (demo_ref() - 0), 'diabetico', 'Sem açúcar de adição; sobremesa de fruta.', 'Helena Fontes Vieira', ((demo_ref() - 3)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000009', (demo_ref() - 0), 'pastosa', 'Consistência pastosa homogênea, conforme avaliação fonoaudiológica.', 'Helena Fontes Vieira', ((demo_ref() - 3)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000010', (demo_ref() - -1), 'livre', null, 'Helena Fontes Vieira', ((demo_ref() - 2)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000011', (demo_ref() - -1), 'diabetico', 'Sem açúcar de adição; sobremesa de fruta.', 'Helena Fontes Vieira', ((demo_ref() - 2)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000012', (demo_ref() - -1), 'pastosa', 'Consistência pastosa homogênea, conforme avaliação fonoaudiológica.', 'Helena Fontes Vieira', ((demo_ref() - 2)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000013', (demo_ref() - -2), 'livre', null, 'Helena Fontes Vieira', ((demo_ref() - 1)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000014', (demo_ref() - -2), 'diabetico', 'Sem açúcar de adição; sobremesa de fruta.', 'Helena Fontes Vieira', ((demo_ref() - 1)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000015', (demo_ref() - -2), 'pastosa', 'Consistência pastosa homogênea, conforme avaliação fonoaudiológica.', 'Helena Fontes Vieira', ((demo_ref() - 1)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000016', (demo_ref() - -3), 'livre', null, 'Helena Fontes Vieira', ((demo_ref() - 0)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000017', (demo_ref() - -3), 'diabetico', 'Sem açúcar de adição; sobremesa de fruta.', 'Helena Fontes Vieira', ((demo_ref() - 0)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000018', (demo_ref() - -3), 'pastosa', 'Consistência pastosa homogênea, conforme avaliação fonoaudiológica.', 'Helena Fontes Vieira', ((demo_ref() - 0)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000019', (demo_ref() - -4), 'livre', null, 'Helena Fontes Vieira', ((demo_ref() - -1)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000020', (demo_ref() - -4), 'diabetico', 'Sem açúcar de adição; sobremesa de fruta.', 'Helena Fontes Vieira', ((demo_ref() - -1)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000021', (demo_ref() - -4), 'pastosa', 'Consistência pastosa homogênea, conforme avaliação fonoaudiológica.', 'Helena Fontes Vieira', ((demo_ref() - -1)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000022', (demo_ref() - -5), 'livre', null, 'Helena Fontes Vieira', ((demo_ref() - -2)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000023', (demo_ref() - -5), 'diabetico', 'Sem açúcar de adição; sobremesa de fruta.', 'Helena Fontes Vieira', ((demo_ref() - -2)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.cardapio (id, data, tipo_restricao, observacao, criado_por, criado_em) values
  ('de300058-0000-4000-8000-000000000024', (demo_ref() - -5), 'pastosa', 'Consistência pastosa homogênea, conforme avaliação fonoaudiológica.', 'Helena Fontes Vieira', ((demo_ref() - -2)::timestamp + time '08:00'))
  on conflict (data, tipo_restricao) do nothing;
insert into public.enxoval (id, categoria, descricao, quantidade_total, quantidade_disponivel, estoque_minimo, observacao, atualizado_em) values
  ('de300056-0000-4000-8000-000000000001', 'roupa_cama', 'Jogo de lençol solteiro — algodão 200 fios', 96, 74, 30,
   null, ((demo_ref() - 1)::timestamp + time '11:00'))
  on conflict (id) do update set quantidade_total = excluded.quantidade_total,
    quantidade_disponivel = excluded.quantidade_disponivel, estoque_minimo = excluded.estoque_minimo, observacao = excluded.observacao;
insert into public.enxoval (id, categoria, descricao, quantidade_total, quantidade_disponivel, estoque_minimo, observacao, atualizado_em) values
  ('de300056-0000-4000-8000-000000000002', 'toalha_banho', 'Toalha de banho branca', 120, 88, 40,
   null, ((demo_ref() - 1)::timestamp + time '11:00'))
  on conflict (id) do update set quantidade_total = excluded.quantidade_total,
    quantidade_disponivel = excluded.quantidade_disponivel, estoque_minimo = excluded.estoque_minimo, observacao = excluded.observacao;
insert into public.enxoval (id, categoria, descricao, quantidade_total, quantidade_disponivel, estoque_minimo, observacao, atualizado_em) values
  ('de300056-0000-4000-8000-000000000003', 'toalha_rosto', 'Toalha de rosto branca', 120, 96, 40,
   null, ((demo_ref() - 1)::timestamp + time '11:00'))
  on conflict (id) do update set quantidade_total = excluded.quantidade_total,
    quantidade_disponivel = excluded.quantidade_disponivel, estoque_minimo = excluded.estoque_minimo, observacao = excluded.observacao;
insert into public.enxoval (id, categoria, descricao, quantidade_total, quantidade_disponivel, estoque_minimo, observacao, atualizado_em) values
  ('de300056-0000-4000-8000-000000000004', 'cobertor_manta', 'Manta antialérgica solteiro', 48, 41, 20,
   null, ((demo_ref() - 1)::timestamp + time '11:00'))
  on conflict (id) do update set quantidade_total = excluded.quantidade_total,
    quantidade_disponivel = excluded.quantidade_disponivel, estoque_minimo = excluded.estoque_minimo, observacao = excluded.observacao;
insert into public.enxoval (id, categoria, descricao, quantidade_total, quantidade_disponivel, estoque_minimo, observacao, atualizado_em) values
  ('de300056-0000-4000-8000-000000000005', 'fronha', 'Fronha branca avulsa', 144, 26, 48,
   'Abaixo do estoque mínimo. Reposição solicitada à administração.', ((demo_ref() - 1)::timestamp + time '11:00'))
  on conflict (id) do update set quantidade_total = excluded.quantidade_total,
    quantidade_disponivel = excluded.quantidade_disponivel, estoque_minimo = excluded.estoque_minimo, observacao = excluded.observacao;
insert into public.chamado_manutencao (id, local, residente_id, problema, urgencia, status, aberto_por, perfil_solicitante, destino, responsavel, criado_em) values
  ('de300057-0000-4000-8000-000000000001', 'Suíte 204 — banheiro', 'de300010-0000-4000-8000-000000000001',
   'Instalação de barra de apoio adicional no box e troca do piso por revestimento antiderrapante, após a queda da moradora.',
   'alta', 'em_andamento', 'Rosana Prado Lima', 'coordenacao', 'servicos_gerais', 'Manutenção predial', ((demo_ref() - 20)::timestamp + time '08:30')),
  ('de300057-0000-4000-8000-000000000002', 'Área comum — jardim', null, 'Revisão da iluminação do caminho do jardim.', 'baixa', 'aberto', 'Débora Nunes Carvalho', 'master', 'servicos_gerais', null, ((demo_ref() - 4)::timestamp + time '14:00'))
  on conflict (id) do update set problema = excluded.problema, status = excluded.status, urgencia = excluded.urgencia;

-- ── 16 · Logins (senha: blue) ───────────────────────────────────────────

do $$
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
end $$;

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
