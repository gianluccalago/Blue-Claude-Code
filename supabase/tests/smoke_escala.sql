-- ===========================================================================
-- SMOKE — ESCALAS E PONTO (migration 0140). Roda num banco descartável
-- recém-migrado (scripts/db-check.sh), depois do rls_smoke.sql. Cada linha
-- imprime PASS ou FAIL. Usa as profissionais do seed: Beatriz (b0…011,
-- cuidadora PJ), Ana Paula (b0…004), Joana (b0…010, INATIVA) e a coordenação.
-- ===========================================================================
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

-- Preparação (como postgres). O rls_smoke inativa a Beatriz no fim: reativa.
update public.usuarios set ativo = true where email = 'beatriz@blueseniorliving.com.br';
delete from public.turnos where data between date '2031-03-01' and date '2031-03-10';
insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag) values
 ('e5c00000-0000-4000-8000-000000000001','b0000000-0000-0000-0000-000000000011','cuidadoras','2031-03-03',
   '2031-03-03 07:00-03','2031-03-03 19:00-03','diurno'),
 ('e5c00000-0000-4000-8000-000000000002','b0000000-0000-0000-0000-000000000004','cuidadoras','2031-03-03',
   '2031-03-03 07:00-03','2031-03-03 19:00-03','diurno'),
 ('e5c00000-0000-4000-8000-000000000003','b0000000-0000-0000-0000-000000000011','cuidadoras','2031-03-05',
   '2031-03-05 19:00-03','2031-03-06 07:00-03','noturno');

create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
begin
  execute 'set role authenticated';
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, false);
end $$;
create or replace function pg_temp.verifica(p_nome text, p_ok boolean) returns text language sql as $$
  select case when p_ok then 'PASS ' else 'FAIL ' end || p_nome $$;
