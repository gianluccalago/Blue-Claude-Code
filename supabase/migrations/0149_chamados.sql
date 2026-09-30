-- ===========================================================================
-- 0149 — CHAMADOS DE HÓSPEDE E EMERGÊNCIA (botão e corda em cada suíte).
-- ---------------------------------------------------------------------------
-- O aparelho ainda não foi escolhido: tudo fica pronto para a central (gateway)
-- mandar eventos à Edge Function "chamado-evento".
--
-- · Suítes do Módulo 5 cadastradas: 1º andar 5101–5119, 2º andar 5201–5220,
--   um leito A em cada (ajuste depois, se alguma for dupla).
-- · chamado_dispositivo: cada botão/corda (código do fabricante → suíte).
--   Botão gera CHAMADO (amarelo); corda gera EMERGÊNCIA (vermelho); botão de
--   presença (se o aparelho tiver) registra que alguém chegou ao quarto.
-- · chamado_central: a central do fabricante (token guardado só como hash) e
--   o último sinal recebido — para distinguir "sem chamados" de "sem conexão".
-- · chamado: um aberto por suíte. Novos toques somam; emergência nunca é
--   rebaixada por um chamado. NÃO se fecha pelo painel: só quando alguém
--   comprova presença no quarto — leitura válida da etiqueta NFC da suíte
--   (trigger em ronda_leitura) ou botão de presença do próprio aparelho.
--   Encerramento excepcional (aparelho/etiqueta com defeito) só pela
--   Coordenação ou Master, com justificativa, e fica marcado.
-- · chamado_evento: registro bruto de tudo o que a central mandou (e
--   deduplicação pelo id do evento).
-- Rode após a 0148.
-- ===========================================================================

-- ── Suítes do Módulo 5 ──────────────────────────────────────────────────────
insert into public.quarto (codigo, modulo, andar)
select '51' || lpad(n::text, 2, '0'), 5, 1 from generate_series(1, 19) n
on conflict (codigo) do nothing;
insert into public.quarto (codigo, modulo, andar)
select '52' || lpad(n::text, 2, '0'), 5, 2 from generate_series(1, 20) n
on conflict (codigo) do nothing;
insert into public.leito (quarto_id, letra, codigo)
select q.id, 'A', q.codigo || 'A' from public.quarto q where q.modulo = 5
on conflict (codigo) do nothing;

-- ── Central (gateway) do fabricante ─────────────────────────────────────────
create table if not exists public.chamado_central (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null check (length(trim(nome)) > 0),
  token_hash     text not null unique,
  ativo          boolean not null default true,
  ultimo_sinal_em timestamptz,
  cadastrado_por text,
  criado_em      timestamptz not null default now(),
  revogado_em    timestamptz
);

-- ── Botões e cordas ─────────────────────────────────────────────────────────
create table if not exists public.chamado_dispositivo (
  id             uuid primary key default gen_random_uuid(),
  codigo_externo text not null unique,
  quarto_id      uuid not null references public.quarto(id),
  leito_id       uuid references public.leito(id),
  tipo           text not null check (tipo in ('botao','corda','presenca')),
  local          text,
  ativo          boolean not null default true,
  cadastrado_por text,
  criado_em      timestamptz not null default now()
);

-- ── Chamados ────────────────────────────────────────────────────────────────
create table if not exists public.chamado (
  id                uuid primary key default gen_random_uuid(),
  quarto_id         uuid not null references public.quarto(id),
  leito_id          uuid references public.leito(id),
  tipo              text not null check (tipo in ('chamado','emergencia')),
  origem            text not null check (origem in ('botao','corda','simulado')),
  dispositivo_id    uuid references public.chamado_dispositivo(id),
  simulado          boolean not null default false,
  status            text not null default 'aberto' check (status in ('aberto','atendido','encerrado_excepcional')),
  aberto_em         timestamptz not null default now(),
  acionamentos      integer not null default 1,
  ultimo_acionamento_em timestamptz not null default now(),
  escalado_em       timestamptz,
  reconhecido_por_id uuid references public.usuarios(id),
  reconhecido_por   text,
  reconhecido_em    timestamptz,
  atendido_por_id   uuid references public.usuarios(id),
  atendido_por      text,
  atendido_em       timestamptz,
  atendimento_via   text check (atendimento_via in ('nfc','presenca_dispositivo','excepcional')),
  leitura_id        uuid references public.ronda_leitura(id),
  justificativa     text
);
create unique index if not exists uq_chamado_aberto_por_quarto on public.chamado (quarto_id) where status = 'aberto';
create index if not exists idx_chamado_aberto_em on public.chamado (aberto_em desc);

