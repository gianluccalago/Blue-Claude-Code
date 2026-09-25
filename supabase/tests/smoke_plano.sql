-- ===========================================================================
-- SMOKE — PLANO DE CUIDADO (0137): aplicar modelo sem duplicar + histórico
-- intacto ao editar/desativar item. Mesmo padrão do rls_smoke.sql (PASS/FAIL
-- por linha; roda num banco descartável recém-migrado via scripts/db-check.sh,
-- em sessão própria — por isso os helpers pg_temp são redefinidos aqui).
-- Hóspedes do seed: a0…0001 (Alzira) e a0…0002 (Otávio). A cuidadora é a
-- Mariana (a Beatriz é inativada no fim do rls_smoke.sql).
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
-- Itens ATIVOS do smoke no plano de um hóspede.
create or replace function pg_temp.ativas(p_res uuid) returns bigint language sql as $$
  select count(*) from public.plano_cuidado_item where residente_id = p_res and ativa and tarefa like 'Smoke:%' $$;

-- Preparação (como postgres): modelo com 2 tarefas distintas + 1 repetida.
insert into public.modelo_rotina (id, nome, ativo) values
 ('d0000000-0000-4000-8000-000000000001', 'Smoke modelo', true),
 ('d0000000-0000-4000-8000-000000000002', 'Smoke modelo inativo', false)
on conflict (id) do nothing;
delete from public.modelo_rotina_item where modelo_id = 'd0000000-0000-4000-8000-000000000001';
insert into public.modelo_rotina_item (modelo_id, tarefa, horario, responsavel, tolerancia_minutos) values
 ('d0000000-0000-4000-8000-000000000001', 'Smoke: hidratação', '10:00', 'cuidador', 30),
 ('d0000000-0000-4000-8000-000000000001', 'Smoke: curativo', '14:00', 'enfermagem', 15),
 ('d0000000-0000-4000-8000-000000000001', 'Smoke: hidratação', '10:00', 'cuidador', 30);
delete from public.tarefa_registro where tarefa in (select id::text from public.plano_cuidado_item where tarefa like 'Smoke:%');
delete from public.plano_cuidado_item where tarefa like 'Smoke:%';

-- ── Coordenação aplica o modelo ────────────────────────────────────────────
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('coordenação: 1ª aplicação insere 2 e 0 já existiam',
  (select inseridas = 2 and existentes = 0 from public.aplicar_modelo_rotina(
    'd0000000-0000-4000-8000-000000000001', array['a0000000-0000-0000-0000-000000000001']::uuid[],
    'e0000000-0000-4000-8000-000000000001')));
select pg_temp.verifica('item repetido no modelo entra uma vez só', pg_temp.ativas('a0000000-0000-0000-0000-000000000001') = 2);
select pg_temp.verifica('coordenação: 2ª aplicação insere 0 e 2 já existiam (CLI-06)',
  (select inseridas = 0 and existentes = 2 from public.aplicar_modelo_rotina(
    'd0000000-0000-4000-8000-000000000001', array['a0000000-0000-0000-0000-000000000001']::uuid[],
    'e0000000-0000-4000-8000-000000000002')));
select pg_temp.verifica('plano não duplicou após reaplicar', pg_temp.ativas('a0000000-0000-0000-0000-000000000001') = 2);
select pg_temp.verifica('mesma chave de idempotência devolve o 1º resultado sem inserir',
  (select inseridas = 2 and existentes = 0 from public.aplicar_modelo_rotina(
    'd0000000-0000-4000-8000-000000000001', array['a0000000-0000-0000-0000-000000000001']::uuid[],
    'e0000000-0000-4000-8000-000000000001'))
  and pg_temp.ativas('a0000000-0000-0000-0000-000000000001') = 2);
select pg_temp.verifica('lote com 2 hóspedes: só o novo recebe (2 inseridas, 2 existentes)',
  (select inseridas = 2 and existentes = 2 from public.aplicar_modelo_rotina(
    'd0000000-0000-4000-8000-000000000001',
    array['a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002']::uuid[],
    'e0000000-0000-4000-8000-000000000003'))
  and pg_temp.ativas('a0000000-0000-0000-0000-000000000002') = 2);
select pg_temp.verifica('rastro de aplicação gravado (3 chamadas)',
  (select count(*) from public.plano_aplicacao_modelo where modelo_id = 'd0000000-0000-4000-8000-000000000001') = 3);
select pg_temp.verifica('modelo inativo é recusado', pg_temp.falha($q$select public.aplicar_modelo_rotina('d0000000-0000-4000-8000-000000000002', array['a0000000-0000-0000-0000-000000000001']::uuid[], 'e0000000-0000-4000-8000-000000000004')$q$));
select pg_temp.verifica('hóspede inexistente é recusado', pg_temp.falha($q$select public.aplicar_modelo_rotina('d0000000-0000-4000-8000-000000000001', array['ffffffff-0000-0000-0000-000000000000']::uuid[], 'e0000000-0000-4000-8000-000000000005')$q$));
select pg_temp.verifica('coordenação não grava direto no rastro', pg_temp.falha($q$insert into public.plano_aplicacao_modelo (idempotencia, modelo_id, residentes) values (gen_random_uuid(), 'd0000000-0000-4000-8000-000000000001', '{}')$q$));
reset role;

