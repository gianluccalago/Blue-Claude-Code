-- ===========================================================================
-- 0100 — MÓDULO OBRA · Fase 2: medições (BM), pagamentos da MO, retenções,
-- TRP/TRD e multa/bônus de fase.
-- ---------------------------------------------------------------------------
-- Boletim de medição (BM): a construtora reivindica etapas concluídas no mês;
-- o valor bruto = (% medido) × área × preço/m² reajustado. Fluxo canônico:
-- Pendente → Em análise (vistoria) → Aprovado/Reprovado (c/ motivo) → NF
-- anexada → Pago. Memória de cálculo: retenção 5%, INSS 11%, ISS, líquido.
--
-- GATE de pagamento (server-side, inviolável): "Aprovar pagamento" só passa com
-- os 4 documentos mensais do mês (INSS, FGTS, ISS, folha) + NF anexada.
--
-- Retenção 5% de cada medição vai para obra_retencoes_ledger; libera 50% no
-- TRP e 50% no TRD (90 dias + pendências sanadas). Movimentos de dinheiro
-- (pagar, TRP, TRD) via RPC SECURITY DEFINER, atômica, auditada.
--
-- Zero acoplamento fora de obra_. Idempotente. Rode após a 0099.
-- ===========================================================================

-- Cronograma da fase (base para multa/bônus): data prevista de conclusão.
alter table public.obra_fases add column if not exists data_fim_prevista date;

-- ── 2.1 · Documentos mensais obrigatórios da construtora (gate de pagamento) ─
create table if not exists public.obra_documentos_mensais (
  id             uuid primary key default gen_random_uuid(),
  mes            text not null,          -- 'AAAA-MM'
  tipo           text not null check (tipo in ('inss','fgts','iss','folha')),
  arquivo_url    text not null,          -- caminho no bucket privado `obra`
  observacao     text,
  registrado_por text,
  criado_em      timestamptz not null default now(),
  unique (mes, tipo)                       -- 1 documento por tipo/mês (o mais recente substitui)
);
comment on table public.obra_documentos_mensais is
  'Gate de pagamento (contrato TRÍADE): guias INSS, FGTS, ISS e folha dos alocados por mês. Pagar uma medição exige os 4 do mês da medição.';

-- ── 2.2 · Medições (BM) ─────────────────────────────────────────────────────
create table if not exists public.obra_medicoes (
  id                uuid primary key default gen_random_uuid(),
  fase_id           uuid not null references public.obra_fases(id) on delete restrict,
  mes               text not null,        -- 'AAAA-MM'
  percentual_medido numeric not null check (percentual_medido >= 0),
  -- Snapshot dos valores no momento do lançamento (alíquotas/pesos podem mudar
  -- depois; a medição preserva a memória de cálculo original).
  preco_m2_aplicado numeric not null,
  valor_bruto       numeric not null,
  retencao_pct      numeric not null,
  retencao_valor    numeric not null,
  inss_pct          numeric not null default 0,
  inss_valor        numeric not null default 0,
  iss_pct           numeric not null default 0,
  iss_valor         numeric not null default 0,
  outras_valor      numeric not null default 0,   -- IRRF/CSRF quando ativas
  valor_liquido     numeric not null,
  status            text not null default 'Pendente'
                    check (status in ('Pendente','Em análise','Aprovado','Reprovado','Pago')),
  motivo            text,                 -- obrigatório em Reprovado (validado na UI)
  nf_numero         text,
  nf_url            text,                 -- caminho no bucket (NF anexada antes de pagar)
  data_aprovacao    date,
  data_pagamento    date,
  aprovado_por      text,
  registrado_por    text,
  criado_em         timestamptz not null default now()
);
comment on table public.obra_medicoes is
  'Boletim de medição da MO. valor_bruto = percentual_medido × área × preço/m² reajustado. Retenção 5% + INSS/ISS retidos → líquido a pagar (snapshot). Pagar via RPC obra_pagar_medicao (gate dos 4 documentos + NF).';
create index if not exists idx_obra_medicoes_fase on public.obra_medicoes (fase_id, mes);

-- Etapas reivindicadas em cada BM (uma etapa é medida uma única vez enquanto a
-- medição não é reprovada — garantido na app; ao reprovar, as etapas se liberam).
create table if not exists public.obra_medicao_etapas (
  id         uuid primary key default gen_random_uuid(),
  medicao_id uuid not null references public.obra_medicoes(id) on delete cascade,
  etapa_id   uuid not null references public.obra_etapas(id) on delete restrict
);
create index if not exists idx_obra_medicao_etapas_med on public.obra_medicao_etapas (medicao_id);
create index if not exists idx_obra_medicao_etapas_etapa on public.obra_medicao_etapas (etapa_id);

