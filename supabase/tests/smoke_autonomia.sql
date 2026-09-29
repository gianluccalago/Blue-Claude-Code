-- ===========================================================================
-- SMOKE — MÓDULO AUTONOMIA (0147): cada perfil escreve só o seu domínio,
-- assinada é imutável, um rascunho por domínio, autoria pelo servidor,
-- revisão atualiza o objetivo, tarefa só apoia objetivo do mesmo hóspede,
-- cuidadora só lê, família não vê.
-- Hóspedes do seed: a0…0001 (Alzira), a0…0002 (Otávio).
-- ===========================================================================
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
begin
  execute 'set role authenticated';
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, false);
end $$;
create or replace function pg_temp.verifica(p_nome text, p_ok boolean) returns text language sql as $$
  select case when p_ok then 'PASS ' else 'FAIL ' end || p_nome $$;
create or replace function pg_temp.falha(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;

-- Limpeza (postgres).
delete from public.plano_cuidado_item where tarefa like 'SmokeA:%';
delete from public.autonomia_objetivo where descricao like 'SmokeA:%';
delete from public.autonomia_avaliacao where residente_id in ('a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002');

select pg_temp.verifica('módulo ativado com data', (select ativado_em is not null from public.autonomia_modulo));

-- ── Médico: só o domínio médico ─────────────────────────────────────────────
select pg_temp.como('medico@blueseniorliving.com.br');
insert into public.autonomia_avaliacao (residente_id, dominio, itens, registrado_por)
  values ('a0000000-0000-0000-0000-000000000001', 'medico', '{"restricoes":{"obs":"Sem banho sem apoio até 15/11"}}', 'forjado');
select pg_temp.verifica('médico grava rascunho do domínio médico',
  (select count(*) from public.autonomia_avaliacao where residente_id = 'a0000000-0000-0000-0000-000000000001' and dominio = 'medico' and not assinada) = 1);
select pg_temp.verifica('autoria do rascunho gravada pelo servidor (não o nome forjado)',
  (select registrado_por = 'Helena Marques' from public.autonomia_avaliacao where residente_id = 'a0000000-0000-0000-0000-000000000001' and dominio = 'medico'));
select pg_temp.verifica('médico NÃO grava domínio da coordenação',
  pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio) values ('a0000000-0000-0000-0000-000000000001', 'coordenacao')$q$));
select pg_temp.verifica('segundo rascunho do mesmo domínio é recusado',
  pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio) values ('a0000000-0000-0000-0000-000000000001', 'medico')$q$));
update public.autonomia_avaliacao set assinada = true, assinada_por = 'forjado'
 where residente_id = 'a0000000-0000-0000-0000-000000000001' and dominio = 'medico';
select pg_temp.verifica('assinatura grava data e quem assinou (servidor)',
  (select assinada and assinada_em is not null and assinada_por = 'Helena Marques'
     from public.autonomia_avaliacao where residente_id = 'a0000000-0000-0000-0000-000000000001' and dominio = 'medico'));
select pg_temp.verifica('avaliação assinada não se altera',
  pg_temp.falha($q$update public.autonomia_avaliacao set sintese = 'mudou' where residente_id = 'a0000000-0000-0000-0000-000000000001' and dominio = 'medico'$q$));
select pg_temp.verifica('avaliação assinada não se apaga',
  pg_temp.falha($q$delete from public.autonomia_avaliacao where residente_id = 'a0000000-0000-0000-0000-000000000001' and dominio = 'medico'$q$));
select pg_temp.verifica('assinar avaliação vazia é recusado',
  pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio, assinada) values ('a0000000-0000-0000-0000-000000000002', 'medico', true)$q$));
insert into public.autonomia_avaliacao (residente_id, dominio, motivo, itens)
  values ('a0000000-0000-0000-0000-000000000001', 'medico', 'periodica', '{"humor":{"obs":"estável"}}');
select pg_temp.verifica('reavaliação: novo rascunho convive com a assinada',
  (select count(*) from public.autonomia_avaliacao where residente_id = 'a0000000-0000-0000-0000-000000000001' and dominio = 'medico') = 2);
delete from public.autonomia_avaliacao where residente_id = 'a0000000-0000-0000-0000-000000000001' and dominio = 'medico' and not assinada;
select pg_temp.verifica('rascunho pode ser descartado',
  (select count(*) from public.autonomia_avaliacao where residente_id = 'a0000000-0000-0000-0000-000000000001' and dominio = 'medico') = 1);
reset role;

-- ── Fisio (multidisciplinar) e nutrição ─────────────────────────────────────
select pg_temp.como('multi@blueseniorliving.com.br');
select pg_temp.verifica('multidisciplinar grava o domínio fisio',
  not pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio, itens, assinada) values ('a0000000-0000-0000-0000-000000000001', 'fisio', '{"cama":{"consegue":"sozinho"}}', true)$q$));
select pg_temp.verifica('multidisciplinar NÃO grava nutrição',
  pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio) values ('a0000000-0000-0000-0000-000000000001', 'nutricao')$q$));
reset role;
select pg_temp.como('nutri@blueseniorliving.com.br');
select pg_temp.verifica('nutricionista grava o domínio nutrição',
  not pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio, itens) values ('a0000000-0000-0000-0000-000000000001', 'nutricao', '{"agua":{"consegue":"sozinho"}}')$q$));
select pg_temp.verifica('nutricionista NÃO grava fisio',
  pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio) values ('a0000000-0000-0000-0000-000000000002', 'fisio')$q$));
reset role;

-- ── Coordenação: domínio + objetivo + revisão ───────────────────────────────
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('coordenação grava o domínio coordenação',
  not pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio, itens, assinada) values ('a0000000-0000-0000-0000-000000000001', 'coordenacao', '{"roupa":{"consegue":"sozinho","preferencia":"escolhe na véspera","equipe_assume":true}}', true)$q$));
