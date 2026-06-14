-- ===========================================================================
-- 0063 — Desperdício de alimento (Nutricionista, BLOCO N4)
-- ---------------------------------------------------------------------------
-- Buffet gera sobra descartada. Não dá para saber os insumos exatos do que foi
-- ao lixo, então o valor é uma ESTIMATIVA APROXIMADA: peso descartado × custo
-- médio por kg. O custo médio por kg vem do custo/porção do cardápio do dia
-- (N3) ÷ peso médio por porção (constante calibrável no código). O custo
-- estimado é CALCULADO E GRAVADO no momento do registro (snapshot), junto do
-- método usado (transparência). Indicador (peso + valor estimado/mês) pode
-- subir ao painel do Master/Administração no futuro. Idempotente.
-- ===========================================================================

create table if not exists public.desperdicio (
  id                uuid primary key default gen_random_uuid(),
  data              date not null default current_date,
  refeicao          text not null check (refeicao in
                      ('cafe_manha','lanche_manha','almoco','lanche_tarde','jantar','ceia','geral_dia')),
  peso_kg           numeric not null check (peso_kg >= 0),
  custo_estimado    numeric not null default 0,
  metodo_estimativa text,
  registrado_por    text,
  observacao        text,
  registrado_em     timestamptz not null default now()
);

create index if not exists desperdicio_data_idx on public.desperdicio (data);

-- ─── RLS (Nutri+Master escrevem; gestão lê) ─────────────────────────────────
alter table public.desperdicio enable row level security;
drop policy if exists desperdicio_select on public.desperdicio;
drop policy if exists desperdicio_write on public.desperdicio;
create policy desperdicio_select on public.desperdicio for select to authenticated
  using (public.app_perfil() in ('nutricionista','master','administracao','direcao'));
create policy desperdicio_write on public.desperdicio for all to authenticated
  using (public.app_perfil() in ('nutricionista','master'))
  with check (public.app_perfil() in ('nutricionista','master'));

-- ─── Seed: alguns registros no mês corrente (valor já estimado) ──────────────
insert into public.desperdicio (id, data, refeicao, peso_kg, custo_estimado, metodo_estimativa, registrado_por) values
  ('da000000-0000-0000-0000-000000000001', current_date - 1, 'almoco',   3.2, 57.60, 'Estimativa inicial (seed): 3,2 kg × R$ 18,00/kg', 'Camila Rocha'),
  ('da000000-0000-0000-0000-000000000002', current_date - 1, 'jantar',   2.1, 37.80, 'Estimativa inicial (seed): 2,1 kg × R$ 18,00/kg', 'Camila Rocha'),
  ('da000000-0000-0000-0000-000000000003', current_date - 2, 'almoco',   4.0, 72.00, 'Estimativa inicial (seed): 4,0 kg × R$ 18,00/kg', 'Camila Rocha'),
  ('da000000-0000-0000-0000-000000000004', current_date - 3, 'geral_dia',1.5, 27.00, 'Estimativa inicial (seed): 1,5 kg × R$ 18,00/kg', 'Camila Rocha')
on conflict (id) do nothing;
