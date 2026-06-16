-- 0079 — Editar o próprio perfil: nome de exibição. Idempotente.
-- Cada usuário pode alterar o PRÓPRIO nome de exibição. Função SECURITY
-- DEFINER, com escopo pelo email autenticado, que mexe SÓ na coluna `nome` —
-- não permite alterar perfil/ativo/vínculos, preservando o RLS de usuarios
-- (mesmo padrão de set_minha_foto). A SENHA é trocada pelo Supabase Auth
-- (auth.updateUser), fora desta função.

create or replace function public.set_meu_nome(p_nome text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text := nullif(btrim(p_nome), '');
begin
  if v_nome is null then
    raise exception 'O nome de exibição não pode ficar vazio.';
  end if;
  update public.usuarios
     set nome = v_nome
   where lower(email) = lower(auth.email());
end;
$$;

grant execute on function public.set_meu_nome(text) to authenticated;
