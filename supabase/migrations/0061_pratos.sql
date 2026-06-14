-- ===========================================================================
-- 0061 — Pratos / fichas técnicas (Nutricionista, BLOCO N2)
-- ---------------------------------------------------------------------------
-- Um prato é uma ficha técnica: lista de insumos (do N1) com quantidade na
-- unidade do insumo. O custo é SEMPRE calculado com o custo ATUAL dos insumos
-- (quantidade × custo_unitario) — então mudou o preço no N1, muda o custo do
-- prato. Não guardamos custo no prato (evita defasagem).
--
-- Estes pratos alimentarão os cardápios diários (N3) e o custo por porção será
-- base para o valor estimado de desperdício (N4). Idempotente.
-- ===========================================================================

create table if not exists public.prato (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  categoria          text not null check (categoria in
                       ('prato_principal','guarnicao','salada','sobremesa','cafe_lanche','outro')),
  rendimento_porcoes int not null default 1 check (rendimento_porcoes > 0),
  modo_preparo       text,
  observacao         text,
  ativo              boolean not null default true,
  atualizado_em      timestamptz not null default now()
);

create table if not exists public.prato_insumo (
  id         uuid primary key default gen_random_uuid(),
  prato_id   uuid not null references public.prato(id) on delete cascade,
  insumo_id  uuid not null references public.insumo(id) on delete restrict,
  quantidade numeric not null check (quantidade >= 0)
);

create index if not exists prato_categoria_idx on public.prato (categoria);
create index if not exists prato_insumo_prato_idx on public.prato_insumo (prato_id);
create index if not exists prato_insumo_insumo_idx on public.prato_insumo (insumo_id);

-- ─── RLS (mesmo recorte do N1: Nutri+Master escrevem; gestão lê) ────────────
do $$ declare t text;
begin
  foreach t in array array['prato','prato_insumo'] loop
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

-- ─── Seed: 4 pratos usando os insumos do 0060 (idempotente) ─────────────────
insert into public.prato (id, nome, categoria, rendimento_porcoes, modo_preparo) values
  ('f0000000-0000-0000-0000-000000000001','Arroz branco','guarnicao',20,'Refogar e cozinhar o arroz.'),
  ('f0000000-0000-0000-0000-000000000002','Feijão carioca','guarnicao',20,'Cozinhar o feijão e temperar.'),
  ('f0000000-0000-0000-0000-000000000003','Carne moída refogada','prato_principal',20,'Refogar a carne com tomate.'),
  ('f0000000-0000-0000-0000-000000000004','Salada de alface e tomate','salada',20,'Higienizar e montar a salada.')
on conflict (id) do nothing;

insert into public.prato_insumo (id, prato_id, insumo_id, quantidade) values
  -- Arroz branco: arroz 3 kg + óleo 0,1 L
  ('f1000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000001',3),
  ('f1000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000003',0.1),
  -- Feijão: feijão 2 kg + óleo 0,1 L
  ('f1000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000002',2),
  ('f1000000-0000-0000-0000-000000000004','f0000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000003',0.1),
  -- Carne moída: patinho 3 kg + tomate 0,5 kg + óleo 0,2 L
  ('f1000000-0000-0000-0000-000000000005','f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000009',3),
  ('f1000000-0000-0000-0000-000000000006','f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000006',0.5),
  ('f1000000-0000-0000-0000-000000000007','f0000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000003',0.2),
  -- Salada: alface 5 un + tomate 1 kg
  ('f1000000-0000-0000-0000-000000000008','f0000000-0000-0000-0000-000000000004','e0000000-0000-0000-0000-000000000008',5),
  ('f1000000-0000-0000-0000-000000000009','f0000000-0000-0000-0000-000000000004','e0000000-0000-0000-0000-000000000006',1)
on conflict (id) do nothing;
