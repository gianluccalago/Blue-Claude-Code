-- ===========================================================================
-- SMOKE — RONDAS NFC (0148, NTAG213). Regras de rejeição e sinalização do
-- registrar_leitura_nfc (chamado pela Edge Function com service_role),
-- cadastro de tag/tablet, checklist e permissões.
-- Quarto duplo do seed: 1206 (Otávio 1206A, Neusa 1206B). Quarto simples:
-- 1204 (Alzira). Cuidadora: Mariana.
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
delete from public.ronda_leitura;
delete from public.nfc_tags;
delete from public.devices;
delete from public.intercorrencia where observacao like 'Registrada na ronda NFC%';

select pg_temp.verifica('quarto duplo 1206 tem 2 leitos e os 2 hóspedes vinculados',
  (select count(*) from public.v_residente_leito where quarto = '1206' and status_hospede = 'ativo') = 2);

-- ── Cadastro de tags e tablet (Coordenação) ─────────────────────────────────
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('coordenação cadastra a tag do 1206 com o contador lido',
  not pg_temp.falha($q$select public.cadastrar_tag_nfc('04A1B2C3D4E5F6', '1206', 10, 'porta, lado de dentro')$q$));
select public.cadastrar_tag_nfc('04A1B2C3D4E5F7', '1204', 0);
select public.cadastrar_tag_nfc('04A1B2C3D4E5F8', '1202', 0);
select pg_temp.verifica('UID inválido é recusado no cadastro',
  pg_temp.falha($q$select public.cadastrar_tag_nfc('04A1', '1206', 0)$q$));
create temp table tok as select public.cadastrar_dispositivo('Tablet 2º andar') as t, public.cadastrar_dispositivo('Tablet antigo') as t2;
grant select on tok to authenticated, service_role;
select pg_temp.verifica('token do tablet volta uma vez e o banco guarda só o hash',
  (select length(t) = 64 from tok) and not exists (select 1 from public.devices where token_hash = (select t from tok)));
select pg_temp.verifica('tablet consulta o próprio status pelo token',
  (select (public.dispositivo_status((select t from tok)) ->> 'ativo')::boolean));
select public.revogar_dispositivo((select id from public.devices where nome = 'Tablet antigo'));
select pg_temp.verifica('tablet revogado aparece inativo', not (select (public.dispositivo_status((select t2 from tok)) ->> 'ativo')::boolean));
reset role;

select pg_temp.como('mariana@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora NÃO cadastra tag', pg_temp.falha($q$select public.cadastrar_tag_nfc('04A1B2C3D4E5F9', '1206', 0)$q$));
select pg_temp.verifica('cuidadora NÃO cadastra tablet', pg_temp.falha($q$select public.cadastrar_dispositivo('meu')$q$));
select pg_temp.verifica('cuidadora NÃO chama o registro de leitura direto (só a Edge Function)',
  pg_temp.falha($q$select public.registrar_leitura_nfc('{}'::jsonb)$q$));
