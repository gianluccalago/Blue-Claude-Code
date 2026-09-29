-- ===========================================================================
-- SMOKE — TAREFAS PERIÓDICAS (0146): intervalo_dias/inicio_em no plano e no
-- modelo, limites do intervalo, aplicar modelo copiando o intervalo sem
-- duplicar. Hóspede do seed: a0…0001 (Alzira).
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

insert into public.modelo_rotina (id, nome, ativo) values
 ('d0000000-0000-4000-8000-0000000000b1', 'Smoke periódicas', true)
on conflict (id) do nothing;
delete from public.modelo_rotina_item where modelo_id = 'd0000000-0000-4000-8000-0000000000b1';
insert into public.modelo_rotina_item (modelo_id, tarefa, horario, intervalo_dias, responsavel, tolerancia_minutos) values
 ('d0000000-0000-4000-8000-0000000000b1', 'SmokeP: pressão', '09:00', 15, 'enfermagem', 30),
 ('d0000000-0000-4000-8000-0000000000b1', 'SmokeP: pressão', '09:00', null, 'enfermagem', 30);
delete from public.tarefa_registro where tarefa in (select id::text from public.plano_cuidado_item where tarefa like 'SmokeP:%');
delete from public.plano_cuidado_item where tarefa like 'SmokeP:%';

select pg_temp.verifica('intervalo 1 é recusado (use "todo dia" = NULL)',
  pg_temp.falha($q$insert into public.plano_cuidado_item (residente_id, tarefa, horario, intervalo_dias, responsavel) values ('a0000000-0000-0000-0000-000000000001', 'SmokeP: x', '08:00', 1, 'cuidador')$q$));
select pg_temp.verifica('intervalo 366 é recusado',
  pg_temp.falha($q$insert into public.modelo_rotina_item (modelo_id, tarefa, horario, intervalo_dias) values ('d0000000-0000-4000-8000-0000000000b1', 'SmokeP: x', '08:00', 366)$q$));
insert into public.plano_cuidado_item (residente_id, tarefa, horario, intervalo_dias, responsavel)
  values ('a0000000-0000-0000-0000-000000000001', 'SmokeP: glicemia', '07:00', 7, 'enfermagem');
select pg_temp.verifica('inicio_em nasce como hoje',
  (select inicio_em = current_date from public.plano_cuidado_item where tarefa = 'SmokeP: glicemia' and ativa limit 1));

select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('aplicar modelo: pressão a cada 15 dias ≠ pressão diária (2 inseridas)',
  (select inseridas = 2 and existentes = 0 from public.aplicar_modelo_rotina(
    'd0000000-0000-4000-8000-0000000000b1', array['a0000000-0000-0000-0000-000000000001']::uuid[],
    'e0000000-0000-4000-8000-0000000000b1')));
select pg_temp.verifica('intervalo copiado ao plano',
  (select count(*) from public.plano_cuidado_item
    where residente_id = 'a0000000-0000-0000-0000-000000000001' and ativa and tarefa = 'SmokeP: pressão' and intervalo_dias = 15) = 1);
select pg_temp.verifica('reaplicar não duplica (0 inseridas, 2 existentes)',
  (select inseridas = 0 and existentes = 2 from public.aplicar_modelo_rotina(
    'd0000000-0000-4000-8000-0000000000b1', array['a0000000-0000-0000-0000-000000000001']::uuid[],
    'e0000000-0000-4000-8000-0000000000b2')));
update public.plano_cuidado_item set intervalo_dias = 30
 where residente_id = 'a0000000-0000-0000-0000-000000000001' and tarefa = 'SmokeP: pressão' and intervalo_dias = 15;
select pg_temp.verifica('coordenação muda o intervalo in-place (15 → 30)',
  (select count(*) from public.plano_cuidado_item
    where residente_id = 'a0000000-0000-0000-0000-000000000001' and ativa and tarefa = 'SmokeP: pressão' and intervalo_dias = 30) = 1);
reset role;
