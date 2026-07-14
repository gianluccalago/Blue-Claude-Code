-- ===========================================================================
-- 0105 — MÓDULO OBRA · Fase 7: controles transversais + dashboard executivo.
-- ---------------------------------------------------------------------------
-- Insumos críticos do Contratante (semáforo), ensaios/controle tecnológico,
-- diário de obra, não-conformidades (NC), documentos da obra (vencimentos) e
-- aditivos. Regra dura: NC aberta em etapa BLOQUEIA a aprovação da medição que
-- reivindica essa etapa (trigger). master/direção. Idempotente. Após a 0104.
-- ===========================================================================

-- ── 7.1 · Insumos críticos do Contratante (semáforo de prazo/dependência) ───
create table if not exists public.obra_insumos_criticos (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  dependencia  text,                    -- ex.: "estudo de tráfego antes do estrutural"
  responsavel  text,
  prazo_limite date,
  status       text not null default 'pendente' check (status in ('pendente','em_andamento','ok')),
  observacao   text,
  criado_em    timestamptz not null default now()
);
comment on table public.obra_insumos_criticos is
  'Fornecimentos diretos críticos do Contratante (elevadores, SPDA, gás/boilers, AVAC, gerador, laboratório). Semáforo = status + prazo_limite da dependência.';

insert into public.obra_insumos_criticos (nome, dependencia, responsavel)
select * from (values
  ('Elevadores', 'Estudo de tráfego é PRÉ-REQUISITO do projeto estrutural', null::text),
  ('SPDA (para-raios)', 'Projeto e instalação', null),
  ('Gás / boilers', 'Projeto e fornecimento', null),
  ('AVAC (climatização)', 'Projeto e fornecimento', null),
  ('Gerador', 'Fornecimento e instalação', null),
  ('Laboratório de ensaios', 'Controle tecnológico (corpos de prova, compactação)', null)
) as v(nome, dependencia, responsavel)
where not exists (select 1 from public.obra_insumos_criticos);

-- ── 7.2 · Ensaios / controle tecnológico ────────────────────────────────────
create table if not exists public.obra_ensaios (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null,          -- corpo_prova_concreto / compactacao / …
  referencia    text,                    -- concretagem/local
  fase_id       uuid references public.obra_fases(id) on delete set null,
  data_agendada date,
  data_resultado date,
  resultado     text not null default 'pendente' check (resultado in ('pendente','conforme','nao_conforme')),
  arquivo_url   text,
  observacao    text,
  registrado_por text,
  criado_em     timestamptz not null default now()
);
comment on table public.obra_ensaios is
  'Agenda e resultados de ensaios. Concretagem exige ensaio de corpo de prova; ensaio pendente/atrasado é alerta vermelho no painel.';
create index if not exists idx_obra_ensaios_fase on public.obra_ensaios (fase_id, data_agendada);

-- ── 7.3 · Diário de obra (registro fotográfico semanal + ocorrências) ───────
create table if not exists public.obra_diario (
  id            uuid primary key default gen_random_uuid(),
  data          date not null default current_date,
  ocorrencias   text not null,
  foto_url      text,
  registrado_por text,
  criado_em     timestamptz not null default now()
);
create index if not exists idx_obra_diario_data on public.obra_diario (data desc);

-- ── 7.4 · Não-conformidades (NC) ────────────────────────────────────────────
create table if not exists public.obra_nao_conformidades (
  id                  uuid primary key default gen_random_uuid(),
  origem              text not null default 'geral' check (origem in ('recebimento','etapa','geral')),
  etapa_id            uuid references public.obra_etapas(id) on delete set null,
  descricao           text not null,
  responsavel         text,
  prazo               date,
  status              text not null default 'aberta' check (status in ('aberta','em_correcao','reinspecao','encerrada')),
  foto_apontamento_url text,
  foto_reinspecao_url  text,
  observacao          text,
  registrado_por      text,
  encerrada_em        date,
  criado_em           timestamptz not null default now()
);
comment on table public.obra_nao_conformidades is
  'Apontamento → responsável → prazo → reinspeção (foto) → encerramento. NC aberta em etapa BLOQUEIA a aprovação da medição que reivindica a etapa (trigger).';
create index if not exists idx_obra_nc_etapa on public.obra_nao_conformidades (etapa_id, status);

-- Trigger: impede aprovar medição com NC aberta em alguma etapa reivindicada.
create or replace function public.fn_obra_bloqueia_medicao_nc()
returns trigger language plpgsql set search_path = public as $$
begin
  if NEW.status = 'Aprovado' and OLD.status is distinct from 'Aprovado' then
    if exists (
      select 1
      from public.obra_medicao_etapas me
      join public.obra_nao_conformidades nc on nc.etapa_id = me.etapa_id
      where me.medicao_id = NEW.id and nc.status <> 'encerrada'
    ) then
      raise exception 'Há não-conformidade aberta em etapa desta medição — encerre a NC antes de aprovar.';
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_obra_bloqueia_medicao_nc on public.obra_medicoes;
create trigger trg_obra_bloqueia_medicao_nc before update on public.obra_medicoes
  for each row execute function public.fn_obra_bloqueia_medicao_nc();

-- ── 7.5 · Documentos da OBRA (alvará, ARTs, CNO/INSS, apólices, licenças) ────
create table if not exists public.obra_documentos (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null,          -- alvara / art / cno_inss / apolice / licenca_ambiental / outro
  nome          text not null,
  identificador text,
  data_validade date,
  arquivo_url   text,
  observacao    text,
  registrado_por text,
  criado_em     timestamptz not null default now()
);
comment on table public.obra_documentos is
  'Documentos da OBRA (distintos dos institucionais da ILPI). Alertas de vencimento a 30/15/5 dias.';
create index if not exists idx_obra_docs_val on public.obra_documentos (data_validade);

-- ── 7.6 · Aditivos (escopo/valor/prazo, PDF assinado) ───────────────────────
create table if not exists public.obra_aditivos (
  id             uuid primary key default gen_random_uuid(),
  numero         text,
  tipo           text not null check (tipo in ('escopo','valor','prazo','misto')),
  descricao      text not null,
  valor_delta    numeric default 0,
  prazo_delta_dias int default 0,
  fase_id        uuid references public.obra_fases(id) on delete set null,
  pdf_url        text,
  data_assinatura date,
  registrado_por text,
  criado_em      timestamptz not null default now()
);
comment on table public.obra_aditivos is
  'Aditivos formais. Qualquer alteração de valor/prazo do contrato deve ter um aditivo vinculado (PDF assinado).';

-- ── 7.7 · Auditoria + RLS (master/direção) ──────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['obra_insumos_criticos','obra_ensaios','obra_diario',
                           'obra_nao_conformidades','obra_documentos','obra_aditivos'] loop
    execute format('drop trigger if exists trg_audit_%s on public.%I', t, t);
    execute format('create trigger trg_audit_%s after insert or update or delete on public.%I
                    for each row execute function public.fn_obra_audit()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %s_all on public.%I', t, t);
    execute format($f$create policy %s_all on public.%I for all to authenticated
                     using (public.app_perfil() in ('master','direcao'))
                     with check (public.app_perfil() in ('master','direcao'))$f$, t, t);
  end loop;
end $$;

-- Fim.
