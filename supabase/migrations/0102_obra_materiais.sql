-- ===========================================================================
-- 0102 — MÓDULO OBRA · Fase 4: materiais (compra direta do Contratante).
-- ---------------------------------------------------------------------------
-- Cadeia: planejamento (lista da construtora, antecedência 45/60d) → cotações
-- (mín. 3 fornecedores) → ordens de compra (valor comprometido) → recebimentos
-- (conferência + foto; divergência sinaliza NC) → consumo (baixa por etapa/fase)
-- → perdas por categoria vs tolerância → proposta de GLOSA na medição do mês →
-- estoque de reposição (3% dos acabamentos por fase). Curva ABC dos itens.
--
-- Materiais são comprados DIRETO pelo Contratante — cotações, fornecedores,
-- OCs e glosa NÃO são visíveis ao prestador (RLS). O prestador só enxerga o
-- PLANEJAMENTO (lista dele). Tolerâncias de perda já semeadas na 0099.
-- Idempotente. Rode após a 0101.
-- ===========================================================================

-- Categorias válidas = chaves de obra_tolerancias_perdas (+ acabamentos p/ reposição).
-- (mantido como texto livre com CHECK para não travar itens fora da lista padrão)

-- ── 4.1 · Planejamento de materiais (lista da construtora) ──────────────────
create table if not exists public.obra_planejamento_materiais (
  id               uuid primary key default gen_random_uuid(),
  fase_id          uuid references public.obra_fases(id) on delete set null,
  categoria        text not null,          -- concreto/aco/blocos/ceramicos/tintas/demais
  item             text not null,
  unidade          text not null default 'un',
  quantidade_prevista numeric not null check (quantidade_prevista >= 0),
  data_necessidade date,                    -- quando precisa estar na obra
  antecedencia_dias int default 45,         -- 45/60d de antecedência para comprar
  observacao       text,
  registrado_por   text,
  criado_em        timestamptz not null default now()
);
comment on table public.obra_planejamento_materiais is
  'Lista de materiais da construtora (previsto). Base da compra do Contratante e do cálculo de perdas (consumo real × previsto). Alerta: item sem OC a 15 dias da necessidade.';
create index if not exists idx_obra_planmat_fase on public.obra_planejamento_materiais (fase_id, categoria);

-- ── 4.2 · Cotações (mín. 3 fornecedores por item relevante) ─────────────────
create table if not exists public.obra_cotacoes (
  id               uuid primary key default gen_random_uuid(),
  planejamento_id  uuid not null references public.obra_planejamento_materiais(id) on delete cascade,
  fornecedor       text not null,
  preco_unitario   numeric not null check (preco_unitario >= 0),
  prazo_entrega_dias int,
  validade         date,
  escolhida        boolean not null default false,
  observacao       text,
  registrado_por   text,
  criado_em        timestamptz not null default now()
);
comment on table public.obra_cotacoes is
  'Cotações por item do planejamento (histórico de preço unitário; mín. 3 fornecedores). escolhida = a que virou OC. Financeiro do Contratante: oculto ao prestador.';
create index if not exists idx_obra_cotacoes_plan on public.obra_cotacoes (planejamento_id);

-- ── 4.3 · Ordens de compra (valor comprometido) ────────────────────────────
create table if not exists public.obra_ordens_compra (
  id               uuid primary key default gen_random_uuid(),
  planejamento_id  uuid references public.obra_planejamento_materiais(id) on delete set null,
  cotacao_id       uuid references public.obra_cotacoes(id) on delete set null,
  fase_id          uuid references public.obra_fases(id) on delete set null,
  fornecedor       text not null,
  categoria        text not null,
  item             text not null,
  unidade          text not null default 'un',
  quantidade       numeric not null check (quantidade > 0),
  preco_unitario   numeric not null check (preco_unitario >= 0),
  valor_total      numeric not null,        -- snapshot = quantidade × preço (comprometido)
  status           text not null default 'Emitida'
                   check (status in ('Emitida','Entregue parcial','Entregue','Cancelada')),
  data_emissao     date not null default current_date,
  previsao_entrega date,
  observacao       text,
  registrado_por   text,
  criado_em        timestamptz not null default now()
);
comment on table public.obra_ordens_compra is
  'Ordens de compra do Contratante. Comprometido = Σ valor_total das OCs não canceladas. Alerta: OC sem entrega a X dias do prazo. Fornecedores/valores ocultos ao prestador.';