create table if not exists public.chamado_evento (
  id                 uuid primary key default gen_random_uuid(),
  evento_externo_id  text unique,
  central_id         uuid references public.chamado_central(id),
  dispositivo_codigo text,
  tipo               text,
  recebido_em        timestamptz not null default now(),
  ocorrido_em_aparelho timestamptz,
  resultado          text not null,
  chamado_id         uuid references public.chamado(id)
);
comment on column public.chamado_evento.ocorrido_em_aparelho is 'Relógio do aparelho — só informativo; o horário oficial é recebido_em (servidor).';

-- ── Permissões ──────────────────────────────────────────────────────────────
alter table public.chamado_central enable row level security;
alter table public.chamado_dispositivo enable row level security;
alter table public.chamado enable row level security;
alter table public.chamado_evento enable row level security;
drop policy if exists chamado_central_sel on public.chamado_central;
drop policy if exists chamado_dispositivo_sel on public.chamado_dispositivo;
drop policy if exists chamado_sel on public.chamado;
drop policy if exists chamado_evento_sel on public.chamado_evento;
-- A equipe precisa saber se a central está sem sinal (nome e último sinal).
create policy chamado_central_sel on public.chamado_central for select to authenticated using (public.app_equipe_clinica());
create policy chamado_dispositivo_sel on public.chamado_dispositivo for select to authenticated
  using (coalesce(public.app_perfil() in ('master','coordenacao'), false));
create policy chamado_sel on public.chamado for select to authenticated using (public.app_equipe_clinica());
create policy chamado_evento_sel on public.chamado_evento for select to authenticated
  using (coalesce(public.app_perfil() in ('master','coordenacao'), false));
-- Sem escrita direta: só pelas funções abaixo.

-- Atualização instantânea nos painéis (Supabase Realtime), se existir.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'chamado') then
    execute 'alter publication supabase_realtime add table public.chamado';
  end if;
end $$;

-- ── Abre (ou soma a) um chamado da suíte ────────────────────────────────────
create or replace function public.fn_abrir_chamado(p_quarto uuid, p_leito uuid, p_tipo text, p_origem text, p_disp uuid, p_simulado boolean)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('chamado:' || p_quarto::text));
  select id into v_id from public.chamado where quarto_id = p_quarto and status = 'aberto' for update;
  if v_id is null then
    insert into public.chamado (quarto_id, leito_id, tipo, origem, dispositivo_id, simulado)
    values (p_quarto, p_leito, p_tipo, p_origem, p_disp, p_simulado)
    returning id into v_id;
  else
    -- Mais um toque na mesma suíte: soma; emergência nunca é rebaixada.
    update public.chamado set
      acionamentos = acionamentos + 1,
      ultimo_acionamento_em = now(),
      tipo = case when tipo = 'emergencia' or p_tipo = 'emergencia' then 'emergencia' else 'chamado' end,
      escalado_em = case when tipo = 'chamado' and p_tipo = 'emergencia' then now() else escalado_em end,
      origem = case when tipo = 'chamado' and p_tipo = 'emergencia' then p_origem else origem end
    where id = v_id;
  end if;
  return v_id;
end $$;
revoke all on function public.fn_abrir_chamado(uuid, uuid, text, text, uuid, boolean) from public, anon, authenticated;

