-- ===========================================================================
-- 0044 — TERRENO para futura integração de cobrança (ex.: Asaas)
-- ---------------------------------------------------------------------------
-- NÃO HÁ integração real aqui: este ambiente é só front + Supabase, SEM
-- backend para webhook. A integração de pagamento (criar cliente/cobrança,
-- receber confirmação) exigirá uma CAMADA DE BACKEND no futuro — por exemplo
-- uma Supabase Edge Function que fale com a API do provedor e atualize estas
-- tabelas. Por ora, esta migração só:
--   1) guarda o RESPONSÁVEL FINANCEIRO (quem paga) por hóspede;
--   2) amplia o STATUS de cobrança da mensalidade (controle MANUAL);
--   3) reserva campos de ID externo (asaas_customer_id, id_cobranca_externa),
--      que ficam VAZIOS até a integração existir.
-- Idempotente.
-- ===========================================================================

-- 1) RESPONSÁVEL FINANCEIRO + id de cliente externo (reservado, sem uso agora).
alter table public.residentes
  add column if not exists resp_fin_nome      text,
  add column if not exists resp_fin_cpf       text,
  add column if not exists resp_fin_email     text,
  add column if not exists resp_fin_telefone  text,
  add column if not exists resp_fin_relacao   text,  -- Filho(a)/Cônjuge/Outro
  -- RESERVADO p/ o futuro ID do cliente na plataforma de cobrança (ex.: Asaas).
  -- Preenchido pela futura Edge Function de integração; permanece NULL por ora.
  add column if not exists asaas_customer_id  text;

comment on column public.residentes.asaas_customer_id is
  'RESERVADO: id do cliente na plataforma de cobrança (ex.: Asaas). Sem uso até a integração via backend existir.';

-- 2) PAGAMENTO_MENSALIDADE: status estruturado + campos de cobrança.
alter table public.pagamento_mensalidade
  add column if not exists data_vencimento     date,
  add column if not exists forma_pagamento     text,   -- pix/boleto/cartao/dinheiro/transferencia
  add column if not exists valor_pago          numeric,
  add column if not exists data_pagamento      date,
  -- RESERVADO p/ o futuro ID da cobrança na plataforma (ex.: Asaas). NULL por ora.
  add column if not exists id_cobranca_externa text;

comment on column public.pagamento_mensalidade.id_cobranca_externa is
  'RESERVADO: id da cobrança na plataforma (ex.: Asaas). Sem uso até a integração via backend existir.';

-- 2a) Migra os valores atuais: pago→paga, pendente→em_aberto.
update public.pagamento_mensalidade set status = 'paga'      where status = 'pago';
update public.pagamento_mensalidade set status = 'em_aberto' where status = 'pendente';

-- 2b) Backfill: vencimento (dia 10 do mês de referência) e, p/ as pagas,
--     espelha valor_pago/data_pagamento/forma a partir do que já existe.
update public.pagamento_mensalidade
  set data_vencimento = (mes_referencia || '-10')::date
  where data_vencimento is null;
update public.pagamento_mensalidade
  set valor_pago     = coalesce(valor_pago, valor),
      data_pagamento = coalesce(data_pagamento, pago_em::date),
      forma_pagamento = coalesce(forma_pagamento, 'pix')
  where status = 'paga';

-- 2c) Default novo + check do conjunto ampliado (após migrar os dados).
alter table public.pagamento_mensalidade alter column status set default 'em_aberto';
alter table public.pagamento_mensalidade drop constraint if exists pagamento_mensalidade_status_check;
alter table public.pagamento_mensalidade add constraint pagamento_mensalidade_status_check
  check (status in ('em_aberto','enviada','paga','vencida','cancelada'));

