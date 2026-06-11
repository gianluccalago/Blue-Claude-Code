-- ============================================================================
-- Blue Senior Living — Migration 0030
-- AUTENTICAÇÃO (Supabase Auth) + TRAVAS de permissão (RLS) por perfil.
-- Self-contained e idempotente. Rode DEPOIS das 0001–0029.
--
-- 1. Garante o Master gianluccalago@gmail.com (acesso total).
-- 2. Cria credenciais de login (senha "blue") para cada usuário ATIVO.
-- 3. Funções app_perfil()/app_usuario_id().
-- 4. RLS: tudo exige login; residentes escopado (cuidador→designados,
--    família→residente_vinculado); prescrições sem família; usuarios com
--    criação/edição restrita (coordenação só Cuidadora/Enfermagem).
--
-- ⚠️ Senha "blue" é PROVISÓRIA de teste — trocar por individual/forte antes de
--    produção (idealmente com troca obrigatória no primeiro acesso).
-- As tabelas dos módulos novos (estoque, mensalidades, evolução, IVCF, etc.)
-- ficam como o módulo as criou; travá-las por RLS fina é um passo seguinte.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------- 1. Master dono do sistema ----------
insert into public.usuarios (nome, email, perfil, ativo)
select 'Gianlucca Lago (Master)', 'gianluccalago@gmail.com', 'master', true
where not exists (select 1 from public.usuarios where lower(email) = 'gianluccalago@gmail.com');

-- ---------- 2. Funções auxiliares (usuário logado) ----------
create or replace function public.app_perfil()
returns text language sql stable security definer set search_path = public as $$
  select u.perfil::text from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and u.ativo
  order by u.id limit 1
$$;

create or replace function public.app_usuario_id()
returns uuid language sql stable security definer set search_path = public as $$
  select u.id from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and u.ativo
  order by u.id limit 1
$$;

grant execute on function public.app_perfil() to authenticated, anon;
grant execute on function public.app_usuario_id() to authenticated, anon;

-- ---------- 3. RLS ----------
-- 3a. Operacionais: exigem login (authenticated). Bloqueia acesso anônimo.
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

-- 3b. RESIDENTES (cuidador → designados; família → residente_vinculado).
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

-- 3c. PRESCRIÇÕES (sem família; escrita só clínica).
alter table public.prescricao enable row level security;
drop policy if exists demo_all on public.prescricao;
drop policy if exists prescricao_select on public.prescricao;
drop policy if exists prescricao_write on public.prescricao;
create policy prescricao_select on public.prescricao for select to authenticated
  using (public.app_perfil() <> 'familia');
create policy prescricao_write on public.prescricao for all to authenticated
  using (public.app_perfil() in ('master','medico','coordenacao','enfermagem'))
  with check (public.app_perfil() in ('master','medico','coordenacao','enfermagem'));

-- 3d. USUARIOS (coordenação só cria/edita Cuidadora/Enfermagem).
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

-- ---------- 4. Credenciais de login (robusto + diagnóstico) ----------
do $$
declare u record; uid uuid; ok int := 0;
begin
  for u in
    select * from public.usuarios where ativo and email is not null and btrim(email) <> ''
  loop
    begin
      delete from auth.identities i using auth.users au
        where au.id = i.user_id and lower(au.email) = lower(u.email);
      delete from auth.users where lower(email) = lower(u.email);

      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        lower(u.email), crypt('blue', gen_salt('bf')),
        now(), now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        '', '', '', '', '', '', '', ''
      );
      begin
        insert into auth.identities (
          id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
        ) values (
          gen_random_uuid(), lower(u.email), uid,
          jsonb_build_object('sub', uid::text, 'email', lower(u.email), 'email_verified', true),
          'email', now(), now(), now()
        );
      exception when others then
        begin
          insert into auth.identities (
            provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
          ) values (
            lower(u.email), uid,
            jsonb_build_object('sub', uid::text, 'email', lower(u.email), 'email_verified', true),
            'email', now(), now(), now()
          );
        exception when others then
          raise notice 'identity ignorada p/ % (%).', u.email, sqlerrm;
        end;
      end;
      ok := ok + 1;
    exception when others then
      raise notice 'FALHOU para %: %', u.email, sqlerrm;
    end;
  end loop;
  raise notice 'Credenciais OK: %', ok;
end $$;

select u.email, u.perfil, (au.id is not null) as tem_login
from public.usuarios u
left join auth.users au on lower(au.email) = lower(u.email)
where u.ativo order by u.email;

-- Fim.
