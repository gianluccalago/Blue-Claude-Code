-- ===========================================================================
-- SMOKE — CRM PÓS-VISITA (0154): funil novo, biblioteca só para a gestão,
-- crm_salvar_pos_visita grava tudo junto (cria ou reaproveita a oportunidade,
-- liga a visita da agenda), refazer cancela as mensagens pendentes, e
-- avançar/perder/opt-out cancela a sequência no servidor.
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
create or replace function pg_temp.payload(p_nome text, p_op uuid, p_vis uuid) returns jsonb language sql as $$
  select jsonb_build_object(
    'oportunidade_id', p_op, 'visita_agendamento_id', p_vis,
    'contato', jsonb_build_object('nome', p_nome, 'telefone', '41999990000', 'relacao', 'Filho(a)',
                                  'nome_idoso', 'Maria Smoke', 'idade_idoso', 84, 'grau_estimado', 'II'),
    'oportunidade', jsonb_build_object('dores', jsonb_build_array('D01','D06'), 'objecoes', jsonb_build_array('O04'),
      'o_que_ouvimos', 'a Dona Maria caiu duas vezes', 'residente_chamar', 'Dona Maria', 'consentimento_whatsapp', true,
      'visita_positiva', true, 'simulacao_validade', '2026-12-31', 'valor_mensalidade_estimado', 7650,
      'simulacao', jsonb_build_object('opcoes', jsonb_build_array(jsonb_build_object('modalidade','longa_permanencia','valor_final',7650)))),
    'tarefas', jsonb_build_array(
      jsonb_build_object('assunto','M1','modelo','M1','mensagem','Olá','canal','whatsapp','tentativa',1,'data','2026-11-24'),
      jsonb_build_object('assunto','M2','modelo','M2','mensagem','Material','canal','whatsapp','tentativa',1,'data','2026-11-24'),
      jsonb_build_object('assunto','M4','modelo','M4','mensagem','Passos','canal','whatsapp','tentativa',2,'data','2026-11-27'),
      jsonb_build_object('assunto','M5','modelo','M5','mensagem','Retomada','canal','whatsapp','tentativa',3,'data','2026-12-01')))
$$;

-- Limpeza (postgres).
delete from public.crm_oportunidade where nome like 'SmokePV%';
delete from public.crm_contato where nome like 'SmokePV%';
delete from public.visita_agendamento where nome_completo like 'SmokePV%';
insert into public.visita_agendamento (nome_completo, whatsapp, data, hora, origem, status)
  values ('SmokePV Visita', '41988887777', current_date, '10:00', 'app', 'confirmada');

select pg_temp.verifica('funil novo: Proposta enviada logo após Visita agendada',
  (select string_agg(nome, '>' order by ordem) from public.crm_etapa where ativo)
   = 'Sem contato>Contato feito>Visita agendada>Proposta enviada>Contrato em preparação>Em lista de espera');
select pg_temp.verifica('motivo "Não respondeu mais" ativo',
  exists (select 1 from public.crm_motivo_perda where nome = 'Não respondeu mais' and ativo));

-- ── Coordenação não acessa ───────────────────────────────────────────────────
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('coordenação não lê a biblioteca', (select count(*) from public.crm_biblioteca) = 0);
select pg_temp.verifica('coordenação não registra pós-visita',
  pg_temp.falha($q$select public.crm_salvar_pos_visita(pg_temp.payload('SmokePV Coord', null, null))$q$));
reset role;

-- ── Direção registra a partir da visita da agenda (sem oportunidade) ────────
select pg_temp.como('direcao@blueseniorliving.com.br');
select pg_temp.verifica('direção lê os 16 blocos da biblioteca', (select count(*) from public.crm_biblioteca) = 16);
select public.crm_salvar_pos_visita(pg_temp.payload('SmokePV Ana',
  null, (select id from public.visita_agendamento where nome_completo = 'SmokePV Visita')));
select pg_temp.verifica('oportunidade criada em Proposta enviada, em andamento',
  (select etapa = 'Proposta enviada' and status = 'em_andamento' and dores = '{D01,D06}' and consentimento_whatsapp
     from public.crm_oportunidade where nome like 'SmokePV Ana%'));