-- 3) MOCK: responsável financeiro dos hóspedes de demonstração.
-- 3a) Hóspedes mock novos (c…): dados completos do pagador.
update public.residentes set resp_fin_nome='Marília Tavares', resp_fin_relacao='Filho(a)', resp_fin_cpf='482.115.770-09', resp_fin_email='marilia.tavares@email.com', resp_fin_telefone='(41) 99810-2233' where id='c0000000-0000-0000-0000-000000000001';
update public.residentes set resp_fin_nome='Pedro Saraiva', resp_fin_relacao='Filho(a)', resp_fin_cpf='331.908.220-44', resp_fin_email='pedro.saraiva@email.com', resp_fin_telefone='(41) 99721-5566' where id='c0000000-0000-0000-0000-000000000002';
update public.residentes set resp_fin_nome='Sônia Nogueira', resp_fin_relacao='Filho(a)', resp_fin_cpf='770.443.110-21', resp_fin_email='sonia.nogueira@email.com', resp_fin_telefone='(41) 99655-7781' where id='c0000000-0000-0000-0000-000000000003';
update public.residentes set resp_fin_nome='Cláudio Quadros', resp_fin_relacao='Outro', resp_fin_cpf='205.661.880-77', resp_fin_email='claudio.quadros@email.com', resp_fin_telefone='(41) 99540-3398' where id='c0000000-0000-0000-0000-000000000004';
update public.residentes set resp_fin_nome='Tânia Haddad', resp_fin_relacao='Filho(a)', resp_fin_cpf='559.012.340-08', resp_fin_email='tania.haddad@email.com', resp_fin_telefone='(41) 99488-1102' where id='c0000000-0000-0000-0000-000000000005';
update public.residentes set resp_fin_nome='Renato Fontana', resp_fin_relacao='Filho(a)', resp_fin_cpf='618.225.470-15', resp_fin_email='renato.fontana@email.com', resp_fin_telefone='(41) 99377-6640' where id='c0000000-0000-0000-0000-000000000006';
update public.residentes set resp_fin_nome='Inês Pires', resp_fin_relacao='Filho(a)', resp_fin_cpf='094.337.660-52', resp_fin_email='ines.pires@email.com', resp_fin_telefone='(41) 99260-8893' where id='c0000000-0000-0000-0000-000000000007';
update public.residentes set resp_fin_nome='Fábio Bittencourt', resp_fin_relacao='Filho(a)', resp_fin_cpf='447.880.120-33', resp_fin_email='fabio.bittencourt@email.com', resp_fin_telefone='(41) 99150-2271' where id='c0000000-0000-0000-0000-000000000008';

-- 3b) Demais hóspedes: deriva nome/relação/telefone do responsável legal já
--     cadastrado (só onde ainda estiver vazio).
update public.residentes set
  resp_fin_nome = coalesce(resp_fin_nome, nullif(trim(split_part(responsavel_legal,'(',1)),'')),
  resp_fin_relacao = coalesce(resp_fin_relacao,
    case
      when responsavel_legal ilike '%filh%' then 'Filho(a)'
      when responsavel_legal ilike '%espos%' or responsavel_legal ilike '%cônjuge%' or responsavel_legal ilike '%conjuge%' then 'Cônjuge'
      else 'Outro'
    end),
  resp_fin_telefone = coalesce(resp_fin_telefone, contato)
  where responsavel_legal is not null
    and (resp_fin_nome is null or resp_fin_telefone is null or resp_fin_relacao is null);

-- 3c) MOCK de cobrança do mês corrente para os hóspedes novos, com mix de
--     status (paga/enviada/em_aberto) e vencimento — alimenta o Painel de
--     Cobrança. Idempotente via unique(residente_id, mes_referencia).
do $$ declare mref text := to_char(current_date,'YYYY-MM'); venc date := (to_char(current_date,'YYYY-MM') || '-10')::date;
begin
  -- garante linhas para os 8 hóspedes mock no mês corrente
  insert into public.pagamento_mensalidade
    (residente_id, mes_referencia, valor, status, data_vencimento, registrado_por)
  values
    ('c0000000-0000-0000-0000-000000000001', mref, 9800,  'paga',     venc, 'Administração'),
    ('c0000000-0000-0000-0000-000000000002', mref, 12400, 'enviada',  venc, 'Administração'),
    ('c0000000-0000-0000-0000-000000000003', mref, 12900, 'em_aberto',venc, 'Administração'),
    ('c0000000-0000-0000-0000-000000000004', mref, 7600,  'paga',     venc, 'Administração'),
    ('c0000000-0000-0000-0000-000000000005', mref, 10500, 'enviada',  venc, 'Administração'),
    ('c0000000-0000-0000-0000-000000000006', mref, 8200,  'paga',     venc, 'Administração'),
    ('c0000000-0000-0000-0000-000000000007', mref, 13500, 'em_aberto',(to_char(current_date,'YYYY-MM') || '-05')::date, 'Administração'),
    ('c0000000-0000-0000-0000-000000000008', mref, 9900,  'em_aberto',venc, 'Administração')
  on conflict (residente_id, mes_referencia) do update
    set status = excluded.status, data_vencimento = excluded.data_vencimento, valor = excluded.valor;
  -- completa dados das pagas
  update public.pagamento_mensalidade
    set valor_pago = valor, data_pagamento = current_date - 3, forma_pagamento = 'pix'
    where mes_referencia = mref and status = 'paga' and residente_id::text like 'c0000000%';
end $$;
