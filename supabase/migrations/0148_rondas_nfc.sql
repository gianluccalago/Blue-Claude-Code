-- ===========================================================================
-- 0148 — RONDAS COM CHECK-IN NFC (tags NTAG213).
-- ---------------------------------------------------------------------------
-- Objetivo: comprovar que ALGUÉM esteve dentro do quarto, em horário do
-- SERVIDOR, a partir de um tablet cadastrado. Não comprova a qualidade do
-- cuidado: o checklist é declaratório (só seleção) e assim aparece no painel.
--
-- 1) QUARTO e LEITO viram tabelas. O hóspede ganha leito_id, mantido em
--    sincronia com o texto que já existe (residentes.quarto, ex. "1206B")
--    por trigger — admissão, hotelaria e mapa continuam iguais.
-- 2) nfc_tags (uma por quarto): uid, quarto, last_counter, ativa, observação.
-- 3) devices: tablets cadastrados (token guardado só como hash SHA-256).
-- 4) ronda_config por hóspede (plano de cuidados): intervalo, tolerância,
--    turnos. ronda_parametros: plausibilidade (segundos entre quartos).
-- 5) ronda_leitura (cada toque, inclusive os REJEITADOS) e ronda (uma por
--    hóspede do quarto, com o checklist).
-- 6) registrar_leitura_nfc: só a Edge Function "verify-round" (service_role)
--    chama. Rejeita: dispositivo não cadastrado/revogado, usuário inválido,
--    payload inválido, UID divergente, tag desconhecida/inativa, contador
--    repetido ou menor. Sinaliza (sem bloquear): uid_nao_confirmado,
--    leituras_nao_registradas (salto de contador), plausibilidade,
--    sincronizado_tarde, sem_plantao, possivel_forjada.
-- Reversão: supabase/rollback/0148_rondas_nfc_down.sql. Rode após a 0147.
-- ===========================================================================

-- ── 1 · Quarto e leito ──────────────────────────────────────────────────────
create table if not exists public.quarto (
  id        uuid primary key default gen_random_uuid(),
  codigo    text not null unique check (codigo ~ '^[0-9]{4}$'),
  modulo    integer,
  andar     integer,
  ativo     boolean not null default true,
  criado_em timestamptz not null default now()
);
create table if not exists public.leito (
  id        uuid primary key default gen_random_uuid(),
  quarto_id uuid not null references public.quarto(id) on delete cascade,
  letra     text not null check (letra in ('A','B','C')),
  codigo    text not null unique,
  unique (quarto_id, letra)
);
alter table public.residentes add column if not exists leito_id uuid references public.leito(id) on delete set null;
comment on column public.residentes.leito_id is 'Leito (e, por ele, o quarto) — sincronizado com residentes.quarto pela trigger trg_residente_leito.';

