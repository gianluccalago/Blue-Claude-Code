-- ===========================================================================
-- 0101 — MÓDULO OBRA · Fase 3: projetos complementares (Anexo III).
-- ---------------------------------------------------------------------------
-- R$ 500.000 global, pagos por DISCIPLINA em marcos:
--   padrão (valor > R$ 10.000): Início 25% → R00 40% → R01 25% → Retido 10%.
--   simplificado (valor ≤ R$ 10.000): Início 50% → Entrega 50%.
-- Cada disciplina inclui 2 revisões (alerta na 2ª). Multa 0,15%/dia, teto 10%.
-- Prazo com data-base (estrutural: laudo geotécnico + estudo de elevadores).
-- BIM: mínimo 3 rodadas + rodada final com IFC (compatibilização consolidada).
--
-- GATES de pagamento de marco (RPC, server-side): entrega do marco APROVADA +
-- ART da disciplina anexada; o marco "Retido" (10%) só libera após a
-- compatibilização final do BIM (rodada final com IFC).
--
-- As disciplinas (valores/prazos) já foram semeadas na 0099. Idempotente.
-- Rode após a 0100.
-- ===========================================================================

-- Campos da disciplina: ART, data-base do prazo e conclusão (para a multa).
alter table public.obra_disciplinas add column if not exists art_url text;
alter table public.obra_disciplinas add column if not exists data_base date;
alter table public.obra_disciplinas add column if not exists data_conclusao date;

-- ── 3.1 · Marcos de pagamento por disciplina ────────────────────────────────
create table if not exists public.obra_disciplina_marcos (
  id             uuid primary key default gen_random_uuid(),
  disciplina_id  uuid not null references public.obra_disciplinas(id) on delete cascade,
  ordem          int not null,
  chave          text not null check (chave in ('inicio','r00','r01','retido','entrega')),
  rotulo         text not null,
  percentual     numeric not null,
  valor          numeric not null,           -- snapshot = disciplina.valor × %/100
  exige_entrega  boolean not null default true, -- 'inicio' é adiantamento (não exige entrega)
  entrega_url    text,                        -- PDF/DWG da entrega do marco
  status         text not null default 'Pendente'
                 check (status in ('Pendente','Em análise','Aprovado','Reprovado','Pago')),
  motivo         text,
  data_aprovacao date,
  data_pagamento date,
  registrado_por text,
  criado_em      timestamptz not null default now(),
  unique (disciplina_id, ordem)
);
comment on table public.obra_disciplina_marcos is
  'Marcos de pagamento de cada disciplina de projeto. Pagar via RPC obra_pagar_marco (entrega aprovada + ART; o marco Retido exige a compatibilização final do BIM).';
create index if not exists idx_obra_marcos_disc on public.obra_disciplina_marcos (disciplina_id, ordem);

-- Semeia os marcos por disciplina conforme o valor (uma vez só).
do $$
declare d record;
begin
  if not exists (select 1 from public.obra_disciplina_marcos) then
    for d in select id, valor from public.obra_disciplinas loop
      if d.valor > 10000 then
        insert into public.obra_disciplina_marcos (disciplina_id, ordem, chave, rotulo, percentual, valor, exige_entrega) values
          (d.id, 1, 'inicio', 'Início',                  25, round(d.valor * 0.25, 2), false),
          (d.id, 2, 'r00',    'R00 aprovada',            40, round(d.valor * 0.40, 2), true),
          (d.id, 3, 'r01',    'R01 aprovada',            25, round(d.valor * 0.25, 2), true),
          (d.id, 4, 'retido', 'Retido (compatibilização)', 10, round(d.valor * 0.10, 2), true);
      else
        insert into public.obra_disciplina_marcos (disciplina_id, ordem, chave, rotulo, percentual, valor, exige_entrega) values
          (d.id, 1, 'inicio',  'Início',          50, round(d.valor * 0.50, 2), false),
          (d.id, 2, 'entrega', 'Entrega aprovada', 50, round(d.valor * 0.50, 2), true);
      end if;
    end loop;
  end if;
end $$;

