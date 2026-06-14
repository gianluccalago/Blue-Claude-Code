-- ===========================================================================
-- 0062 — Cardápios diários por restrição (Nutricionista, BLOCO N3)
-- ---------------------------------------------------------------------------
-- A casa serve BUFFET; cada dia tem um cardápio por TIPO DE RESTRIÇÃO (linhas
-- de servir diferentes). Um cardápio = um dia + uma restrição, composto por
-- itens (um prato do N2 numa refeição). O custo por porção do cardápio (soma do
-- custo/porção dos pratos) servirá de base para o valor estimado de desperdício
-- (N4) e para o custo da refeição dos funcionários (N7). Idempotente.
-- ===========================================================================

create table if not exists public.cardapio (
  id            uuid primary key default gen_random_uuid(),
  data          date not null,
  tipo_restricao text not null check (tipo_restricao in
                  ('livre','diabetico','celiaco','hipossodica','pastosa','outro')),
  observacao    text,
  criado_por    text,
  criado_em     timestamptz not null default now(),
  unique (data, tipo_restricao)
);

create table if not exists public.cardapio_item (
  id          uuid primary key default gen_random_uuid(),
  cardapio_id uuid not null references public.cardapio(id) on delete cascade,
  refeicao    text not null check (refeicao in
                ('cafe_manha','lanche_manha','almoco','lanche_tarde','jantar','ceia')),
  prato_id    uuid not null references public.prato(id) on delete restrict
);

create index if not exists cardapio_data_idx on public.cardapio (data, tipo_restricao);
create index if not exists cardapio_item_cardapio_idx on public.cardapio_item (cardapio_id);

-- ─── RLS (Nutri+Master escrevem; gestão lê). A leitura por Coordenação/
--     Cuidadores/Família ("o que será servido hoje") é integração SECUNDÁRIA e
--     fica para depois — quando houver tela, basta ampliar este SELECT. ──────
do $$ declare t text;
begin
  foreach t in array array['cardapio','cardapio_item'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    execute format(
      'create policy %I_select on public.%I for select to authenticated '
      || 'using (public.app_perfil() in (''nutricionista'',''master'',''administracao'',''direcao''));', t, t);
    execute format(
      'create policy %I_write on public.%I for all to authenticated '
      || 'using (public.app_perfil() in (''nutricionista'',''master'')) '
      || 'with check (public.app_perfil() in (''nutricionista'',''master''));', t, t);
  end loop;
end $$;

-- ─── Seed: 1 dia (hoje) em "Livre" e "Diabético" com os pratos do N2 ─────────
insert into public.cardapio (id, data, tipo_restricao, criado_por) values
  ('cd000000-0000-0000-0000-000000000001', current_date, 'livre',     'Camila Rocha'),
  ('cd000000-0000-0000-0000-000000000002', current_date, 'diabetico', 'Camila Rocha')
on conflict (id) do nothing;

insert into public.cardapio_item (id, cardapio_id, refeicao, prato_id) values
  -- Livre · almoço: principal + 2 guarnições + salada
  ('ce000000-0000-0000-0000-000000000001','cd000000-0000-0000-0000-000000000001','almoco','f0000000-0000-0000-0000-000000000003'),
  ('ce000000-0000-0000-0000-000000000002','cd000000-0000-0000-0000-000000000001','almoco','f0000000-0000-0000-0000-000000000001'),
  ('ce000000-0000-0000-0000-000000000003','cd000000-0000-0000-0000-000000000001','almoco','f0000000-0000-0000-0000-000000000002'),
  ('ce000000-0000-0000-0000-000000000004','cd000000-0000-0000-0000-000000000001','almoco','f0000000-0000-0000-0000-000000000004'),
  -- Livre · jantar: guarnições + salada
  ('ce000000-0000-0000-0000-000000000005','cd000000-0000-0000-0000-000000000001','jantar','f0000000-0000-0000-0000-000000000001'),
  ('ce000000-0000-0000-0000-000000000006','cd000000-0000-0000-0000-000000000001','jantar','f0000000-0000-0000-0000-000000000004'),
  -- Diabético · almoço: igual, sem sobremesa (mesmos pratos salgados)
  ('ce000000-0000-0000-0000-000000000007','cd000000-0000-0000-0000-000000000002','almoco','f0000000-0000-0000-0000-000000000003'),
  ('ce000000-0000-0000-0000-000000000008','cd000000-0000-0000-0000-000000000002','almoco','f0000000-0000-0000-0000-000000000001'),
  ('ce000000-0000-0000-0000-000000000009','cd000000-0000-0000-0000-000000000002','almoco','f0000000-0000-0000-0000-000000000004')
on conflict (id) do nothing;