-- ── Evento da central (só a Edge Function, com service_role) ────────────────
-- p: { central_token_hash, evento_id, dispositivo, tipo ('acionamento'|'sinal'), ocorrido_em }
create or replace function public.registrar_evento_chamado(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_central record;
  v_disp record;
  v_res text;
  v_chamado uuid;
  v_tipo text := coalesce(p ->> 'tipo', 'acionamento');
begin
  select * into v_central from public.chamado_central where token_hash = coalesce(p ->> 'central_token_hash', '');
  if v_central.id is null or not v_central.ativo then
    return jsonb_build_object('ok', false, 'resultado', 'central_invalida');
  end if;
  update public.chamado_central set ultimo_sinal_em = now() where id = v_central.id;
  if v_tipo = 'sinal' then
    return jsonb_build_object('ok', true, 'resultado', 'sinal');
  end if;

  -- Evento repetido (a central reenviou): não gera nada de novo.
  if nullif(p ->> 'evento_id', '') is not null
     and exists (select 1 from public.chamado_evento where evento_externo_id = p ->> 'evento_id') then
    return jsonb_build_object('ok', true, 'resultado', 'duplicado');
  end if;

  select * into v_disp from public.chamado_dispositivo where codigo_externo = coalesce(p ->> 'dispositivo', '');
  if v_disp.id is null then
    v_res := 'dispositivo_desconhecido';
  elsif not v_disp.ativo then
    v_res := 'dispositivo_inativo';
  elsif v_disp.tipo = 'presenca' then
    -- Botão de presença no quarto: alguém chegou. Fecha o chamado aberto.
    update public.chamado set status = 'atendido', atendido_em = now(), atendido_por = 'Botão de presença no quarto',
                              atendimento_via = 'presenca_dispositivo'
     where quarto_id = v_disp.quarto_id and status = 'aberto'
    returning id into v_chamado;
    v_res := case when v_chamado is null then 'presenca_sem_chamado' else 'atendido_presenca' end;
  else
    v_chamado := public.fn_abrir_chamado(v_disp.quarto_id, v_disp.leito_id,
                   case v_disp.tipo when 'corda' then 'emergencia' else 'chamado' end, v_disp.tipo, v_disp.id, false);
    v_res := 'acionado';
  end if;

  insert into public.chamado_evento (evento_externo_id, central_id, dispositivo_codigo, tipo, ocorrido_em_aparelho, resultado, chamado_id)
  values (nullif(p ->> 'evento_id', ''), v_central.id, p ->> 'dispositivo', v_tipo,
          nullif(p ->> 'ocorrido_em', '')::timestamptz, v_res, v_chamado);
  return jsonb_build_object('ok', v_res in ('acionado','atendido_presenca','presenca_sem_chamado'), 'resultado', v_res, 'chamado_id', v_chamado);
end $$;
revoke all on function public.registrar_evento_chamado(jsonb) from public, anon, authenticated;
grant execute on function public.registrar_evento_chamado(jsonb) to service_role;

-- ── Presença comprovada pela etiqueta NFC fecha o chamado ───────────────────
-- Leitura VÁLIDA da etiqueta da suíte, feita no momento (não sincronizada
-- tarde: essa pode ter acontecido antes do chamado), depois da abertura.
create or replace function public.fn_chamado_fecha_por_nfc()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status_validacao = 'valida' and not new.sincronizado_tarde and new.quarto_id is not null then
    update public.chamado set status = 'atendido', atendido_em = new.servidor_em, atendido_por_id = new.cuidador_id,
                              atendido_por = new.cuidador_nome, atendimento_via = 'nfc', leitura_id = new.id
     where quarto_id = new.quarto_id and status = 'aberto' and aberto_em <= new.servidor_em;
  end if;
  return new;
end $$;
drop trigger if exists trg_chamado_fecha_por_nfc on public.ronda_leitura;
create trigger trg_chamado_fecha_por_nfc after insert on public.ronda_leitura
  for each row execute function public.fn_chamado_fecha_por_nfc();

-- ── Ações da equipe ─────────────────────────────────────────────────────────
create or replace function public.app_equipe_chamados() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.app_perfil() in ('master','coordenacao','enfermeira','enfermagem','cuidador'), false)
$$;