-- "1206B" → leito 1206B do quarto 1206 (cria quarto/leito se faltar).
create or replace function public.fn_leito_do_texto(p_quarto text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  m text[];
  v_cod text;
  v_letra text;
  v_q uuid;
  v_l uuid;
begin
  if p_quarto is null then return null; end if;
  m := regexp_match(upper(trim(p_quarto)), '^([0-9])([0-9])([0-9]{2})\s*([A-C])?$');
  if m is null then return null; end if;
  v_cod := m[1] || m[2] || m[3];
  v_letra := coalesce(m[4], 'A');
  insert into public.quarto (codigo, modulo, andar) values (v_cod, m[1]::int, m[2]::int) on conflict (codigo) do nothing;
  select id into v_q from public.quarto where codigo = v_cod;
  insert into public.leito (quarto_id, letra, codigo) values (v_q, v_letra, v_cod || v_letra) on conflict (codigo) do nothing;
  select id into v_l from public.leito where codigo = v_cod || v_letra;
  return v_l;
end $$;

create or replace function public.fn_residente_leito()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.leito_id := public.fn_leito_do_texto(new.quarto);
  return new;
end $$;
drop trigger if exists trg_residente_leito on public.residentes;
create trigger trg_residente_leito before insert or update of quarto on public.residentes
  for each row execute function public.fn_residente_leito();
update public.residentes set leito_id = public.fn_leito_do_texto(quarto) where quarto is not null;

create or replace view public.v_residente_leito with (security_invoker = true) as
  select r.id as residente_id, r.nome, r.status_hospede, l.id as leito_id, l.codigo as leito,
         q.id as quarto_id, q.codigo as quarto
    from public.residentes r
    left join public.leito l on l.id = r.leito_id
    left join public.quarto q on q.id = l.quarto_id;

alter table public.quarto enable row level security;
alter table public.leito enable row level security;
drop policy if exists quarto_sel on public.quarto;
drop policy if exists leito_sel on public.leito;
create policy quarto_sel on public.quarto for select to authenticated using (public.app_equipe_interna());
create policy leito_sel on public.leito for select to authenticated using (public.app_equipe_interna());
-- Escrita só pelas funções (trigger do hóspede e cadastro de tag).

-- ── 2 · Tags ────────────────────────────────────────────────────────────────
create table if not exists public.nfc_tags (
  id             uuid primary key default gen_random_uuid(),
  uid            text not null unique check (uid ~ '^[0-9A-F]{14}$'),
  quarto_id      uuid not null references public.quarto(id),
  last_counter   integer,
  ativa          boolean not null default true,
  observacao     text,
  cadastrada_por text,
  criada_em      timestamptz not null default now(),
  atualizada_em  timestamptz not null default now()
);
alter table public.nfc_tags enable row level security;
drop policy if exists nfc_tags_sel on public.nfc_tags;
-- Leitura pela equipe interna: o tablet monta o mapa tag→quarto para a ronda offline.
create policy nfc_tags_sel on public.nfc_tags for select to authenticated using (public.app_equipe_interna());

-- ── 3 · Tablets cadastrados ─────────────────────────────────────────────────
create table if not exists public.devices (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(trim(nome)) > 0),
  ativo          boolean not null default true,
  token_hash     text not null unique,
  cadastrado_por text,
  criado_em      timestamptz not null default now(),
  revogado_em    timestamptz,
  revogado_por   text,
  ultimo_uso_em  timestamptz
);
alter table public.devices enable row level security;
drop policy if exists devices_sel on public.devices;
create policy devices_sel on public.devices for select to authenticated
  using (coalesce(public.app_perfil() in ('master','coordenacao'), false));

-- ── 4 · Configuração ────────────────────────────────────────────────────────
create table if not exists public.ronda_parametros (
  id                      boolean primary key default true check (id),
  plausibilidade_segundos integer not null default 30 check (plausibilidade_segundos between 0 and 600),
  atualizado_por          text,
  atualizado_em           timestamptz not null default now()
);
insert into public.ronda_parametros (id) values (true) on conflict (id) do nothing;

create table if not exists public.ronda_config (
  residente_id   uuid primary key references public.residentes(id) on delete cascade,
  ativa          boolean not null default true,
  intervalo_min  integer not null default 120 check (intervalo_min between 30 and 480),
  tolerancia_min integer not null default 30 check (tolerancia_min between 0 and 240),
  turnos         text not null default 'noturno' check (turnos in ('noturno','ambos')),
  atualizado_por text,
  atualizado_em  timestamptz not null default now()
);

alter table public.ronda_parametros enable row level security;
alter table public.ronda_config enable row level security;
drop policy if exists ronda_parametros_sel on public.ronda_parametros;
drop policy if exists ronda_parametros_upd on public.ronda_parametros;
drop policy if exists ronda_config_sel on public.ronda_config;
drop policy if exists ronda_config_wr on public.ronda_config;
create policy ronda_parametros_sel on public.ronda_parametros for select to authenticated using (public.app_equipe_interna());
create policy ronda_parametros_upd on public.ronda_parametros for update to authenticated
  using (coalesce(public.app_perfil() in ('master','coordenacao'), false))
  with check (coalesce(public.app_perfil() in ('master','coordenacao'), false));
create policy ronda_config_sel on public.ronda_config for select to authenticated using (public.app_equipe_interna());
create policy ronda_config_wr on public.ronda_config for all to authenticated
  using (coalesce(public.app_perfil() in ('master','coordenacao'), false))
  with check (coalesce(public.app_perfil() in ('master','coordenacao'), false));