create index if not exists idx_obra_oc_fase on public.obra_ordens_compra (fase_id, categoria);

-- ── 4.4 · Recebimentos (conferência quantitativa + foto; divergência → NC) ──
create table if not exists public.obra_recebimentos (
  id                  uuid primary key default gen_random_uuid(),
  ordem_compra_id     uuid not null references public.obra_ordens_compra(id) on delete cascade,
  quantidade_recebida numeric not null check (quantidade_recebida >= 0),
  foto_url            text,                 -- foto da conferência
  divergencia         boolean not null default false,
  gera_nc             boolean not null default false,  -- alimenta o fluxo de NC (Fase 7)
  observacao          text,
  conferido_por       text,
  recebido_em         date not null default current_date,
  criado_em           timestamptz not null default now()
);
comment on table public.obra_recebimentos is
  'Conferência de recebimento (quantidade + foto). Divergência (qtd ≠ OC) sinaliza NC — que é tratada no módulo de não-conformidades (Fase 7).';
create index if not exists idx_obra_receb_oc on public.obra_recebimentos (ordem_compra_id);

-- ── 4.5 · Consumo (baixa por etapa/fase) ────────────────────────────────────
create table if not exists public.obra_consumo (
  id                  uuid primary key default gen_random_uuid(),
  fase_id             uuid references public.obra_fases(id) on delete set null,
  etapa_id            uuid references public.obra_etapas(id) on delete set null,
  categoria           text not null,
  item                text not null,
  unidade             text not null default 'un',
  quantidade_consumida numeric not null check (quantidade_consumida >= 0),
  data_consumo        date not null default current_date,
  observacao          text,
  registrado_por      text,
  criado_em           timestamptz not null default now()
);
comment on table public.obra_consumo is
  'Consumo real de material por etapa/fase. Comparado ao planejamento (previsto) por categoria para apurar perdas × tolerância → proposta de glosa.';
create index if not exists idx_obra_consumo_fase on public.obra_consumo (fase_id, categoria);

-- ── 4.6 · Estoque de reposição (3% dos acabamentos por fase) ────────────────
create table if not exists public.obra_estoque_reposicao (
  id             uuid primary key default gen_random_uuid(),
  fase_id        uuid references public.obra_fases(id) on delete set null,
  categoria      text not null,
  item           text not null,
  unidade        text not null default 'un',
  quantidade     numeric not null check (quantidade >= 0),
  entregue       boolean not null default false,
  entregue_em    date,
  observacao     text,
  registrado_por text,
  criado_em      timestamptz not null default now()
);
comment on table public.obra_estoque_reposicao is
  'Estoque de reposição (3% dos acabamentos) entregue ao fim de cada fase, com checklist de entrega.';
create index if not exists idx_obra_repo_fase on public.obra_estoque_reposicao (fase_id);

-- ── 4.7 · Auditoria ─────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['obra_planejamento_materiais','obra_cotacoes','obra_ordens_compra',
                           'obra_recebimentos','obra_consumo','obra_estoque_reposicao'] loop
    execute format('drop trigger if exists trg_audit_%s on public.%I', t, t);
    execute format('create trigger trg_audit_%s after insert or update or delete on public.%I
                    for each row execute function public.fn_obra_audit()', t, t);
  end loop;
end $$;

-- ── 4.8 · RLS ────────────────────────────────────────────────────────────────
-- Planejamento: prestador LÊ (lista dele). Cotações/OCs/recebimentos/consumo/
-- reposição: master/direção apenas (compra direta do Contratante, fornecedores
-- e valores ocultos ao prestador).

alter table public.obra_planejamento_materiais enable row level security;
drop policy if exists obra_planmat_select on public.obra_planejamento_materiais;
create policy obra_planmat_select on public.obra_planejamento_materiais for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_planmat_write on public.obra_planejamento_materiais;
create policy obra_planmat_write on public.obra_planejamento_materiais for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

do $$
declare t text;
begin
  foreach t in array array['obra_cotacoes','obra_ordens_compra','obra_recebimentos',
                           'obra_consumo','obra_estoque_reposicao'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %s_all on public.%I', t, t);
    execute format($f$create policy %s_all on public.%I for all to authenticated
                     using (public.app_perfil() in ('master','direcao'))
                     with check (public.app_perfil() in ('master','direcao'))$f$, t, t);
  end loop;
end $$;

-- Fim.
