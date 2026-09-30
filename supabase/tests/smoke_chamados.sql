-- ===========================================================================
-- SMOKE — CHAMADOS (0149): eventos da central, dedupe, soma de toques,
-- escalada para emergência, fechamento SÓ com presença (etiqueta NFC ou botão
-- de presença), encerramento excepcional, simulação e permissões.
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
create or replace function pg_temp.q(p_cod text) returns uuid language sql as $$ select id from public.quarto where codigo = p_cod $$;
create or replace function pg_temp.aberto(p_cod text) returns public.chamado language sql as $$
  select * from public.chamado where quarto_id = pg_temp.q(p_cod) and status = 'aberto' $$;

delete from public.chamado_evento; delete from public.chamado; delete from public.chamado_dispositivo; delete from public.chamado_central;
delete from public.ronda_leitura where tag_uid like '04C0FFEE%';
delete from public.nfc_tags where uid like '04C0FFEE%';
delete from public.devices where nome = 'Tablet chamados';

select pg_temp.verifica('Módulo 5 cadastrado: 19 + 20 suítes com leito A',
  (select count(*) from public.quarto where modulo = 5 and andar = 1) = 19
  and (select count(*) from public.quarto where modulo = 5 and andar = 2) = 20
  and (select count(*) from public.leito l join public.quarto q on q.id = l.quarto_id where q.modulo = 5) = 39);

-- ── Cadastro (Coordenação) ──────────────────────────────────────────────────
select pg_temp.como('coordenacao@blueseniorliving.com.br');
create temp table tk as select public.cadastrar_central_chamado('Central teste') as t;
grant select on tk to authenticated, service_role;
select public.cadastrar_dispositivo_chamado('BTN-5106', '5106', 'botao', 'cabeceira');
select public.cadastrar_dispositivo_chamado('CRD-5106', '5106', 'corda', 'banheiro');
select public.cadastrar_dispositivo_chamado('PRS-5106', '5106', 'presenca', 'porta');
select public.cadastrar_dispositivo_chamado('BTN-5214', '5214', 'botao', 'cabeceira');
select pg_temp.verifica('token da central volta uma vez; banco guarda só o hash',
  (select length(t) = 64 from tk) and not exists (select 1 from public.chamado_central where token_hash = (select t from tk)));
select pg_temp.verifica('suíte inexistente é recusada no cadastro de aparelho',
  pg_temp.falha($q$select public.cadastrar_dispositivo_chamado('X', '5999', 'botao')$q$));
reset role;
select pg_temp.como('mariana@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora não cadastra aparelho', pg_temp.falha($q$select public.cadastrar_dispositivo_chamado('Y', '5106', 'botao')$q$));
select pg_temp.verifica('cuidadora não chama o registro de evento direto', pg_temp.falha($q$select public.registrar_evento_chamado('{}'::jsonb)$q$));
reset role;

create or replace function pg_temp.evento(p_disp text, p_id text, p_tipo text default 'acionamento', p_tok text default null) returns jsonb language plpgsql as $$
declare r jsonb; h text := encode(digest(coalesce(p_tok, (select t from tk)), 'sha256'), 'hex');
begin
  execute 'set role service_role';
  r := public.registrar_evento_chamado(jsonb_build_object('central_token_hash', h, 'evento_id', p_id, 'dispositivo', p_disp, 'tipo', p_tipo));
  execute 'reset role';
  return r;
end $$;

-- ── Eventos ─────────────────────────────────────────────────────────────────
select pg_temp.verifica('central com token errado é recusada', (select pg_temp.evento('BTN-5106', 'e0', 'acionamento', 'errado') ->> 'resultado') = 'central_invalida');
select pg_temp.verifica('sinal de vida atualiza o último sinal', (select pg_temp.evento(null, null, 'sinal') ->> 'resultado') = 'sinal');
select pg_temp.verifica('… e grava o horário do sinal', (select ultimo_sinal_em is not null from public.chamado_central));
select pg_temp.verifica('botão abre CHAMADO (amarelo) na 5106', (select pg_temp.evento('BTN-5106', 'e1') ->> 'resultado') = 'acionado');
select pg_temp.verifica('… um chamado aberto, tipo chamado, origem botão', (select tipo = 'chamado' and origem = 'botao' from pg_temp.aberto('5106')));
select pg_temp.verifica('mesmo evento reenviado → duplicado, sem somar', (select pg_temp.evento('BTN-5106', 'e1') ->> 'resultado') = 'duplicado');
select pg_temp.evento('BTN-5106', 'e2');
select pg_temp.verifica('novo toque soma no mesmo chamado (2 acionamentos)', (select acionamentos = 2 from pg_temp.aberto('5106')));
select pg_temp.evento('CRD-5106', 'e3');
select pg_temp.verifica('corda eleva para EMERGÊNCIA (vermelho) e marca a escalada',
  (select tipo = 'emergencia' and escalado_em is not null and origem = 'corda' from pg_temp.aberto('5106')));
select pg_temp.evento('BTN-5106', 'e4');
select pg_temp.verifica('botão depois da corda não rebaixa a emergência', (select tipo = 'emergencia' and acionamentos = 4 from pg_temp.aberto('5106')));
select pg_temp.verifica('um único chamado aberto por suíte', (select count(*) from public.chamado where quarto_id = pg_temp.q('5106') and status = 'aberto') = 1);
select pg_temp.verifica('aparelho desconhecido não abre chamado',
  (select pg_temp.evento('XYZ', 'e5') ->> 'resultado') = 'dispositivo_desconhecido');