-- Executa um comando e devolve TRUE se ele FALHOU (esperado quando a RLS/trigger deve barrar).
create or replace function pg_temp.falha(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;

-- ── 1 · Integridade da escala (coordenação) ────────────────────────────────
-- Joana (b0…010) precisa estar INATIVA para os casos de profissional inativa (como postgres).
update public.usuarios set ativo = false where id = 'b0000000-0000-0000-0000-000000000010';
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('extensão btree_gist instalada', exists (select 1 from pg_extension where extname = 'btree_gist'));
select pg_temp.verifica('constraint de exclusão existe', exists (select 1 from pg_constraint where conname = 'turnos_sem_sobreposicao'));
select pg_temp.verifica('fim antes do início é recusado',
  pg_temp.falha($q$insert into public.turnos (profissional_id, categoria, data, inicio, fim, tag) values
    ('b0000000-0000-0000-0000-000000000011','cuidadoras','2031-03-04','2031-03-04 19:00-03','2031-03-04 07:00-03','diurno')$q$));
select pg_temp.verifica('fim igual ao início é recusado',
  pg_temp.falha($q$insert into public.turnos (profissional_id, categoria, data, inicio, fim, tag) values
    ('b0000000-0000-0000-0000-000000000011','cuidadoras','2031-03-04','2031-03-04 07:00-03','2031-03-04 07:00-03','diurno')$q$));
select pg_temp.verifica('sobreposição da mesma profissional é recusada (parcial)',
  pg_temp.falha($q$insert into public.turnos (profissional_id, categoria, data, inicio, fim, tag) values
    ('b0000000-0000-0000-0000-000000000011','enfermeiras','2031-03-03','2031-03-03 12:00-03','2031-03-03 20:00-03','diurno')$q$));
select pg_temp.verifica('sobreposição noturno × diurno do dia seguinte é recusada',
  pg_temp.falha($q$insert into public.turnos (profissional_id, categoria, data, inicio, fim, tag) values
    ('b0000000-0000-0000-0000-000000000011','cuidadoras','2031-03-06','2031-03-06 06:00-03','2031-03-06 18:00-03','diurno')$q$));
select pg_temp.verifica('turno encostado (19:00 → 19:00) é aceito',
  not pg_temp.falha($q$insert into public.turnos (id, profissional_id, categoria, data, inicio, fim, tag) values
    ('e5c00000-0000-4000-8000-000000000004','b0000000-0000-0000-0000-000000000011','cuidadoras','2031-03-03','2031-03-03 19:00-03','2031-03-04 07:00-03','noturno')$q$));
select pg_temp.verifica('dois turnos VAGOS no mesmo horário são aceitos',
  not pg_temp.falha($q$insert into public.turnos (profissional_id, categoria, data, inicio, fim, tag) values
    (null,'cuidadoras','2031-03-07','2031-03-07 07:00-03','2031-03-07 19:00-03','diurno'),
    (null,'cuidadoras','2031-03-07','2031-03-07 07:00-03','2031-03-07 19:00-03','diurno')$q$));
select pg_temp.verifica('editar turno para cima de outro da mesma profissional é recusado',
  pg_temp.falha($q$update public.turnos set inicio = '2031-03-03 10:00-03', fim = '2031-03-03 22:00-03'
    where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
-- ── 5 · Profissional inativa ────────────────────────────────────────────────
select pg_temp.verifica('designar profissional INATIVA é recusado (insert)',
  pg_temp.falha($q$insert into public.turnos (profissional_id, categoria, data, inicio, fim, tag) values
    ('b0000000-0000-0000-0000-000000000010','cuidadoras','2031-03-08','2031-03-08 07:00-03','2031-03-08 19:00-03','diurno')$q$));
select pg_temp.verifica('trocar para profissional INATIVA é recusado (update)',
  pg_temp.falha($q$update public.turnos set profissional_id = 'b0000000-0000-0000-0000-000000000010'
    where id = 'e5c00000-0000-4000-8000-000000000002'$q$));
select pg_temp.verifica('trocar para profissional ativa é aceito',
  not pg_temp.falha($q$update public.turnos set profissional_id = 'b0000000-0000-0000-0000-000000000009'
    where id = 'e5c00000-0000-4000-8000-000000000002'$q$));
update public.turnos set profissional_id = 'b0000000-0000-0000-0000-000000000004' where id = 'e5c00000-0000-4000-8000-000000000002';
reset role;

-- ── 3 · Ponto pela própria profissional (Beatriz) ──────────────────────────
select pg_temp.como('beatriz@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora: app_usuario_id resolvido', public.app_usuario_id() = 'b0000000-0000-0000-0000-000000000011');
select pg_temp.verifica('cuidadora não altera o INÍCIO do próprio turno',
  pg_temp.falha($q$update public.turnos set inicio = '2031-03-03 08:00-03' where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
select pg_temp.verifica('cuidadora não muda a profissional do próprio turno',
  pg_temp.falha($q$update public.turnos set profissional_id = 'b0000000-0000-0000-0000-000000000004' where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
select pg_temp.verifica('cuidadora não se marca como "ajuste manual"',
  pg_temp.falha($q$update public.turnos set check_in = now(), check_in_manual = true where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
select pg_temp.verifica('cuidadora não bate saída antes da entrada',
  pg_temp.falha($q$update public.turnos set check_out = now() where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
-- Ponto no turno de OUTRA: a RLS não devolve a linha (0 linhas, sem erro) — o check_in fica nulo.
update public.turnos set check_in = now() where id = 'e5c00000-0000-4000-8000-000000000002';
select pg_temp.verifica('cuidadora não bate ponto no turno de outra',
  (select check_in is null from public.turnos where id = 'e5c00000-0000-4000-8000-000000000002') is not false);
update public.turnos set check_in = '2031-03-03 07:02-03', check_in_lat = null, check_in_lng = null, check_in_sem_gps = true
  where id = 'e5c00000-0000-4000-8000-000000000001';
select pg_temp.verifica('cuidadora bate entrada no próprio turno (sem GPS, marcado)',
  (select check_in is not null and check_in_sem_gps from public.turnos where id = 'e5c00000-0000-4000-8000-000000000001'));
select pg_temp.verifica('cuidadora não REABRE a entrada (check_in já preenchido)',
  pg_temp.falha($q$update public.turnos set check_in = '2031-03-03 07:30-03' where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
select pg_temp.verifica('cuidadora não apaga a entrada',
  pg_temp.falha($q$update public.turnos set check_in = null where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
select pg_temp.verifica('cuidadora não troca a localização depois da entrada',
  pg_temp.falha($q$update public.turnos set check_in_lat = -25.4, check_in_lng = -49.3 where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
update public.turnos set check_out = '2031-03-03 19:01-03', check_out_lat = -25.449, check_out_lng = -49.333
  where id = 'e5c00000-0000-4000-8000-000000000001';
select pg_temp.verifica('cuidadora bate saída no próprio turno',
  (select check_out is not null from public.turnos where id = 'e5c00000-0000-4000-8000-000000000001'));
select pg_temp.verifica('cuidadora não REABRE a saída (check_out já preenchido)',
  pg_temp.falha($q$update public.turnos set check_out = '2031-03-03 19:30-03' where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
select pg_temp.verifica('cuidadora não apaga a saída',
  pg_temp.falha($q$update public.turnos set check_out = null where id = 'e5c00000-0000-4000-8000-000000000001'$q$));
select pg_temp.verifica('ponto da cuidadora NÃO gera rastro de ajuste',
  (select count(*) from public.turno_ajuste where turno_id = 'e5c00000-0000-4000-8000-000000000001') = 0);
select pg_temp.verifica('cuidadora não insere rastro à mão',
  pg_temp.falha($q$insert into public.turno_ajuste (turno_id, campo) values ('e5c00000-0000-4000-8000-000000000001','check_in')$q$));
reset role;

-- ── 3c · Ajuste manual pela coordenação: rastro ─────────────────────────────
select pg_temp.como('coordenacao@blueseniorliving.com.br');
update public.turnos set check_in = '2031-03-03 07:00-03', check_in_manual = true, ajuste_motivo = 'GPS falhou (smoke)'
  where id = 'e5c00000-0000-4000-8000-000000000001';
select pg_temp.verifica('coordenação ajusta a entrada já registrada',
  (select check_in = '2031-03-03 07:00-03'::timestamptz from public.turnos where id = 'e5c00000-0000-4000-8000-000000000001'));
select pg_temp.verifica('ajuste gera rastro com valor anterior e novo',
  exists (select 1 from public.turno_ajuste
           where turno_id = 'e5c00000-0000-4000-8000-000000000001' and campo = 'check_in'
             and de::timestamptz = '2031-03-03 07:02-03' and para::timestamptz = '2031-03-03 07:00-03'));
select pg_temp.verifica('rastro guarda o motivo',
  exists (select 1 from public.turno_ajuste where turno_id = 'e5c00000-0000-4000-8000-000000000001' and motivo = 'GPS falhou (smoke)'));
select pg_temp.verifica('autoria do rastro vem do servidor (nome de usuarios)',
  (select ajustado_por from public.turno_ajuste where turno_id = 'e5c00000-0000-4000-8000-000000000001' order by ajustado_em desc limit 1) = 'Patrícia Antunes');
select pg_temp.verifica('motivo transitório não fica gravado no turno',
  (select ajuste_motivo is null from public.turnos where id = 'e5c00000-0000-4000-8000-000000000001'));
update public.turnos set check_out = '2031-03-03 19:00-03', check_out_manual = true where id = 'e5c00000-0000-4000-8000-000000000001';
select pg_temp.verifica('ajuste de saída também deixa rastro',
  exists (select 1 from public.turno_ajuste where turno_id = 'e5c00000-0000-4000-8000-000000000001' and campo = 'check_out'));
-- Turno já iniciado: mexer na escala deixa rastro.
update public.turnos set inicio = '2031-03-03 06:30-03' where id = 'e5c00000-0000-4000-8000-000000000001';
select pg_temp.verifica('alterar escala de turno já iniciado deixa rastro',
  exists (select 1 from public.turno_ajuste where turno_id = 'e5c00000-0000-4000-8000-000000000001' and campo = 'inicio'
            and de::timestamptz = '2031-03-03 07:00-03' and para::timestamptz = '2031-03-03 06:30-03'));
-- Turno NÃO iniciado: editar a escala não gera rastro (é edição normal).
update public.turnos set fim = '2031-03-03 20:00-03' where id = 'e5c00000-0000-4000-8000-000000000002';
select pg_temp.verifica('editar turno não iniciado não gera rastro',
  (select count(*) from public.turno_ajuste where turno_id = 'e5c00000-0000-4000-8000-000000000002') = 0);
select pg_temp.verifica('coordenação não altera o rastro',
  pg_temp.falha($q$update public.turno_ajuste set motivo = 'x' where turno_id = 'e5c00000-0000-4000-8000-000000000001'$q$)
  or (select count(*) from public.turno_ajuste where motivo = 'x') = 0);
reset role;

-- ── Leitura do rastro ───────────────────────────────────────────────────────
select pg_temp.como('beatriz@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora lê o rastro do próprio turno',
  (select count(*) from public.turno_ajuste where turno_id = 'e5c00000-0000-4000-8000-000000000001') > 0);
reset role;
select pg_temp.como('anapaula@blueseniorliving.com.br');
select pg_temp.verifica('outra cuidadora não lê o rastro alheio',
  (select count(*) from public.turno_ajuste where turno_id = 'e5c00000-0000-4000-8000-000000000001') = 0);
reset role;

-- Limpeza
delete from public.turnos where data between date '2031-03-01' and date '2031-03-10';
