-- ===========================================================================
-- 0072 — Custos de materiais (limpeza e manutenção)
-- ---------------------------------------------------------------------------
-- A Administração registra despesas de material em DUAS categorias separadas:
-- limpeza e manutenção. Alimenta o RESULTADO do mês (useResumoMes.custoMateriais)
-- — não cria indicador novo, apenas a fonte única já existente. Idempotente.
-- ===========================================================================

create table if not exists public.custo_material (
  id              uuid primary key default gen_random_uuid(),
  categoria       text not null check (categoria in ('limpeza','manutencao')),
  descricao       text not null,
  valor           numeric not null check (valor >= 0),
  fornecedor      text,
  data            date not null default current_date,
  mes_referencia  text not null,
  comprovante_url text,
  registrado_por  text,
  criado_em       timestamptz not null default now()
);

create index if not exists custo_material_mes_idx on public.custo_material (mes_referencia);

-- ─── RLS: gestão (Administração/Direção/Master) lê e escreve ─────────────────
alter table public.custo_material enable row level security;
drop policy if exists custo_material_all on public.custo_material;
create policy custo_material_all on public.custo_material for all to authenticated
  using (public.app_perfil() in ('administracao','direcao','master'))
  with check (public.app_perfil() in ('administracao','direcao','master'));

-- ─── Storage — comprovantes (opcional) ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('custos-materiais-comprovantes', 'custos-materiais-comprovantes', true)
on conflict (id) do nothing;

drop policy if exists "custos_materiais_select" on storage.objects;
create policy "custos_materiais_select" on storage.objects for select
  using (bucket_id = 'custos-materiais-comprovantes');
drop policy if exists "custos_materiais_insert" on storage.objects;
create policy "custos_materiais_insert" on storage.objects for insert
  with check (bucket_id = 'custos-materiais-comprovantes');
drop policy if exists "custos_materiais_update" on storage.objects;
create policy "custos_materiais_update" on storage.objects for update
  using (bucket_id = 'custos-materiais-comprovantes');
drop policy if exists "custos_materiais_delete" on storage.objects;
create policy "custos_materiais_delete" on storage.objects for delete
  using (bucket_id = 'custos-materiais-comprovantes');

-- ─── Seed de teste (mês corrente) ───────────────────────────────────────────
insert into public.custo_material (id, categoria, descricao, valor, fornecedor, data, mes_referencia, registrado_por) values
  ('ca000000-0000-0000-0000-000000000001','limpeza','Produtos de limpeza (reposição do mês)',850.00,'Distribuidora Limpa Tudo', current_date, to_char(current_date,'YYYY-MM'),'Administração'),
  ('ca000000-0000-0000-0000-000000000002','manutencao','Materiais elétricos e hidráulicos',430.00,'Casa do Construtor', current_date, to_char(current_date,'YYYY-MM'),'Administração')
on conflict (id) do nothing;
