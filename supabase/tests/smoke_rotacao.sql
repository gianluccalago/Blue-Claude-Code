-- Smoke: rotação semanal de cuidadoras (0143). PASS/FAIL.
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned
create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
begin execute 'set role authenticated'; perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, false); end $$;
create or replace function pg_temp.verifica(p_nome text, p_ok boolean) returns text language sql as $$ select case when p_ok then 'PASS ' else 'FAIL ' end || p_nome $$;
create or replace function pg_temp.falha(p_sql text) returns boolean language plpgsql as $$ begin execute p_sql; return false; exception when others then return true; end $$;

-- hóspedes a0…001/002 ativos; cuidadoras beatriz (b0…?) — descobre ids
select pg_temp.como('coordenacao@blueseniorliving.com.br');
-- designação manual prévia para a0…001 com a 1ª cuidadora ativa
insert into public.designacao_cuidado (residente_id, cuidador_id, data, turno)
select 'a0000000-0000-0000-0000-000000000001', id, '2031-06-02', 'diurno' from public.usuarios where perfil='cuidador' and ativo order by id limit 1;
select pg_temp.verifica('rotação aplicada: insere e mantém a manual', (
  select (r->>'inseridas')::int = 1 and (r->>'manuais_mantidas')::int = 1
  from public.aplicar_rotacao_cuidado('2031-06-02', 'diurno', (
    select jsonb_agg(jsonb_build_object('residente_id', x.rid, 'cuidador_id', x.cid))
    from (select unnest(array['a0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002'])::uuid rid,
                 (select id from public.usuarios where perfil='cuidador' and ativo order by id desc limit 1) cid) x
  )) r));
select pg_temp.verifica('hóspede com manual não recebeu linha da rotação',
  (select count(*) from public.designacao_cuidado where data='2031-06-02' and turno='diurno' and residente_id='a0000000-0000-0000-0000-000000000001') = 1);
select pg_temp.verifica('reaplicar substitui só a rotação (idempotente)', (
  select (r->>'removidas')::int = 1 and (r->>'inseridas')::int = 1
  from public.aplicar_rotacao_cuidado('2031-06-02', 'diurno', (
    select jsonb_agg(jsonb_build_object('residente_id', 'a0000000-0000-0000-0000-000000000002', 'cuidador_id', id))
    from (select id from public.usuarios where perfil='cuidador' and ativo order by id desc limit 1) c)) r));
reset role;
select pg_temp.como('beatriz@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora não aplica rotação', pg_temp.falha($q$select public.aplicar_rotacao_cuidado('2031-06-02','diurno','[]'::jsonb)$q$));
reset role;
select pg_temp.como('familia@blueseniorliving.com.br');
select pg_temp.verifica('família não aplica rotação', pg_temp.falha($q$select public.aplicar_rotacao_cuidado('2031-06-02','diurno','[]'::jsonb)$q$));
reset role;

-- ── 0144: plano congelado ──────────────────────────────────────────────────
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('congela o plano na 1ª vez', (select (r->>'novo')::boolean from public.congelar_rotacao_semana('2031-06-02','diurno','[{"cuidador_id":"x"}]'::jsonb) r));
select pg_temp.verifica('2ª vez devolve o plano gravado sem substituir', (select (r->>'novo')::boolean = false and r->'plano'->0->>'cuidador_id' = 'x' from public.congelar_rotacao_semana('2031-06-02','diurno','[{"cuidador_id":"y"}]'::jsonb) r));
select pg_temp.verifica('recalcular substitui', (select r->'plano'->0->>'cuidador_id' = 'y' from public.congelar_rotacao_semana('2031-06-02','diurno','[{"cuidador_id":"y"}]'::jsonb, true) r));
reset role;
select pg_temp.como('beatriz@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora lê o plano da semana', (select count(*) from public.rotacao_semana where semana='2031-06-02') = 1);
select pg_temp.verifica('cuidadora não grava o plano', pg_temp.falha($q$select public.congelar_rotacao_semana('2031-06-02','noturno','[]'::jsonb)$q$));
reset role;