-- ── 5 · Leituras e rondas ───────────────────────────────────────────────────
create table if not exists public.ronda_leitura (
  id                       uuid primary key default gen_random_uuid(),
  tag_id                   uuid references public.nfc_tags(id),
  tag_uid                  text,
  quarto_id                uuid references public.quarto(id),
  contador                 integer,
  device_id                uuid references public.devices(id),
  cuidador_id              uuid references public.usuarios(id),
  cuidador_nome            text,
  servidor_em              timestamptz not null default now(),
  capturado_em_dispositivo timestamptz,
  sincronizado_tarde       boolean not null default false,
  status_validacao         text not null check (status_validacao in (
    'valida','rejeitada_payload','rejeitada_uid_divergente','rejeitada_tag_desconhecida','rejeitada_tag_inativa',
    'rejeitada_contador_repetido','rejeitada_contador_menor','rejeitada_dispositivo','rejeitada_usuario')),
  flags                    text[] not null default '{}',
  implementacao            text,
  revisada_em              timestamptz,
  revisada_por             text,
  revisao_nota             text
);
comment on column public.ronda_leitura.capturado_em_dispositivo is 'Relógio do tablet — só informativo, NUNCA usado como horário da ronda.';
create index if not exists idx_ronda_leitura_tag on public.ronda_leitura (tag_id, contador);
create index if not exists idx_ronda_leitura_cuid on public.ronda_leitura (cuidador_id, servidor_em desc);
create index if not exists idx_ronda_leitura_quarto on public.ronda_leitura (quarto_id, servidor_em desc);
create unique index if not exists uq_ronda_leitura_contador_valido on public.ronda_leitura (tag_id, contador) where status_validacao = 'valida';

create table if not exists public.ronda (
  id            uuid primary key default gen_random_uuid(),
  leitura_id    uuid not null references public.ronda_leitura(id) on delete cascade,
  residente_id  uuid not null references public.residentes(id) on delete cascade,
  quarto_id     uuid not null references public.quarto(id),
  cuidador_id   uuid references public.usuarios(id),
  servidor_em   timestamptz not null,
  checklist     jsonb,
  checklist_em  timestamptz,
  flags         text[] not null default '{}',
  unique (leitura_id, residente_id)
);
create index if not exists idx_ronda_residente on public.ronda (residente_id, servidor_em desc);

alter table public.ronda_leitura enable row level security;
alter table public.ronda enable row level security;
drop policy if exists ronda_leitura_sel on public.ronda_leitura;
drop policy if exists ronda_sel on public.ronda;
-- Leituras (com as sinalizações): gestão assistencial vê tudo; a cuidadora, as dela.
create policy ronda_leitura_sel on public.ronda_leitura for select to authenticated
  using (coalesce(public.app_perfil() in ('master','coordenacao','direcao','enfermeira','enfermagem'), false)
         or cuidador_id = public.app_usuario_id());
-- Rondas por hóspede: equipe clínica (a cuidadora precisa ver a última ronda do quarto).
create policy ronda_sel on public.ronda for select to authenticated using (public.app_equipe_clinica());
-- Sem INSERT/UPDATE/DELETE diretos: só pelas funções abaixo.