-- ── 3.2 · Rodadas do BIM (mín. 3 + final com IFC) ───────────────────────────
create table if not exists public.obra_bim_rodadas (
  id             uuid primary key default gen_random_uuid(),
  numero         int not null,               -- 1, 2, 3, …
  final          boolean not null default false,
  relatorio_url  text,                        -- relatório de interferências
  ifc_url        text,                        -- modelo IFC (obrigatório na final)
  observacao     text,
  data_rodada    date not null default current_date,
  registrado_por text,
  criado_em      timestamptz not null default now()
);
comment on table public.obra_bim_rodadas is
  'Rodadas de compatibilização BIM. Mínimo 3 rodadas com relatório de interferências + rodada final com IFC. A final consolidada libera o marco Retido das disciplinas.';
create index if not exists idx_obra_bim_num on public.obra_bim_rodadas (numero);

-- ── 3.3 · RPC: pagar marco (gate entrega aprovada + ART + BIM final p/ retido) ─
create or replace function public.obra_pagar_marco(p_marco_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mk  public.obra_disciplina_marcos%rowtype;
  d   public.obra_disciplinas%rowtype;
  n_marcos int;
  n_pagos  int;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a pagar marcos de projeto.';
  end if;
  select * into mk from public.obra_disciplina_marcos where id = p_marco_id;
  if not found then raise exception 'Marco não encontrado.'; end if;
  select * into d from public.obra_disciplinas where id = mk.disciplina_id;

  if mk.status <> 'Aprovado' then
    raise exception 'A entrega do marco precisa estar Aprovada antes do pagamento (status: %).', mk.status;
  end if;
  if coalesce(d.art_url, '') = '' then
    raise exception 'Anexe a ART da disciplina "%" antes de pagar.', d.nome;
  end if;
  -- O marco Retido só libera após a compatibilização final do BIM (rodada final com IFC).
  if mk.chave = 'retido' and not exists (
    select 1 from public.obra_bim_rodadas where final and coalesce(ifc_url,'') <> ''
  ) then
    raise exception 'O valor retido só é liberado após a compatibilização final do BIM (rodada final com IFC).';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('obra_marco:' || d.id::text, 0));
  update public.obra_disciplina_marcos
     set status = 'Pago', data_pagamento = current_date
   where id = p_marco_id;

  -- Se todos os marcos da disciplina foram pagos, conclui a disciplina.
  select count(*), count(*) filter (where status = 'Pago')
    into n_marcos, n_pagos
  from public.obra_disciplina_marcos where disciplina_id = d.id;
  if n_marcos = n_pagos then
    update public.obra_disciplinas
       set status = 'Concluído', data_conclusao = coalesce(data_conclusao, current_date)
     where id = d.id;
  end if;
end;
$$;
grant execute on function public.obra_pagar_marco(uuid) to authenticated;

-- ── 3.4 · Auditoria ─────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['obra_disciplina_marcos','obra_bim_rodadas'] loop
    execute format('drop trigger if exists trg_audit_%s on public.%I', t, t);
    execute format('create trigger trg_audit_%s after insert or update or delete on public.%I
                    for each row execute function public.fn_obra_audit()', t, t);
  end loop;
end $$;

-- ── 3.5 · RLS ────────────────────────────────────────────────────────────────
-- master/direcao: total. obra_prestador: LÊ marcos e rodadas BIM (transparência
-- do próprio fluxo/entregas). Valores das disciplinas continuam ocultos ao
-- prestador (obra_disciplinas segue master/direção — política da 0099).

alter table public.obra_disciplina_marcos enable row level security;
drop policy if exists obra_marcos_select on public.obra_disciplina_marcos;
create policy obra_marcos_select on public.obra_disciplina_marcos for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_marcos_write on public.obra_disciplina_marcos;
create policy obra_marcos_write on public.obra_disciplina_marcos for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_bim_rodadas enable row level security;
drop policy if exists obra_bim_select on public.obra_bim_rodadas;
create policy obra_bim_select on public.obra_bim_rodadas for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_bim_write on public.obra_bim_rodadas;
create policy obra_bim_write on public.obra_bim_rodadas for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- Fim.