-- ── 2.3 · Ledger de retenções por fase (5% retido; libera 50% TRP / 50% TRD) ─
create table if not exists public.obra_retencoes_ledger (
  id             uuid primary key default gen_random_uuid(),
  fase_id        uuid not null references public.obra_fases(id) on delete restrict,
  medicao_id     uuid references public.obra_medicoes(id) on delete set null,
  tipo           text not null check (tipo in ('retido','liberado_trp','liberado_trd')),
  valor          numeric not null,       -- sempre positivo; o SINAL vem do tipo
  observacao     text,
  registrado_por text,
  evento_em      timestamptz not null default now()
);
comment on table public.obra_retencoes_ledger is
  'Retenções da MO por fase. Saldo em mãos do Contratante = Σ retido − Σ liberado_*. Escrito só pelas RPCs (pagar/TRP/TRD). Financeiro do Contratante: NÃO visível ao prestador.';
create index if not exists idx_obra_retencoes_fase on public.obra_retencoes_ledger (fase_id, evento_em);

-- ── 2.4 · Pendências de recebimento (checklist entre TRP e TRD) ─────────────
create table if not exists public.obra_recebimento_pendencias (
  id             uuid primary key default gen_random_uuid(),
  fase_id        uuid not null references public.obra_fases(id) on delete cascade,
  descricao      text not null,
  sanada         boolean not null default false,
  sanada_em      date,
  registrado_por text,
  criado_em      timestamptz not null default now()
);
comment on table public.obra_recebimento_pendencias is
  'Pendências/vícios aparentes apontados no TRP. O TRD (libera os 50% finais) exige 90 dias desde o TRP E todas as pendências sanadas.';
create index if not exists idx_obra_pendencias_fase on public.obra_recebimento_pendencias (fase_id);