-- ── Quem NÃO aplica modelo ─────────────────────────────────────────────────
select pg_temp.como('mariana@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora não aplica modelo (RPC)', pg_temp.falha($q$select public.aplicar_modelo_rotina('d0000000-0000-4000-8000-000000000001', array['a0000000-0000-0000-0000-000000000001']::uuid[], 'e0000000-0000-4000-8000-000000000006')$q$));
select pg_temp.verifica('cuidadora não lê o rastro de aplicações', (select count(*) from public.plano_aplicacao_modelo) = 0);
reset role;
select pg_temp.como('enfermeira@blueseniorliving.com.br');
select pg_temp.verifica('enfermeira não aplica modelo (RPC)', pg_temp.falha($q$select public.aplicar_modelo_rotina('d0000000-0000-4000-8000-000000000001', array['a0000000-0000-0000-0000-000000000001']::uuid[], 'e0000000-0000-4000-8000-000000000007')$q$));
reset role;
select pg_temp.como('familia@blueseniorliving.com.br');
select pg_temp.verifica('família não aplica modelo (RPC)', pg_temp.falha($q$select public.aplicar_modelo_rotina('d0000000-0000-4000-8000-000000000001', array['a0000000-0000-0000-0000-000000000001']::uuid[], 'e0000000-0000-4000-8000-000000000008')$q$));
reset role;
set role anon; select set_config('request.jwt.claims', '', false);
select pg_temp.verifica('anon não aplica modelo (RPC)', pg_temp.falha($q$select public.aplicar_modelo_rotina('d0000000-0000-4000-8000-000000000001', array['a0000000-0000-0000-0000-000000000001']::uuid[], 'e0000000-0000-4000-8000-000000000009')$q$));
reset role;

-- ── Histórico: editar/desativar item não mexe no registro passado ─────────
-- Guarda o id do item "hidratação 10:00" da Alzira numa tabela temporária.
create temp table smoke_item as
  select id from public.plano_cuidado_item
   where residente_id = 'a0000000-0000-0000-0000-000000000001' and tarefa = 'Smoke: hidratação' and ativa limit 1;
grant select on smoke_item to authenticated;

-- A cuidadora marca a tarefa como feita (tarefa_registro.tarefa = id do item, horário da época).
select pg_temp.como('mariana@blueseniorliving.com.br');
insert into public.tarefa_registro (residente_id, tarefa, horario, status, data)
  select 'a0000000-0000-0000-0000-000000000001', id::text, '10:00', 'feito', current_date - 1 from smoke_item;
select pg_temp.verifica('cuidadora registrou a execução do item',
  (select count(*) from public.tarefa_registro where tarefa = (select id::text from smoke_item)) = 1);
reset role;

select pg_temp.como('coordenacao@blueseniorliving.com.br');
update public.plano_cuidado_item set horario = '11:00', tolerancia_minutos = 45 where id = (select id from smoke_item);
select pg_temp.verifica('coordenação edita horário/tolerância do item',
  (select horario = '11:00' and tolerancia_minutos = 45 from public.plano_cuidado_item where id = (select id from smoke_item)));
select pg_temp.verifica('registro passado mantém o horário da época (10:00)',
  (select horario from public.tarefa_registro where tarefa = (select id::text from smoke_item)) = '10:00');
select pg_temp.verifica('texto da tarefa não muda in-place',
  pg_temp.falha($q$update public.plano_cuidado_item set tarefa = 'Smoke: outra coisa' where id = (select id from smoke_item)$q$));
select pg_temp.verifica('responsável não muda in-place',
  pg_temp.falha($q$update public.plano_cuidado_item set responsavel = 'enfermagem' where id = (select id from smoke_item)$q$));
update public.plano_cuidado_item set ativa = false where id = (select id from smoke_item);
select pg_temp.verifica('desativar (ativa=false) é permitido',
  (select not ativa from public.plano_cuidado_item where id = (select id from smoke_item)));
select pg_temp.verifica('registro sobrevive à desativação e ainda resolve o texto pelo id',
  (select p.tarefa from public.tarefa_registro r join public.plano_cuidado_item p on p.id::text = r.tarefa
    where r.tarefa = (select id::text from smoke_item)) = 'Smoke: hidratação');
select pg_temp.verifica('item com registro não é apagado fisicamente',
  pg_temp.falha($q$delete from public.plano_cuidado_item where id = (select id from smoke_item)$q$));
select pg_temp.verifica('registro continua lá após a tentativa de exclusão',
  (select count(*) from public.tarefa_registro where tarefa = (select id::text from smoke_item)) = 1);
-- Item desativado não conta como existente: reaplicar recria só ele.
select pg_temp.verifica('reaplicar após desativar recria só o item desativado (1 inserida, 1 existente)',
  (select inseridas = 1 and existentes = 1 from public.aplicar_modelo_rotina(
    'd0000000-0000-4000-8000-000000000001', array['a0000000-0000-0000-0000-000000000001']::uuid[],
    'e0000000-0000-4000-8000-000000000010'))
  and pg_temp.ativas('a0000000-0000-0000-0000-000000000001') = 2);
reset role;