-- ── 6 · Checklist (só seleção) e intercorrência gerada pela ronda ──────────
create or replace function public.fn_aplicar_checklist_ronda(p_leitura uuid, p_checklist jsonb, p_nome text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_res record;
  v_item jsonb;
  v_n integer := 0;
  v_quarto text;
  v_tipo text;
begin
  if p_checklist is null or jsonb_typeof(p_checklist) <> 'object' then return 0; end if;
  select q.codigo into v_quarto from public.ronda_leitura l join public.quarto q on q.id = l.quarto_id where l.id = p_leitura;
  for v_res in select * from public.ronda where leitura_id = p_leitura and checklist is null loop
    v_item := p_checklist -> v_res.residente_id::text;
    if v_item is null or jsonb_typeof(v_item) <> 'object' then continue; end if;
    update public.ronda set checklist = v_item, checklist_em = now() where id = v_res.id;
    v_n := v_n + 1;
    v_tipo := v_item ->> 'intercorrencia';
    if v_tipo is not null and v_tipo <> 'nao' then
      insert into public.intercorrencia (residente_id, tipo, observacao, registrado_por)
      values (v_res.residente_id, v_tipo, 'Registrada na ronda NFC do quarto ' || coalesce(v_quarto, '?'), p_nome);
    end if;
  end loop;
  return v_n;
end $$;
revoke all on function public.fn_aplicar_checklist_ronda(uuid, jsonb, text) from public, anon, authenticated;

-- Checklist enviado depois da leitura (fluxo online): pela própria cuidadora.
create or replace function public.registrar_checklist_ronda(p_leitura uuid, p_checklist jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_l record;
  v_nome text;
begin
  select * into v_l from public.ronda_leitura where id = p_leitura;
  if not found or v_l.status_validacao <> 'valida' then raise exception 'Leitura inexistente ou recusada.'; end if;
  if v_l.cuidador_id is distinct from public.app_usuario_id()
     and coalesce(public.app_perfil(), '') not in ('master','coordenacao') then
    raise exception 'Só quem fez a leitura registra o checklist.' using errcode = '42501';
  end if;
  if v_l.servidor_em < now() - interval '2 hours' then
    raise exception 'Checklist fora do prazo (até 2 h depois da leitura).';
  end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  return public.fn_aplicar_checklist_ronda(p_leitura, p_checklist, v_nome);
end $$;
revoke all on function public.registrar_checklist_ronda(uuid, jsonb) from public, anon;
grant execute on function public.registrar_checklist_ronda(uuid, jsonb) to authenticated;

-- ── 7 · Registro da leitura (só a Edge Function, com service_role) ─────────
create or replace function public.registrar_leitura_nfc(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_user record;
  v_dev record;
  v_tag record;
  v_status text := 'valida';
  v_flags text[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'flags', '[]'::jsonb))), '{}');
  v_ctr integer := nullif(p ->> 'contador', '')::integer;
  v_offline boolean := coalesce((p ->> 'offline')::boolean, false);
  v_leitura uuid;
  v_ant record;
  v_plaus integer;
  v_residentes jsonb := '[]'::jsonb;
  v_quarto text;