-- ── 2.5 · RPC: pagar medição (GATE dos 4 documentos + NF; posta retenção) ───
create or replace function public.obra_pagar_medicao(p_medicao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m       public.obra_medicoes%rowtype;
  n_docs  int;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a aprovar pagamentos.';
  end if;

  select * into m from public.obra_medicoes where id = p_medicao_id;
  if not found then raise exception 'Medição não encontrada.'; end if;
  if m.status <> 'Aprovado' then
    raise exception 'A medição precisa estar Aprovada antes do pagamento (status atual: %).', m.status;
  end if;
  if coalesce(m.nf_url, '') = '' then
    raise exception 'Anexe a NF da medição antes de aprovar o pagamento.';
  end if;

  -- GATE: os 4 documentos mensais do mês da medição.
  select count(distinct tipo) into n_docs
  from public.obra_documentos_mensais where mes = m.mes;
  if n_docs < 4 then
    raise exception 'Faltam documentos do mês % (INSS, FGTS, ISS e folha) — % de 4 anexados.', m.mes, n_docs;
  end if;

  -- Serializa o ledger da fase e registra pagamento + retenção, atômico.
  perform pg_advisory_xact_lock(hashtextextended('obra_ledger:' || m.fase_id::text, 0));
  update public.obra_medicoes
     set status = 'Pago', data_pagamento = current_date
   where id = p_medicao_id;
  insert into public.obra_retencoes_ledger (fase_id, medicao_id, tipo, valor, observacao, registrado_por)
  values (m.fase_id, m.id, 'retido', m.retencao_valor,
          'Retenção 5% da medição ' || m.mes, public.app_perfil());
end;
$$;
grant execute on function public.obra_pagar_medicao(uuid) to authenticated;

-- ── 2.6 · RPC: emitir TRP (libera 50% da retenção da fase) ──────────────────
create or replace function public.obra_emitir_trp(p_fase_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  f            public.obra_fases%rowtype;
  retido_total numeric;
  liberar      numeric;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a emitir TRP.';
  end if;
  select * into f from public.obra_fases where id = p_fase_id;
  if not found then raise exception 'Fase não encontrada.'; end if;
  if f.status <> 'em_andamento' then
    raise exception 'A fase precisa estar em andamento para emitir o TRP (status: %).', f.status;
  end if;

  -- Conclusão física: toda etapa da fase com verificação mais recente concluída.
  if exists (
    select 1 from public.obra_etapas e
    where e.fase_id = p_fase_id
      and coalesce((
        select c.concluido from public.obra_checklist_execucao c
        where c.etapa_id = e.id order by c.registrado_em desc limit 1
      ), false) = false
  ) then
    raise exception 'Há etapas não concluídas nesta fase — o TRP exige 100%% físico verificado.';
  end if;

  -- Nenhuma medição pendente/em análise/aprovada-sem-pagar.
  if exists (
    select 1 from public.obra_medicoes
    where fase_id = p_fase_id and status in ('Pendente','Em análise','Aprovado')
  ) then
    raise exception 'Há medições ainda não pagas nesta fase — regularize antes do TRP.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('obra_ledger:' || p_fase_id::text, 0));
  select coalesce(sum(valor), 0) into retido_total
  from public.obra_retencoes_ledger where fase_id = p_fase_id and tipo = 'retido';
  liberar := round(retido_total * 0.5, 2);

  update public.obra_fases set status = 'trp_emitido', data_trp = current_date where id = p_fase_id;
  insert into public.obra_retencoes_ledger (fase_id, tipo, valor, observacao, registrado_por)
  values (p_fase_id, 'liberado_trp', liberar, 'Liberação de 50% no TRP', public.app_perfil());
  return liberar;
end;
$$;
grant execute on function public.obra_emitir_trp(uuid) to authenticated;

-- ── 2.7 · RPC: emitir TRD (90 dias + pendências sanadas; libera o restante) ─
create or replace function public.obra_emitir_trd(p_fase_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  f          public.obra_fases%rowtype;
  saldo      numeric;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a emitir TRD.';
  end if;
  select * into f from public.obra_fases where id = p_fase_id;
  if not found then raise exception 'Fase não encontrada.'; end if;
  if f.status <> 'trp_emitido' then
    raise exception 'O TRD exige TRP emitido antes (status: %).', f.status;
  end if;
  if f.data_trp is null or current_date < f.data_trp + 90 then
    raise exception 'O TRD só pode ser emitido 90 dias após o TRP (a partir de %).',
      coalesce((f.data_trp + 90)::text, '—');
  end if;
  if exists (select 1 from public.obra_recebimento_pendencias
             where fase_id = p_fase_id and not sanada) then
    raise exception 'Há pendências não sanadas — resolva-as antes do TRD.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('obra_ledger:' || p_fase_id::text, 0));
  select coalesce(sum(case when tipo = 'retido' then valor else -valor end), 0) into saldo
  from public.obra_retencoes_ledger where fase_id = p_fase_id;
  if saldo < 0 then saldo := 0; end if;

  update public.obra_fases set status = 'trd_emitido', data_trd = current_date where id = p_fase_id;
  insert into public.obra_retencoes_ledger (fase_id, tipo, valor, observacao, registrado_por)
  values (p_fase_id, 'liberado_trd', saldo, 'Liberação do saldo final no TRD', public.app_perfil());
  return saldo;
end;
$$;
grant execute on function public.obra_emitir_trd(uuid) to authenticated;

-- ── 2.8 · Auditoria nas novas tabelas mutáveis ──────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['obra_documentos_mensais','obra_medicoes','obra_medicao_etapas',
                           'obra_retencoes_ledger','obra_recebimento_pendencias'] loop
    execute format('drop trigger if exists trg_audit_%s on public.%I', t, t);
    execute format('create trigger trg_audit_%s after insert or update or delete on public.%I
                    for each row execute function public.fn_obra_audit()', t, t);
  end loop;
end $$;

-- ── 2.9 · RLS ────────────────────────────────────────────────────────────────
-- master/direcao: total. obra_prestador: LÊ medições/documentos/pendências
-- (transparência das próprias submissões e status). NUNCA lê o ledger de
-- retenções (financeiro do Contratante). A escrita do prestador chega na Fase 6.

alter table public.obra_documentos_mensais enable row level security;
drop policy if exists obra_docmes_select on public.obra_documentos_mensais;
create policy obra_docmes_select on public.obra_documentos_mensais for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_docmes_write on public.obra_documentos_mensais;
create policy obra_docmes_write on public.obra_documentos_mensais for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_medicoes enable row level security;
drop policy if exists obra_medicoes_select on public.obra_medicoes;
create policy obra_medicoes_select on public.obra_medicoes for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_medicoes_write on public.obra_medicoes;
create policy obra_medicoes_write on public.obra_medicoes for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_medicao_etapas enable row level security;
drop policy if exists obra_medetapas_select on public.obra_medicao_etapas;
create policy obra_medetapas_select on public.obra_medicao_etapas for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_medetapas_write on public.obra_medicao_etapas;
create policy obra_medetapas_write on public.obra_medicao_etapas for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_recebimento_pendencias enable row level security;
drop policy if exists obra_pend_select on public.obra_recebimento_pendencias;
create policy obra_pend_select on public.obra_recebimento_pendencias for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_pend_write on public.obra_recebimento_pendencias;
create policy obra_pend_write on public.obra_recebimento_pendencias for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- Ledger de retenções: master/direção apenas (NUNCA prestador). Escrita só RPC.
alter table public.obra_retencoes_ledger enable row level security;
drop policy if exists obra_retencoes_select on public.obra_retencoes_ledger;
create policy obra_retencoes_select on public.obra_retencoes_ledger for select to authenticated
  using (public.app_perfil() in ('master','direcao'));
-- (sem policy de escrita: só as RPCs SECURITY DEFINER inserem)

-- ── 2.10 · Teste de RLS (JWT obra_prestador) ────────────────────────────────
-- select * from obra_retencoes_ledger;    -- deve retornar 0 linhas (financeiro oculto)
-- insert into obra_medicoes(...) ...;      -- deve falhar (escrita master/direção)
-- select obra_pagar_medicao('...');        -- deve falhar (perfil não autorizado)
-- select * from obra_medicoes;             -- ok (transparência das submissões)

-- Fim.
