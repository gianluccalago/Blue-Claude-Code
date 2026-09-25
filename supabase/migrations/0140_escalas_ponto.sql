-- ===========================================================================
-- 0140 — ESCALAS E PONTO: integridade no banco (achados ESC-01/02/03).
-- ---------------------------------------------------------------------------
-- Até aqui as regras da escala viviam só no cliente (comparação de ISO como
-- texto, modal aceitando fim antes do início, ponto reaberto pelo próprio
-- checklist, ajuste manual sem rastro). Agora o banco garante:
--
--  1) fim > inicio (CHECK) e NENHUMA sobreposição de turnos da mesma
--     profissional (EXCLUDE USING gist, extensão btree_gist). Turnos VAGOS
--     (profissional_id nulo) não colidem entre si. Se o banco já tiver
--     sobreposições, a migration AVISA (warning) e não cria a exclusão — o
--     CHECK entra como NOT VALID e é validado se possível.
--  2) Ponto pela própria profissional (perfil que não é gestão): só pode
--     mudar check_in/check_out (e lat/lng/sem_gps do mesmo ponto) do SEU
--     turno, e nunca reabrir: check_in só quando nulo; check_out só com
--     check_in preenchido e check_out nulo. Qualquer outra coluna → erro.
--  3) Ajuste manual pela gestão/coordenação deixa RASTRO em turno_ajuste
--     (campo, valor anterior, novo, motivo, quem, quando — autoria pelo
--     servidor via app_usuario_id()). Alterar a escala (inicio/fim/data/
--     profissional/categoria/tag) de um turno JÁ INICIADO também é rastreado.
--     O motivo viaja na coluna transitória turnos.ajuste_motivo: o trigger
--     copia para o rastro e limpa — nunca fica gravado no turno.
--  4) check_in_sem_gps: marcador de check-in feito sem localização (GPS
--     negado/indisponível) para a coordenação ver. GPS não é prova; só registro.
--  5) Profissional INATIVA não pode ser designada num turno (insert/update
--     que troque o profissional_id).
--
-- Idempotente. Rode após a 0134.
-- ===========================================================================

create extension if not exists btree_gist;

-- ── 1 · Colunas novas ───────────────────────────────────────────────────────
alter table public.turnos add column if not exists check_in_sem_gps boolean not null default false;
alter table public.turnos add column if not exists ajuste_motivo text;
comment on column public.turnos.check_in_sem_gps is
  'Check-in registrado sem localização (GPS negado/indisponível). Informativo — GPS não é prova.';
comment on column public.turnos.ajuste_motivo is
  'Transitória: motivo do ajuste manual em curso. O trigger de rastro copia para turno_ajuste e limpa.';

-- ── 2 · fim > inicio e sem sobreposição por profissional ────────────────────
-- 2a. CHECK entra NOT VALID (nunca falha por dados antigos) e valida se der.
do $$
declare v_invertidos int;
begin
  if not exists (select 1 from pg_constraint where conname = 'turnos_fim_apos_inicio') then
    alter table public.turnos add constraint turnos_fim_apos_inicio check (fim > inicio) not valid;
  end if;
  select count(*) into v_invertidos from public.turnos where fim <= inicio;
  if v_invertidos > 0 then
    raise warning 'turnos: % turno(s) com fim <= inicio. CHECK turnos_fim_apos_inicio fica NOT VALID — corrija e rode: alter table turnos validate constraint turnos_fim_apos_inicio;', v_invertidos;
  elsif not (select convalidated from pg_constraint where conname = 'turnos_fim_apos_inicio') then
    alter table public.turnos validate constraint turnos_fim_apos_inicio;
  end if;
end $$;

-- 2b. EXCLUDE não aceita NOT VALID: só cria quando a escala atual está limpa
--     (sem turno invertido — o gist nem consegue montar o range — e sem
--     sobreposição). Turnos vagos (profissional_id nulo) nunca colidem.
do $$
declare v_sobrepostos int;
        v_invertidos int;