select pg_temp.verifica('coordenação NÃO altera avaliação do médico',
  pg_temp.falha($q$update public.autonomia_avaliacao set sintese = 'x' where dominio = 'medico' and residente_id = 'a0000000-0000-0000-0000-000000000001'$q$)
  or (select sintese is null from public.autonomia_avaliacao where dominio = 'medico' and residente_id = 'a0000000-0000-0000-0000-000000000001'));
insert into public.autonomia_objetivo (residente_id, dominio, descricao, meta, prazo_revisao, criado_por)
  values ('a0000000-0000-0000-0000-000000000001', 'fisio', 'SmokeA: ir ao refeitório com andador', '5x por semana no almoço', current_date + 10, 'forjado');
select pg_temp.verifica('coordenação cria objetivo (autoria do servidor)',
  (select criado_por <> 'forjado' and status = 'ativo' from public.autonomia_objetivo where descricao like 'SmokeA:%'));
select pg_temp.verifica('objetivo sem meta é recusado',
  pg_temp.falha($q$insert into public.autonomia_objetivo (residente_id, dominio, descricao, meta) values ('a0000000-0000-0000-0000-000000000001', 'fisio', 'SmokeA: x', '  ')$q$));
select pg_temp.verifica('revisão sem fala do residente é recusada',
  pg_temp.falha($q$insert into public.autonomia_revisao (objetivo_id, observado, fala_residente, resultado) select id, 'foi 3x', '', 'mantido' from public.autonomia_objetivo where descricao like 'SmokeA:%'$q$));
insert into public.autonomia_revisao (objetivo_id, observado, fala_residente, resultado, participantes, proxima_revisao)
  select id, 'Foi 4x com andador, supervisão à distância', 'Quero ir sozinha', 'mantido', array['residente','equipe'], current_date + 90
    from public.autonomia_objetivo where descricao like 'SmokeA:%';
select pg_temp.verifica('revisão atualiza próxima revisão e acordo com o residente',
  (select prazo_revisao = current_date + 90 and acordado_residente_em = current_date and acordado_familia_em is null
     from public.autonomia_objetivo where descricao like 'SmokeA:%'));
select pg_temp.verifica('revisão não se altera',
  pg_temp.falha($q$update public.autonomia_revisao set observado = 'x' where objetivo_id in (select id from public.autonomia_objetivo where descricao like 'SmokeA:%')$q$)
  or (select observado <> 'x' from public.autonomia_revisao where objetivo_id in (select id from public.autonomia_objetivo where descricao like 'SmokeA:%') limit 1));
-- Tarefa do plano apoiando o objetivo.
insert into public.plano_cuidado_item (residente_id, tarefa, horario, responsavel, objetivo_id)
  select 'a0000000-0000-0000-0000-000000000001', 'SmokeA: acompanhar ao refeitório', '12:00', 'cuidador', id
    from public.autonomia_objetivo where descricao like 'SmokeA:%';
select pg_temp.verifica('tarefa do plano aponta para o objetivo do mesmo hóspede',
  (select count(*) from public.plano_cuidado_item where tarefa = 'SmokeA: acompanhar ao refeitório' and objetivo_id is not null) = 1);
select pg_temp.verifica('tarefa NÃO aponta para objetivo de outro hóspede',
  pg_temp.falha($q$insert into public.plano_cuidado_item (residente_id, tarefa, horario, responsavel, objetivo_id) select 'a0000000-0000-0000-0000-000000000002', 'SmokeA: x', '12:00', 'cuidador', id from public.autonomia_objetivo where descricao like 'SmokeA:%'$q$));
insert into public.autonomia_revisao (objetivo_id, observado, fala_residente, resultado)
  select id, 'Vai sozinha todos os dias', 'Estou feliz', 'atingido' from public.autonomia_objetivo where descricao like 'SmokeA:%';
select pg_temp.verifica('revisão "atingido" fecha o objetivo',
  (select status = 'atingido' from public.autonomia_objetivo where descricao like 'SmokeA:%'));
reset role;

-- ── Cuidadora: lê, não escreve ──────────────────────────────────────────────
select pg_temp.como('mariana@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora lê as avaliações',
  (select count(*) from public.autonomia_avaliacao where residente_id = 'a0000000-0000-0000-0000-000000000001') >= 3);
select pg_temp.verifica('cuidadora não grava avaliação',
  pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio) values ('a0000000-0000-0000-0000-000000000002', 'coordenacao')$q$));
select pg_temp.verifica('cuidadora não cria objetivo',
  pg_temp.falha($q$insert into public.autonomia_objetivo (residente_id, dominio, descricao, meta) values ('a0000000-0000-0000-0000-000000000001', 'fisio', 'SmokeA: y', 'z')$q$));
reset role;

-- ── Família: fora do módulo ─────────────────────────────────────────────────
select pg_temp.como('familia@blueseniorliving.com.br');
select pg_temp.verifica('família não lê avaliações', (select count(*) from public.autonomia_avaliacao) = 0);
select pg_temp.verifica('família não lê objetivos', (select count(*) from public.autonomia_objetivo) = 0);
select pg_temp.verifica('família não lê revisões', (select count(*) from public.autonomia_revisao) = 0);
reset role;

-- ── Master: qualquer domínio ────────────────────────────────────────────────
select pg_temp.como('master@blueseniorliving.com.br');
select pg_temp.verifica('master grava qualquer domínio',
  not pg_temp.falha($q$insert into public.autonomia_avaliacao (residente_id, dominio, itens) values ('a0000000-0000-0000-0000-000000000002', 'nutricao', '{"agua":{"consegue":"sozinho"}}')$q$));
reset role;