select pg_temp.verifica('visita da agenda ligada à oportunidade',
  (select v.oportunidade_id = o.id from public.visita_agendamento v, public.crm_oportunidade o
    where v.nome_completo = 'SmokePV Visita' and o.nome like 'SmokePV Ana%'));
select pg_temp.verifica('4 mensagens automáticas programadas, assinadas pela direção',
  (select count(*) = 4 and bool_and(t.automatica) and bool_and(t.responsavel = 'Ernesto Lagomarsino')
     from public.crm_tarefa t join public.crm_oportunidade o on o.id = t.oportunidade_id where o.nome like 'SmokePV Ana%'));
select pg_temp.verifica('contato com consentimento LGPD',
  (select c.base_legal_lgpd = 'consentimento' from public.crm_contato c where c.nome = 'SmokePV Ana'));

-- Refazer pela mesma visita: reaproveita a oportunidade e troca as pendentes.
select public.crm_salvar_pos_visita(pg_temp.payload('SmokePV Ana',
  null, (select id from public.visita_agendamento where nome_completo = 'SmokePV Visita')));
select pg_temp.verifica('refazer não cria outra oportunidade',
  (select count(*) from public.crm_oportunidade where nome like 'SmokePV Ana%') = 1);
select pg_temp.verifica('refazer cancela as 4 pendentes e cria 4 novas',
  (select count(*) filter (where cancelada) = 4 and count(*) filter (where not cancelada) = 4
     from public.crm_tarefa t join public.crm_oportunidade o on o.id = t.oportunidade_id where o.nome like 'SmokePV Ana%'));

-- Avançar para "Contrato em preparação" cancela a sequência pendente.
update public.crm_oportunidade set etapa = 'Contrato em preparação' where nome like 'SmokePV Ana%';
select pg_temp.verifica('avançar de etapa cancela as mensagens pendentes',
  (select count(*) = 0 from public.crm_tarefa t join public.crm_oportunidade o on o.id = t.oportunidade_id
    where o.nome like 'SmokePV Ana%' and not t.cancelada and not t.concluida));
select pg_temp.verifica('motivo do cancelamento registrado',
  exists (select 1 from public.crm_tarefa t join public.crm_oportunidade o on o.id = t.oportunidade_id
           where o.nome like 'SmokePV Ana%' and t.motivo_cancelamento = 'Avançou para "Contrato em preparação"'));

-- Outra família: perder cancela; mensagem já enviada fica como está.
select public.crm_salvar_pos_visita(pg_temp.payload('SmokePV Bia', null, null));
update public.crm_tarefa set concluida = true, concluida_em = now()
 where modelo = 'M1' and oportunidade_id = (select id from public.crm_oportunidade where nome like 'SmokePV Bia%');
update public.crm_oportunidade set status = 'perdida', motivo_perda = 'Não respondeu mais' where nome like 'SmokePV Bia%';
select pg_temp.verifica('perder cancela as pendentes e preserva a enviada',
  (select count(*) filter (where cancelada) = 3 and count(*) filter (where concluida and not cancelada) = 1
     from public.crm_tarefa t join public.crm_oportunidade o on o.id = t.oportunidade_id where o.nome like 'SmokePV Bia%'));
select pg_temp.verifica('oportunidade encerrada não aceita novo pós-visita',
  pg_temp.falha($q$select public.crm_salvar_pos_visita(pg_temp.payload('SmokePV Bia', (select id from public.crm_oportunidade where nome like 'SmokePV Bia%'), null))$q$));

-- Opt-out também cancela.
select public.crm_salvar_pos_visita(pg_temp.payload('SmokePV Caio', null, null));
update public.crm_oportunidade set opt_out = true where nome like 'SmokePV Caio%';
select pg_temp.verifica('opt-out cancela as mensagens pendentes',
  (select count(*) = 0 from public.crm_tarefa t join public.crm_oportunidade o on o.id = t.oportunidade_id
    where o.nome like 'SmokePV Caio%' and not t.cancelada and not t.concluida));
reset role;

-- Limpeza.
delete from public.crm_oportunidade where nome like 'SmokePV%';
delete from public.crm_contato where nome like 'SmokePV%';
delete from public.visita_agendamento where nome_completo like 'SmokePV%';