begin
  if exists (select 1 from pg_constraint where conname = 'turnos_sem_sobreposicao') then return; end if;
  select count(*) into v_invertidos from public.turnos where fim <= inicio;
  if v_invertidos > 0 then
    raise warning 'turnos: constraint turnos_sem_sobreposicao NÃO criada por haver turno com fim <= inicio — corrija e rode a 0140 de novo.';
    return;
  end if;
  select count(*) into v_sobrepostos
    from public.turnos a
    join public.turnos b
      on a.profissional_id = b.profissional_id and a.id < b.id
     and tstzrange(a.inicio, a.fim, '[)') && tstzrange(b.inicio, b.fim, '[)');
  if v_sobrepostos > 0 then
    raise warning 'turnos: % par(es) de turnos sobrepostos da mesma profissional. Constraint turnos_sem_sobreposicao NÃO criada — corrija a escala e rode a 0140 de novo.', v_sobrepostos;
    return;
  end if;
  alter table public.turnos add constraint turnos_sem_sobreposicao
    exclude using gist (profissional_id with =, tstzrange(inicio, fim, '[)') with &&);
end $$;

-- ── 3 · Rastro de ajustes ───────────────────────────────────────────────────
create table if not exists public.turno_ajuste (
  id uuid primary key default gen_random_uuid(),
  turno_id uuid not null references public.turnos(id) on delete cascade,
  campo text not null,
  de text,
  para text,
  motivo text,
  ajustado_por text,
  ajustado_por_id uuid references public.usuarios(id) on delete set null,
  ajustado_em timestamptz not null default now()
);
create index if not exists turno_ajuste_turno_idx on public.turno_ajuste (turno_id, ajustado_em desc);
comment on table public.turno_ajuste is
  'Rastro dos ajustes manuais de ponto/escala feitos pela gestão. Preenchida SÓ por trigger (autoria pelo servidor).';

alter table public.turno_ajuste enable row level security;
-- Leitura: gestão/coordenação e a própria profissional do turno. Escrita: só o trigger.
drop policy if exists turno_ajuste_sel on public.turno_ajuste;
create policy turno_ajuste_sel on public.turno_ajuste for select to authenticated
  using (
    coalesce(public.app_perfil() in ('master','direcao','administracao','coordenacao'), false)
    or exists (select 1 from public.turnos t where t.id = turno_id and t.profissional_id = public.app_usuario_id())
  );
revoke all on public.turno_ajuste from anon;
grant select on public.turno_ajuste to authenticated;

-- ── 4 · Triggers ────────────────────────────────────────────────────────────
-- Gestão = quem já pode escrever na escala pela policy turnos_wr_gestao.
create or replace function public.app_gestao_escala()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_perfil() in ('master','direcao','administracao','coordenacao'), false)
$$;
grant execute on function public.app_gestao_escala() to authenticated;

-- 4a. Profissional inativa não entra na escala (insert ou troca de profissional).
create or replace function public.fn_turnos_guarda_profissional()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.profissional_id is not null
     and (tg_op = 'INSERT' or new.profissional_id is distinct from old.profissional_id) then
    if not exists (select 1 from public.usuarios u
                    where u.id = new.profissional_id and u.ativo) then
      raise exception 'Profissional inativa não pode ser designada num turno.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_turnos_a_guarda_profissional on public.turnos;
create trigger trg_turnos_a_guarda_profissional before insert or update on public.turnos
  for each row execute function public.fn_turnos_guarda_profissional();

-- 4b. Ponto pela própria profissional: só o próprio ponto, sem reabrir.
create or replace function public.fn_turnos_guarda_ponto()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
  v_col text;
  v_entrada boolean := new.check_in is distinct from old.check_in;
  v_saida   boolean := new.check_out is distinct from old.check_out;
