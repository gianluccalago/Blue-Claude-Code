-- ===========================================================================
-- 0109 — Admin define/reseta a senha de um usuário (somente Master).
-- ---------------------------------------------------------------------------
-- Até aqui as credenciais de login (auth.users) eram semeadas por SQL (0030,
-- senha padrão "blue"). Um usuário criado pela tela Equipe e Acessos ganhava a
-- linha em `usuarios`, mas NÃO ganhava login — não havia como o Master definir
-- ou resetar a senha pelo app. Esta RPC preenche essa lacuna sem service_role
-- nem Edge Function: SECURITY DEFINER, escreve direto em auth.users/identities
-- (bcrypt via pgcrypto), replicando o padrão da 0030. Valida internamente que
-- QUEM CHAMA é Master (app_perfil() = 'master').
--
-- Cria a credencial se ainda não existir (1ª senha do usuário) ou troca a senha
-- se já existir (reset). O e-mail precisa pertencer a um usuário do app.
-- Idempotente. Rode após a 0108.
-- ===========================================================================

create or replace function public.admin_definir_senha(p_email text, p_senha text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_email text := lower(btrim(p_email));
  v_uid   uuid;
begin
  -- 1) Só o Master define/reseta senha de terceiros.
  if public.app_perfil() <> 'master' then
    raise exception 'Apenas o Master pode definir senhas.' using errcode = '42501';
  end if;

  -- 2) Validações.
  if v_email is null or v_email = '' then
    raise exception 'E-mail obrigatório.';
  end if;
  if p_senha is null or length(p_senha) < 6 then
    raise exception 'A senha deve ter ao menos 6 caracteres.';
  end if;
  -- Não cria login "solto": o e-mail tem de pertencer a um usuário do app.
  if not exists (select 1 from public.usuarios where lower(email) = v_email and coalesce(sem_acesso, false) = false) then
    raise exception 'Nenhum usuário com acesso encontrado para este e-mail.';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;

  if v_uid is null then
    -- ── Cria a credencial (1º acesso) ────────────────────────────────────────
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token, email_change,
      email_change_token_new, email_change_token_current,
      phone_change, phone_change_token, reauthentication_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      v_email, crypt(p_senha, gen_salt('bf')),
      now(), now(), now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      '', '', '', '', '', '', '', ''
    );
  else
    -- ── Reseta a senha (usuário já tem login) ────────────────────────────────
    update auth.users
      set encrypted_password = crypt(p_senha, gen_salt('bf')),
          email_confirmed_at = coalesce(email_confirmed_at, now()),
          updated_at = now()
      where id = v_uid;
  end if;

  -- Garante a identidade 'email' (schema atual do Supabase exige provider_id).
  if not exists (select 1 from auth.identities where user_id = v_uid and provider = 'email') then
    begin
      insert into auth.identities (
        id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
      ) values (
        gen_random_uuid(), v_email, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email', now(), now(), now()
      );
    exception when others then
      -- Fallback p/ schema antigo (sem coluna provider_id).
      insert into auth.identities (
        provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at
      ) values (
        v_email, v_uid,
        jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
        'email', now(), now(), now()
      );
    end;
  end if;
end $$;

-- Só usuários autenticados podem invocar; a função valida Master internamente.
revoke all on function public.admin_definir_senha(text, text) from public, anon;
grant execute on function public.admin_definir_senha(text, text) to authenticated;

-- Fim.