select pg_temp.verifica('cuidadora NÃO insere ronda direto',
  pg_temp.falha($q$insert into public.ronda (leitura_id, residente_id, quarto_id, servidor_em) select gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', id, now() from public.quarto limit 1$q$));
reset role;

-- Helper: leitura como a Edge Function mandaria (service_role).
create or replace function pg_temp.ler(p_uid text, p_ctr int, p_tok text, p_extra jsonb default '{}') returns jsonb language plpgsql as $$
declare r jsonb; h text := encode(digest(p_tok, 'sha256'), 'hex');
begin
  execute 'set role service_role';
  r := public.registrar_leitura_nfc(jsonb_build_object(
        'email', 'mariana@blueseniorliving.com.br', 'device_token_hash', h,
        'tag_uid', p_uid, 'contador', p_ctr, 'valida', true, 'flags', '[]'::jsonb, 'implementacao', 'ntag213') || p_extra);
  execute 'reset role';
  return r;
end $$;

-- ── Rejeições ───────────────────────────────────────────────────────────────
select pg_temp.verifica('dispositivo não cadastrado → rejeitada',
  (select pg_temp.ler('04A1B2C3D4E5F6', 11, 'token-qualquer') ->> 'status') = 'rejeitada_dispositivo');
select pg_temp.verifica('dispositivo revogado → rejeitada, com flag dispositivo_revogado',
  (select r ->> 'status' = 'rejeitada_dispositivo' and r -> 'flags' ? 'dispositivo_revogado'
     from (select pg_temp.ler('04A1B2C3D4E5F6', 11, (select t2 from tok)) as r) x));
select pg_temp.verifica('UID não cadastrado → rejeitada',
  (select pg_temp.ler('04FFFFFFFFFFFF', 1, (select t from tok)) ->> 'status') = 'rejeitada_tag_desconhecida');
select pg_temp.verifica('UID divergente (validador) → rejeitada',
  (select pg_temp.ler('04A1B2C3D4E5F6', 11, (select t from tok), '{"valida":false,"motivo":"uid_divergente"}') ->> 'status') = 'rejeitada_uid_divergente');
select pg_temp.verifica('contador igual ao do cadastro (10) → contador repetido',
  (select pg_temp.ler('04A1B2C3D4E5F6', 10, (select t from tok)) ->> 'status') = 'rejeitada_contador_repetido');
select pg_temp.verifica('rejeições não mexem no último contador',
  (select last_counter = 10 from public.nfc_tags where uid = '04A1B2C3D4E5F6'));

-- ── Leitura válida no quarto duplo ──────────────────────────────────────────
create temp table l1 as select pg_temp.ler('04A1B2C3D4E5F6', 11, (select t from tok)) as r;
grant select on l1 to authenticated, service_role;
select pg_temp.verifica('contador 11 → válida, devolve o quarto 1206 e os 2 hóspedes',
  (select r ->> 'status' = 'valida' and r ->> 'quarto' = '1206' and jsonb_array_length(r -> 'residentes') = 2 from l1));
select pg_temp.verifica('uma ronda por hóspede do quarto duplo, com horário do servidor',
  (select count(*) from public.ronda where leitura_id = (select (r ->> 'leitura_id')::uuid from l1) and servidor_em is not null) = 2);
select pg_temp.verifica('último contador vira 11', (select last_counter = 11 from public.nfc_tags where uid = '04A1B2C3D4E5F6'));
select pg_temp.verifica('Mariana sem plantão escalado agora → flag sem_plantao',
  (select r -> 'flags' ? 'sem_plantao' from l1));
select pg_temp.verifica('reenvio do contador 11 → contador repetido',
  (select pg_temp.ler('04A1B2C3D4E5F6', 11, (select t from tok)) ->> 'status') = 'rejeitada_contador_repetido');

-- ── Salto de contador e plausibilidade ──────────────────────────────────────
select pg_temp.verifica('contador 15 (pulou 12–14) → válida com flag leituras_nao_registradas',
  (select r ->> 'status' = 'valida' and r -> 'flags' ? 'leituras_nao_registradas'
     from (select pg_temp.ler('04A1B2C3D4E5F6', 15, (select t from tok)) as r) x));
select pg_temp.verifica('contador 13 (menor, nunca usado) → contador menor',
  (select pg_temp.ler('04A1B2C3D4E5F6', 13, (select t from tok)) ->> 'status') = 'rejeitada_contador_menor');
select pg_temp.verifica('outro quarto segundos depois → válida com flag plausibilidade',
  (select r ->> 'status' = 'valida' and r -> 'flags' ? 'plausibilidade'
     from (select pg_temp.ler('04A1B2C3D4E5F7', 1, (select t from tok)) as r) x));

-- ── Sem número de série, offline, possível forjada ──────────────────────────
select pg_temp.verifica('sem número de série → válida com flag uid_nao_confirmado',
  (select r ->> 'status' = 'valida' and r -> 'flags' ? 'uid_nao_confirmado'
     from (select pg_temp.ler('04A1B2C3D4E5F8', 1, (select t from tok), '{"flags":["uid_nao_confirmado"]}') as r) x));
select pg_temp.verifica('leitura física com o mesmo contador → recusada (contador repetido)',
  (select pg_temp.ler('04A1B2C3D4E5F8', 1, (select t from tok)) ->> 'status') = 'rejeitada_contador_repetido');
select pg_temp.verifica('… e a leitura anterior sem número de série fica marcada possivel_forjada',
  (select 'possivel_forjada' = any(flags) from public.ronda_leitura
    where tag_uid = '04A1B2C3D4E5F8' and contador = 1 and status_validacao = 'valida'));
select pg_temp.verifica('offline sincronizado depois → válida e marcada sincronizado_tarde',
  (select r ->> 'status' = 'valida' and r -> 'flags' ? 'sincronizado_tarde'
     from (select pg_temp.ler('04A1B2C3D4E5F7', 2, (select t from tok), jsonb_build_object(
             'offline', true, 'capturado_em', '2020-01-01T03:00:00Z',
             'checklist', jsonb_build_object('a0000000-0000-0000-0000-000000000001',
                 jsonb_build_object('posicao','lateral_direita','fralda','trocada','pele','sem_alteracao','estado','dormindo','intercorrencia','nao')))) as r) x));
select pg_temp.verifica('… com o checklist enviado junto já aplicado',
  (select checklist ->> 'fralda' = 'trocada' from public.ronda r join public.ronda_leitura l on l.id = r.leitura_id
    where l.tag_uid = '04A1B2C3D4E5F7' and l.contador = 2));
select pg_temp.verifica('leitura recusada por tablet inválido também fica registrada, com a tag',
  (select count(*) from public.ronda_leitura where status_validacao = 'rejeitada_dispositivo' and tag_id is not null) >= 2);
select pg_temp.verifica('relógio do tablet guardado só como informação (horário oficial é o do servidor)',
  (select capturado_em_dispositivo < '2021-01-01' and servidor_em > '2025-01-01' from public.ronda_leitura where tag_uid = '04A1B2C3D4E5F7' and contador = 2));

-- ── Checklist online e intercorrência ───────────────────────────────────────
select pg_temp.como('mariana@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora registra o checklist da própria leitura (2 hóspedes)',
  (select public.registrar_checklist_ronda((select (r ->> 'leitura_id')::uuid from l1), jsonb_build_object(
     'a0000000-0000-0000-0000-000000000002', jsonb_build_object('posicao','dorsal','fralda','seca','pele','sem_alteracao','estado','dormindo','intercorrencia','nao'),
     'c0000000-0000-0000-0000-000000000008', jsonb_build_object('posicao','lateral_esquerda','fralda','trocada','pele','vermelhidao','estado','agitado','intercorrencia','Queda')))) = 2);
select pg_temp.verifica('intercorrência marcada no checklist vira registro de intercorrência',
  (select count(*) from public.intercorrencia where residente_id = 'c0000000-0000-0000-0000-000000000008' and tipo = 'Queda' and observacao like 'Registrada na ronda NFC do quarto 1206%') = 1);
select pg_temp.verifica('checklist não é sobrescrito',
  (select public.registrar_checklist_ronda((select (r ->> 'leitura_id')::uuid from l1), jsonb_build_object(
     'a0000000-0000-0000-0000-000000000002', jsonb_build_object('posicao','sentado')))) = 0);
select pg_temp.verifica('cuidadora vê as próprias leituras', (select count(*) from public.ronda_leitura) > 0);
reset role;

select pg_temp.como('familia@blueseniorliving.com.br');
select pg_temp.verifica('família não vê leituras', (select count(*) from public.ronda_leitura) = 0);
select pg_temp.verifica('família não vê rondas', (select count(*) from public.ronda) = 0);
select pg_temp.verifica('família não vê tablets', (select count(*) from public.devices) = 0);
reset role;

select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('coordenação vê todas as leituras, inclusive rejeitadas',
  (select count(*) filter (where status_validacao <> 'valida') > 0 and count(*) filter (where status_validacao = 'valida') > 0 from public.ronda_leitura));
select public.revisar_leitura_ronda((select id from public.ronda_leitura where 'possivel_forjada' = any(flags) limit 1), 'Conferido com a cuidadora');
select pg_temp.verifica('coordenação marca leitura sinalizada como revisada',
  (select revisada_por is not null from public.ronda_leitura where 'possivel_forjada' = any(flags) limit 1));
reset role;