begin
  -- Quem: usuário ativo, com acesso, de perfil assistencial.
  select id, nome into v_user from public.usuarios
   where lower(email) = lower(coalesce(p ->> 'email', '')) and ativo and not coalesce(sem_acesso, false)
     and perfil in ('cuidador','enfermagem','enfermeira','coordenacao','master')
   limit 1;
  -- Onde: tablet cadastrado e ativo.
  select * into v_dev from public.devices where token_hash = coalesce(p ->> 'device_token_hash', '');
  -- Qual tag (travada até o fim da transação: duas leituras simultâneas da
  -- mesma tag ficam em fila e a segunda vê o contador atualizado). Buscada
  -- já aqui para que até as leituras recusadas registrem tag e quarto.
  select * into v_tag from public.nfc_tags where uid = upper(coalesce(p ->> 'tag_uid', '')) for update;

  if v_dev.id is null or not v_dev.ativo then
    v_status := 'rejeitada_dispositivo';
    if v_dev.id is not null then v_flags := array_append(v_flags, 'dispositivo_revogado'); end if;
  elsif v_user.id is null then
    v_status := 'rejeitada_usuario';
  elsif not coalesce((p ->> 'valida')::boolean, false) then
    v_status := case p ->> 'motivo' when 'uid_divergente' then 'rejeitada_uid_divergente' else 'rejeitada_payload' end;
  else
    if v_tag.id is null then
      v_status := 'rejeitada_tag_desconhecida';
    elsif not v_tag.ativa then
      v_status := 'rejeitada_tag_inativa';
    elsif v_ctr is null then
      v_status := 'rejeitada_payload';
    elsif v_tag.last_counter is not null and v_ctr <= v_tag.last_counter then
      v_status := case
        when v_ctr = v_tag.last_counter
          or exists (select 1 from public.ronda_leitura r where r.tag_id = v_tag.id and r.contador = v_ctr and r.status_validacao = 'valida')
        then 'rejeitada_contador_repetido' else 'rejeitada_contador_menor' end;
      -- Leitura FÍSICA (número de série confirmado) recusada por contador já
      -- usado: as leituras válidas sem número de série confirmado com contador
      -- >= este são suspeitas de terem sido forjadas antes (URL editada).
      if not ('uid_nao_confirmado' = any(v_flags)) then
        update public.ronda_leitura r set flags = array_append(r.flags, 'possivel_forjada')
         where r.tag_id = v_tag.id and r.status_validacao = 'valida' and r.contador >= v_ctr
           and 'uid_nao_confirmado' = any(r.flags) and not ('possivel_forjada' = any(r.flags));
      end if;
    else
      if v_tag.last_counter is not null and v_ctr > v_tag.last_counter + 1 then
        v_flags := array_append(v_flags, 'leituras_nao_registradas');
      end if;
      update public.nfc_tags set last_counter = v_ctr, atualizada_em = now() where id = v_tag.id;
    end if;
  end if;

  if v_status = 'valida' then
    if v_offline then
      v_flags := array_append(v_flags, 'sincronizado_tarde');
    else
      -- Plausibilidade: a mesma pessoa em OUTRO quarto há menos de X segundos.
      select plausibilidade_segundos into v_plaus from public.ronda_parametros;
      select * into v_ant from public.ronda_leitura r
       where r.cuidador_id = v_user.id and r.status_validacao = 'valida' and not r.sincronizado_tarde
       order by r.servidor_em desc limit 1;
      if v_ant.id is not null and v_ant.quarto_id <> v_tag.quarto_id
         and now() - v_ant.servidor_em < make_interval(secs => coalesce(v_plaus, 30)) then
        v_flags := array_append(v_flags, 'plausibilidade');
      end if;
    end if;
    -- Fora de plantão escalado (tolerância de 10 min nas pontas).
    if not exists (select 1 from public.turnos t where t.profissional_id = v_user.id
                     and now() between t.inicio - interval '10 minutes' and t.fim + interval '10 minutes') then
      v_flags := array_append(v_flags, 'sem_plantao');
    end if;
  end if;

  insert into public.ronda_leitura (tag_id, tag_uid, quarto_id, contador, device_id, cuidador_id, cuidador_nome,
                                    capturado_em_dispositivo, sincronizado_tarde, status_validacao, flags, implementacao)
  values (v_tag.id, upper(nullif(p ->> 'tag_uid', '')), v_tag.quarto_id, v_ctr, v_dev.id, v_user.id, v_user.nome,
          nullif(p ->> 'capturado_em', '')::timestamptz, v_offline and v_status = 'valida', v_status,
          (select coalesce(array_agg(distinct f), '{}') from unnest(v_flags) f), p ->> 'implementacao')
  returning id into v_leitura;

  if v_dev.id is not null and v_dev.ativo then
    update public.devices set ultimo_uso_em = now() where id = v_dev.id;
  end if;

  if v_status = 'valida' then
    insert into public.ronda (leitura_id, residente_id, quarto_id, cuidador_id, servidor_em, flags)
    select v_leitura, r.id, v_tag.quarto_id, v_user.id, now(),
           (select coalesce(array_agg(distinct f), '{}') from unnest(v_flags) f)
      from public.residentes r join public.leito l on l.id = r.leito_id
     where l.quarto_id = v_tag.quarto_id and r.status_hospede = 'ativo';
    perform public.fn_aplicar_checklist_ronda(v_leitura, p -> 'checklist', v_user.nome);
    select q.codigo into v_quarto from public.quarto q where q.id = v_tag.quarto_id;
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'nome', r.nome, 'leito', l.codigo) order by l.codigo), '[]'::jsonb)
      into v_residentes
      from public.residentes r join public.leito l on l.id = r.leito_id
     where l.quarto_id = v_tag.quarto_id and r.status_hospede = 'ativo';
  end if;

  return jsonb_build_object(
    'ok', v_status = 'valida',
    'status', v_status,
    'flags', (select coalesce(to_jsonb(array_agg(distinct f)), '[]'::jsonb) from unnest(v_flags) f),
    'leitura_id', v_leitura,
    'quarto', v_quarto,
    'residentes', v_residentes,
    'servidor_em', now()
  );
end $$;
revoke all on function public.registrar_leitura_nfc(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_leitura_nfc(jsonb) to service_role;

-- ── 8 · Administração (Master e Coordenação) ────────────────────────────────
create or replace function public.app_gestor_rondas() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_perfil() in ('master','coordenacao'), false)
$$;
revoke all on function public.app_gestor_rondas() from public, anon;
grant execute on function public.app_gestor_rondas() to authenticated;

