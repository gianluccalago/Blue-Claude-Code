-- ===========================================================================
-- 0147 — MÓDULO AUTONOMIA: preservar autonomia, mensurável em cada plano.
-- ---------------------------------------------------------------------------
-- 1) AVALIAÇÃO DE AUTONOMIA por domínio — médico, coordenação assistencial,
--    fisioterapia (perfil multidisciplinar) e nutrição. Cada item diz o que o
--    residente QUER fazer, o que CONSEGUE (sozinho / supervisão / ajuda
--    parcial / dependente), a preferência dele e se a equipe assume a tarefa
--    POR RAPIDEZ (ajuda por conveniência, não por necessidade). Rascunho
--    editável; assinada, não muda mais (nova avaliação = reavaliação).
--    Prazos (calculados no app, sem bloquear nada): 7 dias da admissão; quem
--    já estava na casa, 30 dias da ativação do módulo; reavaliação a cada 6
--    meses, quando o grau muda pela IVCF ou após intercorrência escalada ao
--    médico.
-- 2) OBJETIVOS FUNCIONAIS individualizados, acordados com residente/família,
--    revistos a cada 90 dias. A revisão exige o que foi OBSERVADO e o que o
--    RESIDENTE DISSE — é ela que "verifica" a autonomia no indicador.
-- 3) Tarefas do plano de cuidados podem apontar para o objetivo que apoiam.
--
-- Escrita: cada perfil escreve o SEU domínio (médico → médico; coordenação →
-- coordenação; multidisciplinar → fisio; nutricionista → nutrição); Master,
-- todos. Leitura: equipe interna (a cuidadora lê o resumo). Família: não.
-- Autoria (registrado_por/assinada_por/revisado_por/criado_por) gravada pelo
-- servidor. Idempotente. Rode após a 0146.
-- ===========================================================================

-- ── Domínio do perfil logado ────────────────────────────────────────────────
create or replace function public.app_autonomia_dominio()
returns text language sql stable security definer set search_path = public as $$
  select case public.app_perfil()
    when 'medico' then 'medico'
    when 'coordenacao' then 'coordenacao'
    when 'multidisciplinar' then 'fisio'
    when 'nutricionista' then 'nutricao'
  end
$$;
create or replace function public.app_autonomia_pode(p_dominio text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_perfil() = 'master' or public.app_autonomia_dominio() = p_dominio, false)
$$;
-- Qualquer um dos 4 perfis avaliadores (ou Master): objetivos e revisões são da equipe.
create or replace function public.app_autonomia_equipe()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_perfil() = 'master' or public.app_autonomia_dominio() is not null, false)
$$;
revoke all on function public.app_autonomia_dominio() from public, anon;
revoke all on function public.app_autonomia_pode(text) from public, anon;
revoke all on function public.app_autonomia_equipe() from public, anon;
grant execute on function public.app_autonomia_dominio() to authenticated;
grant execute on function public.app_autonomia_pode(text) to authenticated;
grant execute on function public.app_autonomia_equipe() to authenticated;

-- ── Ativação do módulo (base do prazo de quem já estava na casa) ────────────
create table if not exists public.autonomia_modulo (
  id         boolean primary key default true check (id),
  ativado_em date not null default current_date
);
insert into public.autonomia_modulo (id) values (true) on conflict (id) do nothing;
alter table public.autonomia_modulo enable row level security;
drop policy if exists autonomia_modulo_sel on public.autonomia_modulo;
create policy autonomia_modulo_sel on public.autonomia_modulo for select to authenticated
  using (public.app_equipe_interna());

-- ── 1 · Avaliação ───────────────────────────────────────────────────────────
create table if not exists public.autonomia_avaliacao (
  id             uuid primary key default gen_random_uuid(),
  residente_id   uuid not null references public.residentes(id) on delete cascade,
  dominio        text not null check (dominio in ('medico','coordenacao','fisio','nutricao')),
  motivo         text not null default 'entrada'
                 check (motivo in ('entrada','periodica','mudanca_grau','intercorrencia','outro')),
  -- { "<item>": { "quer": "sim|nao|as_vezes", "consegue": "sozinho|supervisao|ajuda_parcial|dependente",
  --               "preferencia": "...", "equipe_assume": true|false, "obs": "..." } }
  itens          jsonb not null default '{}'::jsonb check (jsonb_typeof(itens) = 'object'),
  sintese        text,
  assinada       boolean not null default false,
  assinada_em    timestamptz,
  assinada_por   text,
  registrado_por text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);
