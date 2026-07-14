-- ===========================================================================
-- 0107 — MÓDULO OBRA · Acompanhamento por % + galeria de fotos + custos indiretos.
-- ---------------------------------------------------------------------------
-- A) Execução vira REGISTRO DE ACOMPANHAMENTO: cada etapa tem um PERCENTUAL de
--    conclusão (0–100, editável) e pode acumular VÁRIAS fotos datadas ao longo
--    do tempo (tabela filha obra_checklist_foto). O avanço físico passa a ser
--    ponderado pelo %. A etapa fica "medível" no BM ao atingir 100% (dinheiro
--    da MO segue objetivo — só se mede etapa 100% concluída).
-- B) Custos indiretos (obra_custos_indiretos): engenheiro, software/assinaturas,
--    administrativo, taxas etc., com controle mensal (competência) — alimentam o
--    painel e o financeiro consolidado. master/direção.
-- Idempotente. Rode após a 0106.
-- ===========================================================================

-- ── A.1 · Percentual na etapa (mantém `concluido` sincronizado = % >= 100) ──
alter table public.obra_checklist_execucao
  add column if not exists percentual numeric not null default 0 check (percentual between 0 and 100);
-- Backfill: registros antigos concluídos = 100%.
update public.obra_checklist_execucao set percentual = 100 where concluido and percentual = 0;
-- Foto deixa de ser obrigatória na linha (as fotos vivem na tabela filha; um
-- registro pode ser só atualização de %).
alter table public.obra_checklist_execucao alter column foto_url drop not null;

-- ── A.2 · Galeria: várias fotos datadas por registro de acompanhamento ──────
create table if not exists public.obra_checklist_foto (
  id          uuid primary key default gen_random_uuid(),
  registro_id uuid not null references public.obra_checklist_execucao(id) on delete cascade,
  foto_url    text not null,               -- caminho no bucket (pasta checklist/)
  criado_em   timestamptz not null default now()
);
comment on table public.obra_checklist_foto is
  'Fotos de acompanhamento de um registro de execução. Várias por registro; a data vem do registro (registrado_em) e do criado_em. Evolução visual da etapa ao longo do tempo.';
create index if not exists idx_obra_checklist_foto_reg on public.obra_checklist_foto (registro_id);

drop trigger if exists trg_audit_obra_checklist_foto on public.obra_checklist_foto;
create trigger trg_audit_obra_checklist_foto after insert or update or delete on public.obra_checklist_foto
  for each row execute function public.fn_obra_audit();

alter table public.obra_checklist_foto enable row level security;
drop policy if exists obra_checklist_foto_select on public.obra_checklist_foto;
create policy obra_checklist_foto_select on public.obra_checklist_foto for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_checklist_foto_write on public.obra_checklist_foto;
create policy obra_checklist_foto_write on public.obra_checklist_foto for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- ── B.1 · Custos indiretos (controle mensal) ────────────────────────────────
create table if not exists public.obra_custos_indiretos (
  id             uuid primary key default gen_random_uuid(),
  competencia    text not null,            -- 'AAAA-MM'
  categoria      text not null,            -- engenharia / software / administrativo / taxas / financeiro / outros
  descricao      text not null,
  valor          numeric not null check (valor >= 0),
  recorrente     boolean not null default false,  -- custo mensal fixo (ex.: assinatura, honorário)
  observacao     text,
  registrado_por text,
  criado_em      timestamptz not null default now()
);
comment on table public.obra_custos_indiretos is
  'Custos indiretos da obra por competência mensal (engenheiro, assinaturas de software, administrativo, taxas, gastos gerais). Alimentam o painel e o financeiro consolidado. master/direção.';
create index if not exists idx_obra_custos_comp on public.obra_custos_indiretos (competencia);

drop trigger if exists trg_audit_obra_custos_indiretos on public.obra_custos_indiretos;
create trigger trg_audit_obra_custos_indiretos after insert or update or delete on public.obra_custos_indiretos
  for each row execute function public.fn_obra_audit();

alter table public.obra_custos_indiretos enable row level security;
drop policy if exists obra_custos_all on public.obra_custos_indiretos;
create policy obra_custos_all on public.obra_custos_indiretos for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- ── B.2 · Baseline: grupo 'indiretos' (para o financeiro consolidado) ───────
alter table public.obra_baseline drop constraint if exists obra_baseline_grupo_check;
alter table public.obra_baseline add constraint obra_baseline_grupo_check
  check (grupo in ('mo','projetos','materiais','fornecedores','ensaios','taxas','indiretos'));
insert into public.obra_baseline (pacote, rotulo, grupo, valor_orcado)
select 'indiretos', 'Custos indiretos', 'indiretos', 0
where not exists (select 1 from public.obra_baseline where pacote = 'indiretos');

-- Fim.
