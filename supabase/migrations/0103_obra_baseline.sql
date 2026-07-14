-- ===========================================================================
-- 0103 — MÓDULO OBRA · Fase 5: baseline orçamentário (financeiro consolidado).
-- ---------------------------------------------------------------------------
-- Baseline por PACOTE (MO por fase, projetos, materiais, fornecedores diretos,
-- ensaios, taxas). Os painéis (comprometido × realizado × projetado, curva S,
-- custo/m², contas a pagar, fluxo de caixa) agregam os dados já existentes
-- (medições, marcos, OCs) contra este orçado.
--
-- Financeiro do Contratante → master/direção apenas. Idempotente. Após a 0102.
-- ===========================================================================

create table if not exists public.obra_baseline (
  id           uuid primary key default gen_random_uuid(),
  pacote       text not null unique,        -- chave estável (mo_fase_1, projetos, materiais…)
  rotulo       text not null,
  grupo        text not null check (grupo in ('mo','projetos','materiais','fornecedores','ensaios','taxas')),
  valor_orcado numeric not null default 0,
  observacao   text,
  criado_em    timestamptz not null default now()
);
comment on table public.obra_baseline is
  'Baseline orçamentário por pacote. MO por fase e Projetos vêm do contrato (semeados); materiais/fornecedores/ensaios/taxas são preenchidos pelo master. Base dos painéis financeiros consolidados.';

-- Seed (uma vez): MO por fase (área × preço/m² do contrato) + Projetos (global)
-- + placeholders editáveis para os demais grupos.
do $$
declare
  v_preco numeric := coalesce((select valor::numeric from public.obra_config where chave = 'preco_m2_mo'), 914.66);
  v_proj  numeric := coalesce((select valor::numeric from public.obra_config where chave = 'projetos_valor_global'), 500000);
  f record;
begin
  if not exists (select 1 from public.obra_baseline) then
    for f in select numero, nome, modulos, area_m2 from public.obra_fases order by numero loop
      insert into public.obra_baseline (pacote, rotulo, grupo, valor_orcado)
      values ('mo_fase_' || f.numero,
              'MO — ' || f.nome || ' (' || f.modulos || ')',
              'mo',
              round(f.area_m2 * v_preco, 2));
    end loop;
    insert into public.obra_baseline (pacote, rotulo, grupo, valor_orcado) values
      ('projetos',            'Projetos complementares',       'projetos',     v_proj),
      ('materiais',           'Materiais (compra direta)',     'materiais',    0),
      ('fornecedores_diretos','Fornecedores diretos',          'fornecedores', 0),
      ('ensaios',             'Ensaios / controle tecnológico','ensaios',      0),
      ('taxas',               'Taxas e licenças',              'taxas',        0);
  end if;
end $$;

-- Auditoria + RLS (master/direção).
drop trigger if exists trg_audit_obra_baseline on public.obra_baseline;
create trigger trg_audit_obra_baseline after insert or update or delete on public.obra_baseline
  for each row execute function public.fn_obra_audit();

alter table public.obra_baseline enable row level security;
drop policy if exists obra_baseline_all on public.obra_baseline;
create policy obra_baseline_all on public.obra_baseline for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- Fim.