comment on table public.autonomia_avaliacao is
  'Avaliação de autonomia por domínio (médico, coordenação, fisio, nutrição): quer/consegue/preferência/equipe assume por rapidez. Assinada = imutável.';
create index if not exists idx_autonomia_avaliacao_res on public.autonomia_avaliacao (residente_id, dominio, assinada_em desc);
-- Um rascunho aberto por hóspede e domínio.
create unique index if not exists uq_autonomia_rascunho on public.autonomia_avaliacao (residente_id, dominio) where not assinada;

create or replace function public.fn_autonomia_avaliacao_guarda()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.assinada then raise exception 'Avaliação assinada não se apaga.'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if old.assinada then
      raise exception 'Avaliação assinada não se altera: registre uma reavaliação.';
    end if;
    if new.residente_id <> old.residente_id or new.dominio <> old.dominio then
      raise exception 'Hóspede e domínio da avaliação não mudam.';
    end if;
  end if;
  if new.assinada then
    if new.itens = '{}'::jsonb then
      raise exception 'Preencha ao menos um item antes de assinar.';
    end if;
    new.assinada_em := coalesce(new.assinada_em, now());
    new.assinada_por := coalesce(new.assinada_por, new.registrado_por, 'assinada');
  else
    new.assinada_em := null;
    new.assinada_por := null;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists trg_autonomia_avaliacao_guarda on public.autonomia_avaliacao;
create trigger trg_autonomia_avaliacao_guarda
  before insert or update or delete on public.autonomia_avaliacao
  for each row execute function public.fn_autonomia_avaliacao_guarda();

alter table public.autonomia_avaliacao enable row level security;
drop policy if exists autonomia_avaliacao_sel on public.autonomia_avaliacao;
drop policy if exists autonomia_avaliacao_ins on public.autonomia_avaliacao;
drop policy if exists autonomia_avaliacao_upd on public.autonomia_avaliacao;
drop policy if exists autonomia_avaliacao_del on public.autonomia_avaliacao;
create policy autonomia_avaliacao_sel on public.autonomia_avaliacao for select to authenticated
  using (public.app_equipe_interna());
create policy autonomia_avaliacao_ins on public.autonomia_avaliacao for insert to authenticated
  with check (public.app_autonomia_pode(dominio));
create policy autonomia_avaliacao_upd on public.autonomia_avaliacao for update to authenticated
  using (public.app_autonomia_pode(dominio)) with check (public.app_autonomia_pode(dominio));
create policy autonomia_avaliacao_del on public.autonomia_avaliacao for delete to authenticated
  using (public.app_autonomia_pode(dominio));

-- ── 2 · Objetivos funcionais ────────────────────────────────────────────────
create table if not exists public.autonomia_objetivo (
  id                    uuid primary key default gen_random_uuid(),
  residente_id          uuid not null references public.residentes(id) on delete cascade,
  dominio               text not null check (dominio in ('medico','coordenacao','fisio','nutricao')),
  avaliacao_id          uuid references public.autonomia_avaliacao(id) on delete set null,
  descricao             text not null check (length(trim(descricao)) > 0),
  meta                  text not null check (length(trim(meta)) > 0),
  responsavel           text,
  prazo_revisao         date not null default (current_date + 90),
  status                text not null default 'ativo' check (status in ('ativo','atingido','encerrado')),
  acordado_residente_em date,
  acordado_familia_em   date,
  criado_por            text,
  criado_em             timestamptz not null default now()
);
comment on table public.autonomia_objetivo is
  'Objetivo funcional individualizado (meta observável), acordado com residente/família e revisto a cada 90 dias.';
create index if not exists idx_autonomia_objetivo_res on public.autonomia_objetivo (residente_id, status);

create or replace function public.fn_autonomia_objetivo_guarda()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.residente_id <> old.residente_id then
    raise exception 'O hóspede do objetivo não muda.';
  end if;
  return new;
end $$;
drop trigger if exists trg_autonomia_objetivo_guarda on public.autonomia_objetivo;
create trigger trg_autonomia_objetivo_guarda before update on public.autonomia_objetivo
  for each row execute function public.fn_autonomia_objetivo_guarda();

alter table public.autonomia_objetivo enable row level security;
drop policy if exists autonomia_objetivo_sel on public.autonomia_objetivo;
drop policy if exists autonomia_objetivo_ins on public.autonomia_objetivo;
drop policy if exists autonomia_objetivo_upd on public.autonomia_objetivo;
create policy autonomia_objetivo_sel on public.autonomia_objetivo for select to authenticated
  using (public.app_equipe_interna());