-- "Estou indo": avisa a equipe; o alerta continua aceso até a presença no quarto.
create or replace function public.reconhecer_chamado(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if not public.app_equipe_chamados() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  update public.chamado set reconhecido_por_id = public.app_usuario_id(), reconhecido_por = v_nome, reconhecido_em = now()
   where id = p_id and status = 'aberto';
end $$;

-- Encerramento sem presença comprovada (etiqueta/aparelho com defeito).
create or replace function public.encerrar_chamado_excepcional(p_id uuid, p_justificativa text)
returns void language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if coalesce(public.app_perfil(), '') not in ('master','coordenacao') then
    raise exception 'Só a Coordenação ou o Master encerram sem presença no quarto.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_justificativa, ''))) < 10 then
    raise exception 'Explique o motivo (mínimo de 10 caracteres).';
  end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  update public.chamado set status = 'encerrado_excepcional', atendido_em = now(), atendido_por_id = public.app_usuario_id(),
                            atendido_por = v_nome, atendimento_via = 'excepcional', justificativa = trim(p_justificativa)
   where id = p_id and status = 'aberto';
  if not found then raise exception 'Chamado não está aberto.'; end if;
end $$;

-- Simulação (treino e teste enquanto o aparelho não chega). Fecha igual: com presença.
create or replace function public.simular_chamado(p_quarto text, p_tipo text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_q uuid;
begin
  if coalesce(public.app_perfil(), '') not in ('master','coordenacao') then
    raise exception 'Só a Coordenação ou o Master simulam chamados.' using errcode = '42501';
  end if;
  if p_tipo not in ('chamado','emergencia') then raise exception 'Tipo inválido.'; end if;
  select id into v_q from public.quarto where codigo = p_quarto;
  if v_q is null then raise exception 'Suíte % não cadastrada.', p_quarto; end if;
  return public.fn_abrir_chamado(v_q, (select id from public.leito where quarto_id = v_q order by letra limit 1),
                                 p_tipo, 'simulado', null, true);
end $$;

-- Cadastro da central (token volta UMA vez) e dos botões/cordas.
create or replace function public.cadastrar_central_chamado(p_nome text)
returns text language plpgsql security definer set search_path = public, extensions as $$
declare
  v_token text := encode(gen_random_bytes(32), 'hex');
  v_nome text;
begin
  if coalesce(public.app_perfil(), '') not in ('master','coordenacao') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_nome, ''))) = 0 then raise exception 'Dê um nome à central.'; end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  insert into public.chamado_central (nome, token_hash, cadastrado_por) values (trim(p_nome), encode(digest(v_token, 'sha256'), 'hex'), v_nome);
  return v_token;
end $$;

create or replace function public.revogar_central_chamado(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.app_perfil(), '') not in ('master','coordenacao') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.chamado_central set ativo = false, revogado_em = now() where id = p_id;
end $$;

create or replace function public.cadastrar_dispositivo_chamado(p_codigo text, p_quarto text, p_tipo text, p_local text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_q uuid;
  v_id uuid;
  v_nome text;
begin
  if coalesce(public.app_perfil(), '') not in ('master','coordenacao') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_codigo, ''))) = 0 then raise exception 'Informe o código do aparelho.'; end if;
  if p_tipo not in ('botao','corda','presenca') then raise exception 'Tipo inválido.'; end if;
  select id into v_q from public.quarto where codigo = p_quarto;
  if v_q is null then raise exception 'Suíte % não cadastrada.', p_quarto; end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  insert into public.chamado_dispositivo (codigo_externo, quarto_id, leito_id, tipo, local, cadastrado_por)
  values (trim(p_codigo), v_q, (select id from public.leito where quarto_id = v_q order by letra limit 1), p_tipo, nullif(trim(coalesce(p_local, '')), ''), v_nome)
  on conflict (codigo_externo) do update set quarto_id = excluded.quarto_id, leito_id = excluded.leito_id, tipo = excluded.tipo,
    local = excluded.local, ativo = true
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.definir_dispositivo_chamado_ativo(p_id uuid, p_ativo boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.app_perfil(), '') not in ('master','coordenacao') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  update public.chamado_dispositivo set ativo = p_ativo where id = p_id;
end $$;

do $$ declare f text;
begin
  foreach f in array array[
    'app_equipe_chamados()', 'reconhecer_chamado(uuid)', 'encerrar_chamado_excepcional(uuid, text)', 'simular_chamado(text, text)',
    'cadastrar_central_chamado(text)', 'revogar_central_chamado(uuid)', 'cadastrar_dispositivo_chamado(text, text, text, text)',
    'definir_dispositivo_chamado_ativo(uuid, boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