begin
  -- Sem JWT (SQL Editor, migrations, seeds) ou gestão: as regras abaixo não valem
  -- (a gestão ajusta, e o ajuste é rastreado pelo trigger de rastro).
  if coalesce(auth.jwt() ->> 'email', '') = '' or public.app_gestao_escala() then return new; end if;

  -- Só as colunas do ponto podem mudar (RLS já limita ao próprio turno).
  for v_col in select jsonb_object_keys(v_new) loop
    if (v_new -> v_col) is distinct from (v_old -> v_col)
       and v_col not in ('check_in','check_in_lat','check_in_lng','check_in_sem_gps',
                         'check_out','check_out_lat','check_out_lng') then
      raise exception 'Você só pode registrar o seu ponto neste turno (coluna "%" não pode ser alterada).', v_col;
    end if;
  end loop;

  -- Entrada: só uma vez (check_in nulo → preenchido); nunca apagar.
  if v_entrada then
    if old.check_in is not null then
      raise exception 'Entrada já registrada neste turno. Peça o ajuste à Coordenação.';
    end if;
    if new.check_in is null then
      raise exception 'A entrada não pode ser apagada.';
    end if;
  elsif (new.check_in_lat is distinct from old.check_in_lat)
     or (new.check_in_lng is distinct from old.check_in_lng)
     or (new.check_in_sem_gps is distinct from old.check_in_sem_gps) then
    raise exception 'A localização da entrada só é gravada junto com a entrada.';
  end if;

  -- Saída: só com entrada registrada e saída ainda vazia; nunca apagar.
  if v_saida then
    if new.check_in is null then
      raise exception 'Registre a entrada antes da saída.';
    end if;
    if old.check_out is not null then
      raise exception 'Saída já registrada neste turno. Peça o ajuste à Coordenação.';
    end if;
    if new.check_out is null then
      raise exception 'A saída não pode ser apagada.';
    end if;
  elsif (new.check_out_lat is distinct from old.check_out_lat)
     or (new.check_out_lng is distinct from old.check_out_lng) then
    raise exception 'A localização da saída só é gravada junto com a saída.';
  end if;

  return new;
end $$;
drop trigger if exists trg_turnos_b_guarda_ponto on public.turnos;
create trigger trg_turnos_b_guarda_ponto before update on public.turnos
  for each row execute function public.fn_turnos_guarda_ponto();

-- 4c. Rastro do ajuste pela gestão (ponto sempre; escala só de turno já iniciado).
create or replace function public.fn_turnos_rastro_ajuste()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nome text;
  v_uid uuid;
  v_new jsonb := to_jsonb(new);
  v_old jsonb := to_jsonb(old);
  v_col text;
  v_motivo text := nullif(btrim(coalesce(new.ajuste_motivo, '')), '');
begin
  -- A coluna transitória nunca fica gravada no turno.
  new.ajuste_motivo := null;

  if coalesce(auth.jwt() ->> 'email', '') = '' or not public.app_gestao_escala() then return new; end if;

  v_uid := public.app_usuario_id();
  select nome into v_nome from public.usuarios where id = v_uid;

  foreach v_col in array array['check_in','check_out'] loop
    if (v_new -> v_col) is distinct from (v_old -> v_col) then
      insert into public.turno_ajuste (turno_id, campo, de, para, motivo, ajustado_por, ajustado_por_id)
      values (new.id, v_col, v_old ->> v_col, v_new ->> v_col, v_motivo, v_nome, v_uid);
    end if;
  end loop;

  -- Turno já iniciado: mexer na escala também deixa rastro.
  if old.check_in is not null then
    foreach v_col in array array['profissional_id','categoria','data','inicio','fim','tag'] loop
      if (v_new -> v_col) is distinct from (v_old -> v_col) then
        insert into public.turno_ajuste (turno_id, campo, de, para, motivo, ajustado_por, ajustado_por_id)
        values (new.id, v_col, v_old ->> v_col, v_new ->> v_col, v_motivo, v_nome, v_uid);
      end if;
    end loop;
  end if;

  return new;
end $$;
drop trigger if exists trg_turnos_c_rastro_ajuste on public.turnos;
create trigger trg_turnos_c_rastro_ajuste before update on public.turnos
  for each row execute function public.fn_turnos_rastro_ajuste();

-- ── 5 · Verificação ─────────────────────────────────────────────────────────
do $$
begin
  raise notice '0140 ok: exclusão criada=%, check válido=%, triggers em turnos=%',
    exists (select 1 from pg_constraint where conname = 'turnos_sem_sobreposicao'),
    (select convalidated from pg_constraint where conname = 'turnos_fim_apos_inicio'),
    (select count(*) from pg_trigger where tgrelid = 'public.turnos'::regclass and not tgisinternal);
end $$;
