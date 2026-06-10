-- Administração — Upselling: despesas extras dos hóspedes (BLOCO Adm2)
-- Lançamento manual por ora; a automação via módulo de compras da farmácia
-- poderá alimentar esta tabela no futuro (ver comentário no hook
-- useLancarUpselling).

create table upselling (
  id              uuid primary key default gen_random_uuid(),
  residente_id    uuid not null references residentes(id),
  categoria       text not null,
  descricao       text,
  valor           numeric not null,
  data            date not null default current_date,
  mes_referencia  text not null,
  comprovante_url text,
  lancado_por     text not null default 'Administração',
  criado_em       timestamptz not null default now()
);

alter table upselling disable row level security;

create index if not exists upselling_residente_mes_idx on upselling (residente_id, mes_referencia);
create index if not exists upselling_mes_idx on upselling (mes_referencia);

-- ─── Storage — bucket para comprovantes de upselling ──────────────────────────

insert into storage.buckets (id, name, public)
values ('upselling-comprovantes', 'upselling-comprovantes', true)
on conflict (id) do nothing;

drop policy if exists "upselling_comprovantes_select" on storage.objects;
create policy "upselling_comprovantes_select"
  on storage.objects for select
  using (bucket_id = 'upselling-comprovantes');

drop policy if exists "upselling_comprovantes_insert" on storage.objects;
create policy "upselling_comprovantes_insert"
  on storage.objects for insert
  with check (bucket_id = 'upselling-comprovantes');

drop policy if exists "upselling_comprovantes_update" on storage.objects;
create policy "upselling_comprovantes_update"
  on storage.objects for update
  using (bucket_id = 'upselling-comprovantes');

drop policy if exists "upselling_comprovantes_delete" on storage.objects;
create policy "upselling_comprovantes_delete"
  on storage.objects for delete
  using (bucket_id = 'upselling-comprovantes');

-- ─── Lançamentos de teste ──────────────────────────────────────────────────────

insert into upselling (residente_id, categoria, descricao, valor, data, mes_referencia) values
  ('a0000000-0000-0000-0000-000000000001', 'Manicure/cabeleireiro', 'Corte e escova', 60.00, '2026-06-05', '2026-06'),
  ('a0000000-0000-0000-0000-000000000002', 'Fisioterapia avulsa', 'Sessão extra de RPG', 150.00, '2026-06-08', '2026-06'),
  ('a0000000-0000-0000-0000-000000000004', 'Medicamentos', 'Pomada não coberta pelo plano', 45.90, '2026-06-10', '2026-06');