select pg_temp.verifica('… mas fica registrado no log de eventos',
  (select count(*) from public.chamado_evento where dispositivo_codigo = 'XYZ') = 1);

-- ── Equipe: "estou indo" não apaga; só presença fecha ───────────────────────
select pg_temp.como('mariana@blueseniorliving.com.br');
select public.reconhecer_chamado((select id from pg_temp.aberto('5106')));
select pg_temp.verifica('cuidadora vê o chamado', (select count(*) from public.chamado where status = 'aberto') >= 1);
select pg_temp.verifica('"estou indo" registra quem, e o chamado continua aberto',
  (select reconhecido_por = 'Mariana Souza' and status = 'aberto' from pg_temp.aberto('5106')));
select pg_temp.verifica('cuidadora não encerra sem presença', pg_temp.falha($q$select public.encerrar_chamado_excepcional((select id from pg_temp.aberto('5106')), 'motivo qualquer longo')$q$));
select pg_temp.verifica('cuidadora não simula chamado', pg_temp.falha($q$select public.simular_chamado('5106', 'chamado')$q$));
select pg_temp.verifica('cuidadora não altera chamado direto', pg_temp.falha($q$update public.chamado set status = 'atendido'$q$)
  or (select count(*) from public.chamado where status = 'aberto') >= 1);
reset role;

-- Etiqueta NFC da 5106 e tablet (0148).
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select public.cadastrar_tag_nfc('04C0FFEE000106', '5106', 0);
select public.cadastrar_tag_nfc('04C0FFEE000214', '5214', 0);
create temp table tab as select public.cadastrar_dispositivo('Tablet chamados') as t;
grant select on tab to authenticated, service_role;
reset role;
create or replace function pg_temp.ler(p_uid text, p_ctr int, p_extra jsonb default '{}') returns jsonb language plpgsql as $$
declare r jsonb; h text := encode(digest((select t from tab), 'sha256'), 'hex');
begin
  execute 'set role service_role';
  r := public.registrar_leitura_nfc(jsonb_build_object('email', 'mariana@blueseniorliving.com.br', 'device_token_hash', h,
        'tag_uid', p_uid, 'contador', p_ctr, 'valida', true, 'flags', '[]'::jsonb) || p_extra);
  execute 'reset role';
  return r;
end $$;

select pg_temp.verifica('etiqueta de OUTRA suíte não fecha a 5106',
  (select pg_temp.ler('04C0FFEE000214', 1) ->> 'status') = 'valida' and (select count(*) from pg_temp.aberto('5106')) = 1);
select pg_temp.verifica('leitura válida da etiqueta da 5106 fecha: atendido via NFC por quem leu',
  (select pg_temp.ler('04C0FFEE000106', 1) ->> 'status') = 'valida');
select pg_temp.verifica('… status atendido, atendimento_via nfc, atendido_por Mariana, com a leitura vinculada',
  (select status = 'atendido' and atendimento_via = 'nfc' and atendido_por = 'Mariana Souza' and leitura_id is not null
     from public.chamado where quarto_id = pg_temp.q('5106') order by aberto_em desc limit 1));

select pg_temp.evento('BTN-5214', 'e6');
select pg_temp.verifica('leitura SINCRONIZADA TARDE (offline) não fecha chamado',
  (select pg_temp.ler('04C0FFEE000214', 2, '{"offline": true}') ->> 'status') = 'valida' and (select count(*) from pg_temp.aberto('5214')) = 1);

select pg_temp.evento('BTN-5106', 'e7');
select pg_temp.verifica('botão de presença no quarto fecha o chamado',
  (select pg_temp.evento('PRS-5106', 'e8') ->> 'resultado') = 'atendido_presenca');
select pg_temp.verifica('… registrado como atendimento por presença no aparelho',
  (select atendimento_via = 'presenca_dispositivo' and status = 'atendido' from public.chamado where quarto_id = pg_temp.q('5106') order by aberto_em desc limit 1));

-- ── Coordenação: excepcional e simulação ────────────────────────────────────
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('encerramento excepcional exige justificativa', pg_temp.falha($q$select public.encerrar_chamado_excepcional((select id from pg_temp.aberto('5214')), 'curto')$q$));
select public.encerrar_chamado_excepcional((select id from pg_temp.aberto('5214')), 'Etiqueta NFC da 5214 descolada; conferido pessoalmente');
select pg_temp.verifica('encerrado excepcional fica marcado, com justificativa e quem encerrou',
  (select status = 'encerrado_excepcional' and atendimento_via = 'excepcional' and justificativa like 'Etiqueta%' and atendido_por = 'Patrícia Antunes'
     from public.chamado where quarto_id = pg_temp.q('5214') order by aberto_em desc limit 1));
select pg_temp.verifica('coordenação simula emergência para treino', (select public.simular_chamado('5110', 'emergencia') is not null));
select pg_temp.verifica('simulado fica marcado e aberto', (select simulado and tipo = 'emergencia' from pg_temp.aberto('5110')));
reset role;

select pg_temp.como('familia@blueseniorliving.com.br');
select pg_temp.verifica('família não vê chamados', (select count(*) from public.chamado) = 0);
reset role;
