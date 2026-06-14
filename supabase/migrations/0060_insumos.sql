-- ===========================================================================
-- 0060 — Insumos e contratos (Nutricionista, BLOCO N1)
-- ---------------------------------------------------------------------------
-- Cadastro de FORNECEDORES (prestadores com contrato) e INSUMOS (com custo
-- unitário de contrato), além do HISTÓRICO de preço (trilha quando o custo
-- muda). É a base que vai alimentar, nos próximos blocos: as fichas técnicas
-- de pratos (N2), o cálculo de cardápio e o valor estimado de desperdício.
--
-- Domínio da Nutricionista (escreve); gestão (Master/Administração/Direção) lê.
-- Idempotente.
-- ===========================================================================

create table if not exists public.fornecedor (
  id                 uuid primary key default gen_random_uuid(),
  nome               text not null,
  categoria_principal text not null,
  contato            text,
  ativo              boolean not null default true
);

create table if not exists public.insumo (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  categoria      text not null check (categoria in ('supermercado','hortifruti','carnes','panificacao')),
  unidade        text not null check (unidade in ('kg','g','L','ml','unidade','duzia','pacote')),
  custo_unitario numeric not null default 0,
  fornecedor_id  uuid references public.fornecedor(id) on delete set null,
  observacao     text,
  ativo          boolean not null default true,
  atualizado_em  timestamptz not null default now()
);

create table if not exists public.insumo_preco_historico (
  id             uuid primary key default gen_random_uuid(),
  insumo_id      uuid not null references public.insumo(id) on delete cascade,
  custo_unitario numeric not null,
  vigente_desde  date not null,
  registrado_em  timestamptz not null default now()
);

create index if not exists insumo_categoria_idx on public.insumo (categoria);
create index if not exists insumo_fornecedor_idx on public.insumo (fornecedor_id);
create index if not exists insumo_preco_hist_idx on public.insumo_preco_historico (insumo_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array['fornecedor','insumo','insumo_preco_historico'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists %I_select on public.%I;', t, t);
    execute format('drop policy if exists %I_write on public.%I;', t, t);
    -- LEITURA: Nutricionista + gestão (custos vão alimentar relatórios depois).
    execute format(
      'create policy %I_select on public.%I for select to authenticated '
      || 'using (public.app_perfil() in (''nutricionista'',''master'',''administracao'',''direcao''));', t, t);
    -- ESCRITA: Nutricionista (dona do cadastro) + Master.
    execute format(
      'create policy %I_write on public.%I for all to authenticated '
      || 'using (public.app_perfil() in (''nutricionista'',''master'')) '
      || 'with check (public.app_perfil() in (''nutricionista'',''master''));', t, t);
  end loop;
end $$;

-- ─── Seed: fornecedores + insumos plausíveis por categoria (idempotente) ─────
insert into public.fornecedor (id, nome, categoria_principal, contato) values
  ('d0000000-0000-0000-0000-000000000001','Atacadão Central','Supermercado','(41) 3333-1000'),
  ('d0000000-0000-0000-0000-000000000002','Hortifruti do Zé','Hortifruti','(41) 99888-2200'),
  ('d0000000-0000-0000-0000-000000000003','Frigorífico Boi Bom','Carnes','(41) 3333-4400'),
  ('d0000000-0000-0000-0000-000000000004','Padaria Pão Quente','Panificação','(41) 99777-3311')
on conflict (id) do nothing;

insert into public.insumo (id, nome, categoria, unidade, custo_unitario, fornecedor_id) values
  ('e0000000-0000-0000-0000-000000000001','Arroz branco tipo 1','supermercado','kg',6.50,'d0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002','Feijão carioca','supermercado','kg',8.90,'d0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000003','Óleo de soja','supermercado','L',9.20,'d0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000004','Café torrado e moído','supermercado','kg',32.00,'d0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000005','Banana prata','hortifruti','kg',5.50,'d0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000006','Tomate','hortifruti','kg',7.80,'d0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000007','Batata','hortifruti','kg',6.20,'d0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000008','Alface crespa','hortifruti','unidade',3.50,'d0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000009','Patinho moído','carnes','kg',36.00,'d0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000010','Peito de frango','carnes','kg',18.50,'d0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000011','Filé de tilápia','carnes','kg',39.00,'d0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000012','Ovos','carnes','duzia',11.00,'d0000000-0000-0000-0000-000000000003'),
  ('e0000000-0000-0000-0000-000000000013','Pão francês','panificacao','kg',14.00,'d0000000-0000-0000-0000-000000000004'),
  ('e0000000-0000-0000-0000-000000000014','Pão de forma','panificacao','pacote',8.50,'d0000000-0000-0000-0000-000000000004'),
  ('e0000000-0000-0000-0000-000000000015','Bolo simples','panificacao','unidade',22.00,'d0000000-0000-0000-0000-000000000004')
on conflict (id) do nothing;
