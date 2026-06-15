-- ===========================================================================
-- 0070 — Controle de ENXOVAL da casa (Lavanderia INTERNA)
-- ---------------------------------------------------------------------------
-- Substitui o módulo antigo de rouparia "saldo em trânsito" (fazia sentido para
-- lavanderia TERCEIRIZADA). A lavanderia agora é interna (máquina industrial +
-- secador, um funcionário); o ciclo diário de lavagem e a roupa PESSOAL dos
-- hóspedes são resolvidos FORA do app (etiqueta/organização física).
--
-- O app passa a controlar o ENXOVAL/PATRIMÔNIO da casa (jogos de cama, toalhas,
-- cobertores…): quanto existe (total), quanto está limpo disponível na rouparia
-- (disponível) e quando repor (estoque mínimo). Movimentos registram entrada
-- (compra/reposição), baixa por perda/descarte (sai do patrimônio — documenta o
-- custo de reposição) e ajuste de inventário. Idempotente.
-- ===========================================================================

-- Remove o módulo antigo (dados de teste descartados).
drop table if exists public.rouparia_transito cascade;

create table if not exists public.enxoval (
  id                    uuid primary key default gen_random_uuid(),
  categoria             text not null check (categoria in
    ('roupa_cama','toalha_banho','toalha_rosto','cobertor_manta','fronha','outro')),
  descricao             text not null,
  quantidade_total      int not null default 0 check (quantidade_total >= 0),
  quantidade_disponivel int not null default 0 check (quantidade_disponivel >= 0),
  estoque_minimo        int not null default 0 check (estoque_minimo >= 0),
  observacao            text,
  atualizado_em         timestamptz not null default now()
);

create table if not exists public.enxoval_movimento (
  id             uuid primary key default gen_random_uuid(),
  enxoval_id     uuid not null references public.enxoval(id) on delete cascade,
  tipo           text not null check (tipo in ('entrada','baixa_perda','ajuste')),
  -- Peças movimentadas (ajuste pode ser negativo: delta da contagem de limpas).
  quantidade     int not null,
  motivo         text,
  registrado_por text,
  registrado_em  timestamptz not null default now()
);

create index if not exists enxoval_movimento_enxoval_idx on public.enxoval_movimento (enxoval_id, registrado_em desc);
create index if not exists enxoval_movimento_data_idx     on public.enxoval_movimento (registrado_em desc);

-- ─── RLS: registra/edita Lavanderia+Master; LÊ também Administração e Direção ─
alter table public.enxoval enable row level security;
alter table public.enxoval_movimento enable row level security;
drop policy if exists enxoval_select on public.enxoval;
drop policy if exists enxoval_write on public.enxoval;
drop policy if exists enxoval_mov_select on public.enxoval_movimento;
drop policy if exists enxoval_mov_write on public.enxoval_movimento;
create policy enxoval_select on public.enxoval for select to authenticated
  using (public.app_perfil() in ('lavanderia','administracao','direcao','master'));
create policy enxoval_write on public.enxoval for all to authenticated
  using (public.app_perfil() in ('lavanderia','master'))
  with check (public.app_perfil() in ('lavanderia','master'));
create policy enxoval_mov_select on public.enxoval_movimento for select to authenticated
  using (public.app_perfil() in ('lavanderia','administracao','direcao','master'));
create policy enxoval_mov_write on public.enxoval_movimento for all to authenticated
  using (public.app_perfil() in ('lavanderia','master'))
  with check (public.app_perfil() in ('lavanderia','master'));

-- ─── Seed de teste (um item ABAIXO do mínimo p/ validar o alerta) ────────────
insert into public.enxoval (id, categoria, descricao, quantidade_total, quantidade_disponivel, estoque_minimo) values
  ('e0000000-0000-0000-0000-000000000001','roupa_cama','Lençol casal branco',40,32,12),
  ('e0000000-0000-0000-0000-000000000002','roupa_cama','Lençol solteiro branco',50,16,20),   -- disponível < mínimo (alerta)
  ('e0000000-0000-0000-0000-000000000003','fronha','Fronha branca',80,64,24),
  ('e0000000-0000-0000-0000-000000000004','toalha_banho','Toalha de banho branca',90,70,30),
  ('e0000000-0000-0000-0000-000000000005','toalha_rosto','Toalha de rosto branca',70,52,24),
  ('e0000000-0000-0000-0000-000000000006','cobertor_manta','Cobertor casal cinza',25,21,8)
on conflict (id) do nothing;

-- Movimentos de teste (alimentam o resumo do mês: 5 peças baixadas por perda).
insert into public.enxoval_movimento (id, enxoval_id, tipo, quantidade, motivo, registrado_por) values
  ('ed000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000004','entrada',10,'compra/reposição','Marta Vasques'),
  ('ed000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001','baixa_perda',2,'peça danificada (rasgada)','Marta Vasques'),
  ('ed000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000002','baixa_perda',3,'extraviada','Marta Vasques')
on conflict (id) do nothing;
