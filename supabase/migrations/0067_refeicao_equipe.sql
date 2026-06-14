-- ===========================================================================
-- 0067 — Custo da refeição dos funcionários (Nutricionista, BLOCO N7)
-- ---------------------------------------------------------------------------
-- Os funcionários comem de graça na casa. Não se registra prato a prato (no
-- buffet é inviável): ESTIMA-SE o custo mensal.
--
--   custo do mês = refeições/dia da equipe × dias do mês × custo médio/refeição
--
-- O "custo médio por refeição" é uma constante configurável (proxy enxuto e
-- fácil de manter do custo por porção do cardápio/N3). É CUSTO ESTIMADO, não
-- contábil, e NÃO gera cobrança (benefício à equipe, não upselling).
--
-- Mantém UMA config corrente, editável; cada alteração grava uma NOVA linha
-- (histórico), e a vigente é a de maior `vigente_desde`. Idempotente.
-- ===========================================================================

create table if not exists public.config_refeicao_equipe (
  id                            uuid primary key default gen_random_uuid(),
  refeicoes_equipe_por_dia      numeric not null check (refeicoes_equipe_por_dia >= 0),
  custo_medio_refeicao_fallback numeric not null check (custo_medio_refeicao_fallback >= 0),
  vigente_desde                 date not null default current_date,
  atualizado_por                text,
  atualizado_em                 timestamptz not null default now()
);

create index if not exists config_refeicao_equipe_vigencia_idx
  on public.config_refeicao_equipe (vigente_desde desc);

-- ─── RLS: configura Nutri+Master; LÊ também Administração e Direção ──────────
alter table public.config_refeicao_equipe enable row level security;
drop policy if exists config_refeicao_equipe_select on public.config_refeicao_equipe;
drop policy if exists config_refeicao_equipe_write on public.config_refeicao_equipe;
create policy config_refeicao_equipe_select on public.config_refeicao_equipe for select to authenticated
  using (public.app_perfil() in ('nutricionista','master','administracao','direcao'));
create policy config_refeicao_equipe_write on public.config_refeicao_equipe for all to authenticated
  using (public.app_perfil() in ('nutricionista','master'))
  with check (public.app_perfil() in ('nutricionista','master'));

-- ─── Seed: config de teste (30 refeições/dia; R$ 12,00 por refeição) ────────
insert into public.config_refeicao_equipe
  (id, refeicoes_equipe_por_dia, custo_medio_refeicao_fallback, vigente_desde, atualizado_por)
values
  ('c7000000-0000-0000-0000-000000000001', 30, 12.00,
   date_trunc('month', current_date)::date, 'Camila Rocha')
on conflict (id) do nothing;
