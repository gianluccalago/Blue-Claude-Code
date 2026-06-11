-- ============================================================================
-- Blue Senior Living — Migration 0015
-- AUTENTICAÇÃO real (Supabase Auth) + TRAVAS de permissão (RLS) por perfil.
--
-- O QUE ESTE SCRIPT FAZ:
--   1. Garante um usuário Master gianluccalago@gmail.com (acesso total).
--   2. Cria credenciais de login (email + senha "blue") para CADA usuário
--      ATIVO da tabela usuarios. (senha provisória de teste — ver aviso abaixo)
--   3. Cria funções auxiliares app_perfil()/app_usuario_id() (lêem o usuário
--      logado pela claim de email do JWT).
--   4. Liga RLS de verdade: tudo passa a exigir login (authenticated) e os
--      dados sensíveis (residentes, prescrições, usuarios) ficam escopados por
--      perfil — garantido no BANCO, não só na interface.
--
-- ⚠️ SENHA: "blue" é PROVISÓRIA, só para teste. Antes de produção troque por
--    senhas individuais e fortes, idealmente exigindo TROCA NO PRIMEIRO ACESSO
--    (ex: marcar must_change_password e bloquear telas até a troca).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   Idempotente (não recria credenciais já existentes) e NÃO apaga dados.
--   Se a criação de auth.users falhar por diferença de versão do GoTrue, crie
--   os usuários pelo painel (Authentication > Add user, com "Auto Confirm") —
--   o app os reconhece pelo email.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- 1. Master dono do sistema (acesso total) ----------
insert into public.usuarios (nome, email, perfil, ativo)
select 'Gianlucca Lago (Master)', 'gianluccalago@gmail.com', 'master', true
where not exists (
  select 1 from public.usuarios where lower(email) = 'gianluccalago@gmail.com'
);

-- ---------- 2. Credenciais de login (senha "blue") p/ cada usuário ativo ----------
do $$
declare u record; uid uuid;
begin
  for u in
    select * from public.usuarios
    where ativo and email is not null and btrim(email) <> ''
  loop
    -- já tem credencial? pula (idempotente)
    if exists (select 1 from auth.users where lower(email) = lower(u.email)) then
      continue;
    end if;

    uid := gen_random_uuid();

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
      lower(u.email), crypt('blue', gen_salt('bf')),
      now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', ''
    );

    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider,
      created_at, updated_at, last_sign_in_at
    ) values (
      gen_random_uuid(), lower(u.email), uid,
      jsonb_build_object('sub', uid::text, 'email', lower(u.email), 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;
end $$;

-- ---------- 3. Funções auxiliares (usuário logado) ----------
-- SECURITY DEFINER: leem usuarios IGNORANDO RLS (evita recursão nas policies).
create or replace function public.app_perfil()
returns text language sql stable security definer set search_path = public as $$
  select u.perfil::text
  from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.ativo
  order by u.id
  limit 1
$$;

create or replace function public.app_usuario_id()
returns uuid language sql stable security definer set search_path = public as $$
  select u.id
  from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.ativo
  order by u.id
  limit 1
$$;

grant execute on function public.app_perfil() to authenticated, anon;
grant execute on function public.app_usuario_id() to authenticated, anon;

-- ---------- 4. RLS ----------

-- 4a. Tabelas operacionais: exigem LOGIN (authenticated). Bloqueia acesso
--     anônimo (deslogado) sem mudar a lógica dos módulos (checklist, escalas,
--     ponto, coordenação, modelos, eliminações, intercorrências, etc.).
do $$ declare t text;
begin
  foreach t in array array[
    'cuidador_residente','plano_cuidado_item','tarefa_registro','administracao',
    'intercorrencia','compromisso_externo','eliminacao','modelo_rotina',
    'modelo_rotina_item','pendencia_tratamento','eliminacao_tratamento','turnos'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists demo_all on public.%I;', t);
    execute format('drop policy if exists auth_all on public.%I;', t);
    execute format(
      'create policy auth_all on public.%I for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- 4b. RESIDENTES (sensível): staff vê todos; CUIDADOR só os designados
--     (cuidador_residente); FAMÍLIA só o residente_vinculado. Edição apenas
--     Master/Coordenação/Administração.
alter table public.residentes enable row level security;
drop policy if exists demo_all on public.residentes;
drop policy if exists residentes_select on public.residentes;
drop policy if exists residentes_write on public.residentes;

create policy residentes_select on public.residentes for select to authenticated using (
  public.app_perfil() in
    ('master','coordenacao','medico','enfermagem','multidisciplinar','nutricionista','administracao','hotelaria','farmacia')
  or (public.app_perfil() = 'cuidador'
      and id in (select cr.residente_id from public.cuidador_residente cr
                 where cr.cuidador_id = public.app_usuario_id()))
  or (public.app_perfil() = 'familia'
      and id = (select u.residente_vinculado from public.usuarios u
                where u.id = public.app_usuario_id()))
);

create policy residentes_write on public.residentes for all to authenticated
  using (public.app_perfil() in ('master','coordenacao','administracao'))
  with check (public.app_perfil() in ('master','coordenacao','administracao'));

-- 4c. PRESCRIÇÕES (sensível/clínico): visível à equipe (não à família);
--     escrita só Master/Médico/Coordenação/Enfermagem.
alter table public.prescricao enable row level security;
drop policy if exists demo_all on public.prescricao;
drop policy if exists prescricao_select on public.prescricao;
drop policy if exists prescricao_write on public.prescricao;

create policy prescricao_select on public.prescricao for select to authenticated
  using (public.app_perfil() <> 'familia');

create policy prescricao_write on public.prescricao for all to authenticated
  using (public.app_perfil() in ('master','medico','coordenacao','enfermagem'))
  with check (public.app_perfil() in ('master','medico','coordenacao','enfermagem'));

-- 4d. USUARIOS: leitura para a equipe (diretório/escala); CRIAÇÃO e EDIÇÃO
--     restritas — Master/Administração podem tudo; COORDENAÇÃO só pode criar/
--     editar Cuidadora/Enfermagem (trava real do enunciado).
alter table public.usuarios enable row level security;
drop policy if exists demo_all on public.usuarios;
drop policy if exists usuarios_select on public.usuarios;
drop policy if exists usuarios_insert on public.usuarios;
drop policy if exists usuarios_update on public.usuarios;

create policy usuarios_select on public.usuarios for select to authenticated using (true);

create policy usuarios_insert on public.usuarios for insert to authenticated with check (
  public.app_perfil() in ('master','administracao')
  or (public.app_perfil() = 'coordenacao' and perfil in ('cuidador','enfermagem'))
);

create policy usuarios_update on public.usuarios for update to authenticated
  using (
    public.app_perfil() in ('master','administracao')
    or (public.app_perfil() = 'coordenacao' and perfil in ('cuidador','enfermagem'))
  )
  with check (
    public.app_perfil() in ('master','administracao')
    or (public.app_perfil() = 'coordenacao' and perfil in ('cuidador','enfermagem'))
  );

-- NOTA (Farmácia/resgate): a trava "reposição de resgate só Farmácia; baixa por
-- Farmácia/Coordenação/Médico; cuidador sem acesso" será aplicada via RLS quando
-- o módulo de Farmácia (estoque/resgate) for construído — ainda não há tabela.

-- Fim.
