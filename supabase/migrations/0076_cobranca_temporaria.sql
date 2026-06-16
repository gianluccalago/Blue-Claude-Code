-- ===========================================================================
-- 0076 — Precificação e cobrança de temporários (curta permanência / day care)
-- ---------------------------------------------------------------------------
-- Longa permanência paga MENSALIDADE (já existe). Temporários pagam por
-- DIÁRIA/PACOTE/AVULSO, com valores muito variáveis → a Administração lança a
-- cobrança MANUALMENTE (aberta). A tabela_diaria é só REFERÊNCIA (baliza), não
-- regra; pacotes/combinações são livres (não tabelados).
--
-- As cobranças entram no faturamento do mês (useResumoMes) junto das
-- mensalidades — sem duplicar a lógica de mensalidade. Idempotente.
-- ===========================================================================

-- ─── Tabela de REFERÊNCIA de diárias (orientativa; edita Master/Direção) ─────
create table if not exists public.tabela_diaria (
  id               uuid primary key default gen_random_uuid(),
  modalidade       text not null check (modalidade in ('curta_permanencia','day_care')),
  grau             text not null check (grau in ('I','II','III')),
  tipo_valor       text not null check (tipo_valor in ('diaria','day_care_periodo')),
  valor_referencia numeric not null default 0 check (valor_referencia >= 0),
  observacao       text,
  atualizado_em    timestamptz not null default now(),
  atualizado_por   text,
  unique (modalidade, grau, tipo_valor)
);

-- ─── Cobrança do temporário (FLEXÍVEL; lança a Administração) ────────────────
create table if not exists public.cobranca_temporaria (
  id                 uuid primary key default gen_random_uuid(),
  residente_id       uuid not null references residentes(id) on delete cascade,
  modalidade         text not null check (modalidade in ('curta_permanencia','day_care')),
  descricao          text not null,
  valor              numeric not null check (valor >= 0),
  periodo_referencia text not null,  -- "YYYY-MM"
  data               date not null default current_date,
  status             text not null default 'pendente' check (status in ('pendente','pago')),
  pago_em            timestamptz,
  registrado_por     text,
  criado_em          timestamptz not null default now()
);
create index if not exists cobranca_temporaria_mes_idx on public.cobranca_temporaria (periodo_referencia);
create index if not exists cobranca_temporaria_residente_idx on public.cobranca_temporaria (residente_id, periodo_referencia);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.tabela_diaria enable row level security;
drop policy if exists tabela_diaria_select on public.tabela_diaria;
drop policy if exists tabela_diaria_write on public.tabela_diaria;
create policy tabela_diaria_select on public.tabela_diaria for select to authenticated
  using (public.app_perfil() in ('administracao','direcao','master'));
create policy tabela_diaria_write on public.tabela_diaria for all to authenticated
  using (public.app_perfil() in ('direcao','master'))
  with check (public.app_perfil() in ('direcao','master'));

alter table public.cobranca_temporaria enable row level security;
drop policy if exists cobranca_temporaria_select on public.cobranca_temporaria;
drop policy if exists cobranca_temporaria_write on public.cobranca_temporaria;
-- Leitura: gestão total; família só o seu hóspede.
create policy cobranca_temporaria_select on public.cobranca_temporaria for select to authenticated
  using (
    public.app_perfil() in ('administracao','direcao','master')
    or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia())
  );
create policy cobranca_temporaria_write on public.cobranca_temporaria for all to authenticated
  using (public.app_perfil() in ('administracao','direcao','master'))
  with check (public.app_perfil() in ('administracao','direcao','master'));

-- ─── Seed: tabela de referência (valores de baliza) ─────────────────────────
insert into public.tabela_diaria (modalidade, grau, tipo_valor, valor_referencia, observacao) values
  ('curta_permanencia','I','diaria',350,'Referência — ajustar por caso'),
  ('curta_permanencia','II','diaria',430,'Referência — ajustar por caso'),
  ('curta_permanencia','III','diaria',520,'Referência — ajustar por caso'),
  ('day_care','I','day_care_periodo',180,'Período da tarde — referência'),
  ('day_care','II','day_care_periodo',220,'Período da tarde — referência'),
  ('day_care','III','day_care_periodo',270,'Período da tarde — referência')
on conflict (modalidade, grau, tipo_valor) do nothing;

-- ─── Seed: cobranças de teste (mês corrente) ────────────────────────────────
insert into public.cobranca_temporaria (id, residente_id, modalidade, descricao, valor, periodo_referencia, status, registrado_por) values
  ('cb000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000006','curta_permanencia','Curta permanência 18 dias — pós-operatório', 9360, to_char(current_date,'YYYY-MM'),'pendente','Administração'),
  ('cb000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000007','day_care','Day Care — pacote 3ª e 5ª (mês)', 2400, to_char(current_date,'YYYY-MM'),'pendente','Administração')
on conflict (id) do nothing;