-- Cadastra (ou re-vincula) a tag lida no tablet a um quarto. O contador lido
-- no cadastro vira o piso: a próxima leitura válida precisa ser maior.
create or replace function public.cadastrar_tag_nfc(p_uid text, p_quarto text, p_contador integer, p_observacao text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_leito uuid;
  v_quarto uuid;
  v_id uuid;
  v_nome text;
begin
  if not public.app_gestor_rondas() then raise exception 'Somente Master ou Coordenação cadastram tags.' using errcode = '42501'; end if;
  if upper(coalesce(p_uid, '')) !~ '^[0-9A-F]{14}$' then raise exception 'UID inválido (esperado 14 caracteres hexadecimais).'; end if;
  v_leito := public.fn_leito_do_texto(p_quarto);
  if v_leito is null then raise exception 'Quarto inválido (ex.: 1206).'; end if;
  select quarto_id into v_quarto from public.leito where id = v_leito;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  insert into public.nfc_tags (uid, quarto_id, last_counter, observacao, cadastrada_por)
  values (upper(p_uid), v_quarto, p_contador, nullif(trim(coalesce(p_observacao, '')), ''), v_nome)
  on conflict (uid) do update set
    quarto_id = excluded.quarto_id,
    ativa = true,
    observacao = coalesce(excluded.observacao, public.nfc_tags.observacao),
    last_counter = greatest(coalesce(public.nfc_tags.last_counter, -1), coalesce(excluded.last_counter, -1)),
    atualizada_em = now()
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.definir_tag_ativa(p_id uuid, p_ativa boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.app_gestor_rondas() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.nfc_tags set ativa = p_ativa, atualizada_em = now() where id = p_id;
end $$;

-- Gera o token do tablet UMA vez (volta em texto só nesta chamada; o banco
-- guarda o hash). O app salva o token no próprio tablet.
create or replace function public.cadastrar_dispositivo(p_nome text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_nome text;
begin
  if not public.app_gestor_rondas() then raise exception 'Somente Master ou Coordenação cadastram tablets.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Dê um nome ao tablet (ex.: Tablet 2º andar).'; end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  insert into public.devices (nome, token_hash, cadastrado_por)
  values (trim(p_nome), encode(digest(v_token, 'sha256'), 'hex'), v_nome);
  return v_token;
end $$;

create or replace function public.revogar_dispositivo(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if not public.app_gestor_rondas() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  update public.devices set ativo = false, revogado_em = now(), revogado_por = v_nome where id = p_id and ativo;
end $$;

-- O tablet pergunta se o token que guarda ainda vale (sem ver a tabela).
create or replace function public.dispositivo_status(p_token text)
returns jsonb language sql stable security definer set search_path = public, extensions as $$
  select coalesce(
    (select jsonb_build_object('cadastrado', true, 'ativo', d.ativo, 'nome', d.nome)
       from public.devices d where d.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')),
    jsonb_build_object('cadastrado', false, 'ativo', false, 'nome', null))
$$;

-- Supervisor marca uma leitura sinalizada como revisada, com nota.
create or replace function public.revisar_leitura_ronda(p_id uuid, p_nota text)
returns void language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if not public.app_gestor_rondas() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  update public.ronda_leitura set revisada_em = now(), revisada_por = v_nome, revisao_nota = nullif(trim(coalesce(p_nota, '')), '')
   where id = p_id;
end $$;

do $$ declare f text;
begin
  foreach f in array array[
    'cadastrar_tag_nfc(text, text, integer, text)', 'definir_tag_ativa(uuid, boolean)', 'cadastrar_dispositivo(text)',
    'revogar_dispositivo(uuid)', 'dispositivo_status(text)', 'revisar_leitura_ronda(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- Autoria pelo servidor nas colunas *_por da configuração.
do $$ declare t text;
begin
  foreach t in array array['ronda_config','ronda_parametros'] loop
    execute format('drop trigger if exists trg_autoria_servidor on public.%I;', t);
    execute format('create trigger trg_autoria_servidor before insert or update on public.%I for each row execute function public.fn_autoria_servidor();', t);
  end loop;
end $$;