create policy autonomia_objetivo_ins on public.autonomia_objetivo for insert to authenticated
  with check (public.app_autonomia_equipe());
create policy autonomia_objetivo_upd on public.autonomia_objetivo for update to authenticated
  using (public.app_autonomia_equipe()) with check (public.app_autonomia_equipe());
-- Sem DELETE: objetivo sai por status (atingido/encerrado), com histórico.

-- ── 2 · Revisões (registro imutável) ────────────────────────────────────────
create table if not exists public.autonomia_revisao (
  id              uuid primary key default gen_random_uuid(),
  objetivo_id     uuid not null references public.autonomia_objetivo(id) on delete cascade,
  observado       text not null check (length(trim(observado)) > 0),
  fala_residente  text not null check (length(trim(fala_residente)) > 0),
  resultado       text not null check (resultado in ('mantido','ajustado','atingido','encerrado')),
  participantes   text[] not null default array['equipe']
                  check (participantes <@ array['residente','familia','equipe']::text[] and cardinality(participantes) > 0),
  proxima_revisao date,
  revisado_por    text,
  revisado_em     timestamptz not null default now()
);
comment on table public.autonomia_revisao is
  'Revisão do objetivo: o que foi observado + o que o residente disse + resultado. É a verificação do indicador.';
create index if not exists idx_autonomia_revisao_obj on public.autonomia_revisao (objetivo_id, revisado_em desc);

-- A revisão atualiza o objetivo: status, próxima revisão e acordos.
create or replace function public.fn_autonomia_revisao_aplica()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.autonomia_objetivo o set
    status = case new.resultado when 'atingido' then 'atingido' when 'encerrado' then 'encerrado' else 'ativo' end,
    prazo_revisao = coalesce(new.proxima_revisao, current_date + 90),
    acordado_residente_em = case when 'residente' = any(new.participantes) then current_date else o.acordado_residente_em end,
    acordado_familia_em   = case when 'familia'   = any(new.participantes) then current_date else o.acordado_familia_em end
  where o.id = new.objetivo_id;
  return new;
end $$;
drop trigger if exists trg_autonomia_revisao_aplica on public.autonomia_revisao;
create trigger trg_autonomia_revisao_aplica after insert on public.autonomia_revisao
  for each row execute function public.fn_autonomia_revisao_aplica();

alter table public.autonomia_revisao enable row level security;
drop policy if exists autonomia_revisao_sel on public.autonomia_revisao;
drop policy if exists autonomia_revisao_ins on public.autonomia_revisao;
create policy autonomia_revisao_sel on public.autonomia_revisao for select to authenticated
  using (public.app_equipe_interna());
create policy autonomia_revisao_ins on public.autonomia_revisao for insert to authenticated
  with check (public.app_autonomia_equipe());
-- Sem UPDATE/DELETE: revisão é registro.

-- ── Autoria pelo servidor ───────────────────────────────────────────────────
do $$ declare t text;
begin
  foreach t in array array['autonomia_avaliacao','autonomia_objetivo','autonomia_revisao'] loop
    execute format('drop trigger if exists trg_autoria_servidor on public.%I;', t);
    execute format('create trigger trg_autoria_servidor before insert or update on public.%I for each row execute function public.fn_autoria_servidor();', t);
  end loop;
end $$;

-- ── 3 · Tarefa do plano → objetivo que ela apoia ────────────────────────────
alter table public.plano_cuidado_item
  add column if not exists objetivo_id uuid references public.autonomia_objetivo(id) on delete set null;
comment on column public.plano_cuidado_item.objetivo_id is
  'Objetivo funcional de autonomia que esta tarefa apoia (opcional; mesmo hóspede).';

create or replace function public.fn_plano_item_objetivo_mesmo_hospede()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.objetivo_id is not null and not exists (
    select 1 from public.autonomia_objetivo o where o.id = new.objetivo_id and o.residente_id = new.residente_id
  ) then
    raise exception 'O objetivo apoiado precisa ser do mesmo hóspede da tarefa.';
  end if;
  return new;
end $$;
drop trigger if exists trg_plano_item_objetivo on public.plano_cuidado_item;
create trigger trg_plano_item_objetivo before insert or update of objetivo_id on public.plano_cuidado_item
  for each row execute function public.fn_plano_item_objetivo_mesmo_hospede();
