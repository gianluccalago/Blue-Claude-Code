-- ===========================================================================
-- SMOKE DA FARMÁCIA (0139) — roda num banco descartável recém-migrado
-- (scripts/db-check.sh). Cada linha imprime PASS ou FAIL. Usa o usuário
-- farmacia@ e o hóspede a0000000-…-0001 do seed (dados fictícios).
-- Cobre: dose 0,5 (dispensar/estornar), dispensação repetida (ja_existia +
-- índice único), ajuste de provisionamento (delta no saldo), livro de
-- controlados (autoria no servidor, estorno único, cadeia íntegra) e baixa
-- de viagem atômica (duas sessões disputando o mesmo saldo, via dblink).
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
  select case when coalesce(p_ok, false) then 'PASS ' else 'FAIL ' end || p_nome $$;
-- Executa um comando e devolve TRUE se ele FALHOU (esperado quando o servidor deve barrar).
create or replace function pg_temp.falha(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
-- Saldo do hóspede do seed para um medicamento no mês corrente.
create or replace function pg_temp.saldo(p_med text) returns numeric language sql as $$
  select quantidade_atual from public.estoque_hospede
   where residente_id = 'a0000000-0000-0000-0000-000000000001' and medicamento = p_med
     and mes_referencia = to_char(current_date, 'YYYY-MM') $$;

-- ── Preparação (como postgres): estoque limpo do mês corrente ──────────────
delete from public.dispensacao where residente_id = 'a0000000-0000-0000-0000-000000000001' and data = current_date;
delete from public.baixa_viagem where residente_id = 'a0000000-0000-0000-0000-000000000001';
delete from public.estoque_hospede
 where residente_id = 'a0000000-0000-0000-0000-000000000001' and mes_referencia = to_char(current_date, 'YYYY-MM');
insert into public.estoque_hospede (residente_id, medicamento, mes_referencia, quantidade_provisionada, quantidade_atual, unidade)
values ('a0000000-0000-0000-0000-000000000001', 'SMOKE MED', to_char(current_date, 'YYYY-MM'), 30, 30, 'comprimido');

-- ── 1 · Dose fracionada + dispensação repetida ─────────────────────────────
select pg_temp.como('farmacia@blueseniorliving.com.br');
create temp table smoke_disp as
  select * from public.dispensar_medicamentos('a0000000-0000-0000-0000-000000000001', 'manha', current_date,
    '[{"medicamento":"SMOKE MED","quantidade":0.5,"unidade":"comprimido"}]'::jsonb, 'Nome Forjado');
select pg_temp.verifica('dispensar 0,5 baixa 0,5 do saldo', pg_temp.saldo('SMOKE MED') = 29.5);
select pg_temp.verifica('1ª dispensação devolve ja_existia = false', (select not ja_existia from smoke_disp));
select pg_temp.verifica('autoria da dispensação vem do servidor',
  (select dispensado_por from public.dispensacao where id = (select id from smoke_disp)) = 'Lucas Pereira');
create temp table smoke_disp2 as
  select * from public.dispensar_medicamentos('a0000000-0000-0000-0000-000000000001', 'manha', current_date,
    '[{"medicamento":"SMOKE MED","quantidade":0.5,"unidade":"comprimido"}]'::jsonb, null);
select pg_temp.verifica('2ª dispensação devolve ja_existia = true e o mesmo id',
  (select ja_existia from smoke_disp2) and (select id from smoke_disp2) = (select id from smoke_disp));
select pg_temp.verifica('2ª dispensação NÃO baixa de novo', pg_temp.saldo('SMOKE MED') = 29.5);
select pg_temp.verifica('insert direto em dobro é recusado (índice único)', pg_temp.falha($q$
  insert into public.dispensacao (residente_id, periodo, data, itens)
  values ('a0000000-0000-0000-0000-000000000001', 'manha', current_date, '[]'::jsonb)$q$));
select public.estornar_dispensacao((select id from smoke_disp));
select pg_temp.verifica('estornar devolve 0,5 ao saldo', pg_temp.saldo('SMOKE MED') = 30);
select pg_temp.verifica('estorno remove o registro',
  (select count(*) from public.dispensacao where residente_id = 'a0000000-0000-0000-0000-000000000001' and data = current_date and periodo = 'manha') = 0);
select public.estornar_dispensacao((select id from smoke_disp));
select pg_temp.verifica('estornar de novo não devolve em dobro', pg_temp.saldo('SMOKE MED') = 30);
reset role;

-- ── 2 · Ajuste de provisionamento soma o delta ao saldo ────────────────────
update public.estoque_hospede set quantidade_atual = 20
 where residente_id = 'a0000000-0000-0000-0000-000000000001' and medicamento = 'SMOKE MED'
   and mes_referencia = to_char(current_date, 'YYYY-MM');
select pg_temp.verifica('gravar o saldo de propósito não é alterado pelo trigger', pg_temp.saldo('SMOKE MED') = 20);
select pg_temp.como('farmacia@blueseniorliving.com.br');
select public.provisionar_estoque_hospede('a0000000-0000-0000-0000-000000000001', to_char(current_date, 'YYYY-MM'),
  '[{"medicamento":"SMOKE MED","quantidade_provisionada":60,"unidade":"comprimido"},
    {"medicamento":"SMOKE NOVO","quantidade_provisionada":15.5,"unidade":"comprimido"}]'::jsonb);
select pg_temp.verifica('30 provisionado / 20 saldo → ajusta para 60 → saldo 50', pg_temp.saldo('SMOKE MED') = 50);
select pg_temp.verifica('item novo nasce com saldo = provisionado (aceita 15,5)', pg_temp.saldo('SMOKE NOVO') = 15.5);
update public.estoque_hospede set quantidade_provisionada = 40
 where residente_id = 'a0000000-0000-0000-0000-000000000001' and medicamento = 'SMOKE MED'
   and mes_referencia = to_char(current_date, 'YYYY-MM');
select pg_temp.verifica('update direto do provisionado (60→40) também ajusta o saldo (50→30)', pg_temp.saldo('SMOKE MED') = 30);
select pg_temp.verifica('provisionado negativo é recusado', pg_temp.falha($q$
  select public.provisionar_estoque_hospede('a0000000-0000-0000-0000-000000000001', to_char(current_date, 'YYYY-MM'),
    '[{"medicamento":"SMOKE MED","quantidade_provisionada":-1}]'::jsonb)$q$));
reset role;

-- ── 3 · Livro de controlados: autoria no servidor + estorno único ──────────
select pg_temp.como('farmacia@blueseniorliving.com.br');
create temp table smoke_livro (numero bigint);
insert into smoke_livro select public.registrar_assento_controlado(
  'a0000000-0000-0000-0000-000000000001', 'Smoke Controlado', 'entrada', 10, 'comprimido', null, null, 'Nome Forjado');
select pg_temp.verifica('assento lançado',
  (select count(*) from public.livro_controlados where numero = (select numero from smoke_livro)) = 1);
select pg_temp.verifica('autoria do assento vem do servidor (ignora p_registrado_por)',
  (select registrado_por from public.livro_controlados where numero = (select numero from smoke_livro)) = 'Lucas Pereira');
select pg_temp.verifica('assento sem p_registrado_por também lança (parâmetro opcional)',
  (select public.registrar_assento_controlado(null, 'Smoke Controlado', 'dispensacao', 0.5, 'comprimido', null, null)) > 0);
select pg_temp.verifica('estorno do assento é aceito',
  (select public.registrar_assento_controlado('a0000000-0000-0000-0000-000000000001', 'Smoke Controlado', 'estorno',
     10, 'comprimido', 'lançado em duplicidade', (select numero from smoke_livro))) > 0);
select pg_temp.verifica('estorno DUPLO do mesmo assento é recusado (RPC)', pg_temp.falha($q$
  select public.registrar_assento_controlado('a0000000-0000-0000-0000-000000000001', 'Smoke Controlado', 'estorno',
    10, 'comprimido', 'de novo', (select numero from smoke_livro))$q$));
select pg_temp.verifica('estornar um estorno é recusado', pg_temp.falha($q$
  select public.registrar_assento_controlado(null, 'Smoke Controlado', 'estorno', 10, 'comprimido', 'x',
    (select max(numero) from public.livro_controlados where tipo_assento = 'estorno'))$q$));
select pg_temp.verifica('livro continua íntegro após inserir e estornar',
  (select integro from public.verificar_livro_controlados()));
reset role;
select pg_temp.verifica('estorno duplo direto na tabela é recusado (índice único parcial)', pg_temp.falha($q$
  insert into public.livro_controlados (numero, medicamento, tipo_assento, quantidade, referencia_numero,
    registrado_por, perfil_registrador, hash)
  values (nextval('public.livro_controlados_numero_seq'), 'SMOKE CONTROLADO', 'estorno', 10,
    (select numero from smoke_livro), 'x', 'farmacia', 'x')$q$));
select pg_temp.como('beatriz@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora não lança no livro', pg_temp.falha($q$
  select public.registrar_assento_controlado(null, 'Smoke Controlado', 'entrada', 1, 'comprimido', null, null)$q$));
reset role;

-- ── 4 · Baixa de viagem atômica (duas sessões disputando o saldo) ──────────
update public.estoque_hospede set quantidade_atual = 10
 where residente_id = 'a0000000-0000-0000-0000-000000000001' and medicamento = 'SMOKE MED'
   and mes_referencia = to_char(current_date, 'YYYY-MM');
-- Sessão B (dblink, assíncrona): baixa 6 e segura a transação por 2 s.
create extension if not exists dblink;
select dblink_connect('smoke_b', format('host=%s port=%s dbname=%s user=%s',
  btrim(split_part(current_setting('unix_socket_directories'), ',', 1)),
  current_setting('port'), current_database(), current_user));
select dblink_send_query('smoke_b', $b$
  do $$ begin
    set local role authenticated;
    perform set_config('request.jwt.claims', '{"email":"farmacia@blueseniorliving.com.br","role":"authenticated"}', true);
    perform public.registrar_baixa_viagem('a0000000-0000-0000-0000-000000000001', to_char(current_date, 'YYYY-MM'),
      3, current_date, '[{"medicamento":"SMOKE MED","quantidade":6,"unidade":"comprimido"}]'::jsonb, 'sessão B');
    perform pg_sleep(2);
  end $$;
$b$);
select pg_sleep(0.5);
-- Sessão A (esta): tenta baixar mais 6 enquanto B segura a linha → espera e é recusada (10 − 6 − 6 < 0).
select pg_temp.como('farmacia@blueseniorliving.com.br');
select pg_temp.verifica('viagem concorrente: 2ª baixa espera a 1ª e é recusada por saldo negativo', pg_temp.falha($q$
  select public.registrar_baixa_viagem('a0000000-0000-0000-0000-000000000001', to_char(current_date, 'YYYY-MM'),
    3, current_date, '[{"medicamento":"SMOKE MED","quantidade":6,"unidade":"comprimido"}]'::jsonb, 'sessão A')$q$));
reset role;
select count(*) from dblink_get_result('smoke_b') as t(r text);
select dblink_disconnect('smoke_b');
select pg_temp.verifica('viagem concorrente: saldo final = 10 − 6 = 4 (sem lost update)', pg_temp.saldo('SMOKE MED') = 4);
select pg_temp.verifica('baixa recusada não deixa registro de viagem',
  (select count(*) from public.baixa_viagem where residente_id = 'a0000000-0000-0000-0000-000000000001' and not estornado) = 1);

select pg_temp.como('farmacia@blueseniorliving.com.br');
create temp table smoke_viagem as
  select public.registrar_baixa_viagem('a0000000-0000-0000-0000-000000000001', to_char(current_date, 'YYYY-MM'),
    3, current_date, '[{"medicamento":"SMOKE MED","quantidade":6,"unidade":"comprimido"}]'::jsonb, 'confirmada', true) as id;
select pg_temp.verifica('com confirmação explícita a baixa deixa saldo negativo (4 − 6 = −2)', pg_temp.saldo('SMOKE MED') = -2);
select pg_temp.verifica('baixa sem provisionamento é recusada sem confirmação', pg_temp.falha($q$
  select public.registrar_baixa_viagem('a0000000-0000-0000-0000-000000000001', to_char(current_date, 'YYYY-MM'),
    3, current_date, '[{"medicamento":"SMOKE INEXISTENTE","quantidade":1,"unidade":"comprimido"}]'::jsonb)$q$));
select public.estornar_baixa_viagem((select id from smoke_viagem));
select pg_temp.verifica('estorno da viagem devolve o saldo (−2 + 6 = 4)', pg_temp.saldo('SMOKE MED') = 4);
select pg_temp.verifica('estorno da viagem grava quem estornou (servidor)',
  (select estornado_por from public.baixa_viagem where id = (select id from smoke_viagem)) = 'Lucas Pereira');
select pg_temp.verifica('estorno DUPLO da viagem é recusado', pg_temp.falha($q$
  select public.estornar_baixa_viagem((select id from smoke_viagem))$q$));
select pg_temp.verifica('estorno duplo não devolve em dobro', pg_temp.saldo('SMOKE MED') = 4);
reset role;
select pg_temp.como('beatriz@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora não registra baixa de viagem (RLS)', pg_temp.falha($q$
  select public.registrar_baixa_viagem('a0000000-0000-0000-0000-000000000001', to_char(current_date, 'YYYY-MM'),
    1, current_date, '[{"medicamento":"SMOKE MED","quantidade":1,"unidade":"comprimido"}]'::jsonb, null, true)$q$));
reset role;

-- ── Limpeza ────────────────────────────────────────────────────────────────
delete from public.baixa_viagem where residente_id = 'a0000000-0000-0000-0000-000000000001';
delete from public.estoque_hospede
 where residente_id = 'a0000000-0000-0000-0000-000000000001' and medicamento like 'SMOKE %';
