-- 0034 — Foto dos usuários (equipe). Idempotente.
-- Cada usuário pode ter foto; a Família NÃO usa foto própria (a interface
-- espelha a foto do hóspede vinculado). Atualização da própria foto é feita
-- por função SECURITY DEFINER, que mexe SÓ em foto_url (não permite alterar
-- perfil/ativo) — preserva o RLS de usuarios.

-- 1) Coluna -----------------------------------------------------------------
alter table public.usuarios
  add column if not exists foto_url text;

comment on column public.usuarios.foto_url is 'URL pública da foto do usuário (bucket usuarios-fotos).';

-- 2) Bucket de fotos de usuário (Storage) -----------------------------------
insert into storage.buckets (id, name, public)
values ('usuarios-fotos', 'usuarios-fotos', true)
on conflict (id) do nothing;

drop policy if exists "usuarios_fotos_leitura_publica" on storage.objects;
create policy "usuarios_fotos_leitura_publica"
  on storage.objects for select
  using (bucket_id = 'usuarios-fotos');

drop policy if exists "usuarios_fotos_escrita_autenticada" on storage.objects;
create policy "usuarios_fotos_escrita_autenticada"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'usuarios-fotos');

drop policy if exists "usuarios_fotos_update_autenticada" on storage.objects;
create policy "usuarios_fotos_update_autenticada"
  on storage.objects for update to authenticated
  using (bucket_id = 'usuarios-fotos');

-- 3) Função: cada usuário atualiza SOMENTE a própria foto -------------------
-- SECURITY DEFINER + escopo por email autenticado. Não toca em outras colunas,
-- então não há risco de alguém mudar o próprio perfil por aqui.
create or replace function public.set_minha_foto(p_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.usuarios
     set foto_url = p_url
   where lower(email) = lower(auth.email());
end;
$$;

grant execute on function public.set_minha_foto(text) to authenticated;
