-- ===========================================================================
-- SMOKE — TAREFAS AO LONGO DO TURNO (0145): coluna turno_livre no plano e no
-- modelo, regra "sem horário", aplicar modelo copiando turno_livre sem
-- duplicar, e a cuidadora registrando a execução (autoria pelo servidor).
-- Hóspede do seed: a0…0001 (Alzira). Cuidadora: Mariana.
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

-- Preparação (postgres): modelo com banho no diurno + hidratação às 10h.
insert into public.modelo_rotina (id, nome, ativo) values
 ('d0000000-0000-4000-8000-0000000000a1', 'Smoke turno livre', true)
on conflict (id) do nothing;
delete from public.modelo_rotina_item where modelo_id = 'd0000000-0000-4000-8000-0000000000a1';
insert into public.modelo_rotina_item (modelo_id, tarefa, horario, turno_livre, responsavel, tolerancia_minutos) values
 ('d0000000-0000-4000-8000-0000000000a1', 'SmokeTL: banho', null, 'diurno', 'cuidador', 0),
 ('d0000000-0000-4000-8000-0000000000a1', 'SmokeTL: banho', null, 'noturno', 'cuidador', 0),
 ('d0000000-0000-4000-8000-0000000000a1', 'SmokeTL: hidratação', '10:00', null, 'cuidador', 30);
delete from public.tarefa_registro where tarefa in (select id::text from public.plano_cuidado_item where tarefa like 'SmokeTL:%');
delete from public.plano_cuidado_item where tarefa like 'SmokeTL:%';

select pg_temp.verifica('item com turno_livre E horário é recusado (plano)',
  pg_temp.falha($q$insert into public.plano_cuidado_item (residente_id, tarefa, horario, turno_livre, responsavel) values ('a0000000-0000-0000-0000-000000000001', 'SmokeTL: x', '08:00', 'diurno', 'cuidador')$q$));
select pg_temp.verifica('item com turno_livre E horário é recusado (modelo)',
  pg_temp.falha($q$insert into public.modelo_rotina_item (modelo_id, tarefa, horario, turno_livre) values ('d0000000-0000-4000-8000-0000000000a1', 'SmokeTL: x', '08:00', 'ambos')$q$));
select pg_temp.verifica('turno_livre fora de diurno/noturno/ambos é recusado',
  pg_temp.falha($q$insert into public.plano_cuidado_item (residente_id, tarefa, turno_livre, responsavel) values ('a0000000-0000-0000-0000-000000000001', 'SmokeTL: x', 'tarde', 'cuidador')$q$));

-- Coordenação aplica o modelo duas vezes.
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('1ª aplicação: 3 tarefas (banho diurno ≠ banho noturno)',
  (select inseridas = 3 and existentes = 0 from public.aplicar_modelo_rotina(
    'd0000000-0000-4000-8000-0000000000a1', array['a0000000-0000-0000-0000-000000000001']::uuid[],
    'e0000000-0000-4000-8000-0000000000a1')));
select pg_temp.verifica('turno_livre copiado para o plano',
  (select count(*) from public.plano_cuidado_item
    where residente_id = 'a0000000-0000-0000-0000-000000000001' and ativa and tarefa = 'SmokeTL: banho'
      and horario is null and turno_livre in ('diurno','noturno')) = 2);
select pg_temp.verifica('2ª aplicação não duplica (0 inseridas, 3 existentes)',
  (select inseridas = 0 and existentes = 3 from public.aplicar_modelo_rotina(
    'd0000000-0000-4000-8000-0000000000a1', array['a0000000-0000-0000-0000-000000000001']::uuid[],
    'e0000000-0000-4000-8000-0000000000a2')));
-- Coordenação troca a hidratação de "10:00" para "ao longo do turno (ambos)".
update public.plano_cuidado_item set horario = null, turno_livre = 'ambos', tolerancia_minutos = 0
 where residente_id = 'a0000000-0000-0000-0000-000000000001' and tarefa = 'SmokeTL: hidratação' and ativa;
select pg_temp.verifica('coordenação muda o "quando" de horário fixo para ao longo do turno',
  (select turno_livre = 'ambos' and horario is null from public.plano_cuidado_item
    where residente_id = 'a0000000-0000-0000-0000-000000000001' and tarefa = 'SmokeTL: hidratação' and ativa));
reset role;

-- Cuidadora marca o banho do diurno como feito (a qualquer hora).
select pg_temp.como('mariana@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora não altera o plano',
  pg_temp.falha($q$update public.plano_cuidado_item set turno_livre = 'noturno' where tarefa = 'SmokeTL: banho' and turno_livre = 'diurno'$q$)
  or (select count(*) from public.plano_cuidado_item where tarefa = 'SmokeTL: banho' and turno_livre = 'diurno') = 1);
insert into public.tarefa_registro (residente_id, tarefa, horario, status, data, feito_por)
  select residente_id, id::text, null, 'feito', current_date, 'nome forjado'
    from public.plano_cuidado_item where tarefa = 'SmokeTL: banho' and turno_livre = 'diurno' and ativa;
reset role;
select pg_temp.verifica('registro gravado com quem fez (servidor, não o cliente) e quando',
  (select r.feito_por is not null and r.feito_por <> 'nome forjado' and r.feito_em is not null
     from public.tarefa_registro r join public.plano_cuidado_item p on p.id::text = r.tarefa
    where p.tarefa = 'SmokeTL: banho' and p.turno_livre = 'diurno'));
