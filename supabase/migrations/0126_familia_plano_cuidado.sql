-- ===========================================================================
-- 0126 — PORTAL DA FAMÍLIA · leitura do plano de cuidados (read-only).
-- ---------------------------------------------------------------------------
-- Até aqui a família era BLOQUEADA no plano de cuidados (0058:
-- "using (app_perfil() <> 'familia')"). A transparência do plano é o que
-- sustenta a confiança da família quando o grau de dependência muda — e é
-- leitura pura, sem risco: a família NÃO escreve nada (a policy de escrita
-- continua restrita a master/coordenação).
--
-- ESCOPO MÍNIMO: a família enxerga APENAS o plano do residente vinculado ao
-- seu próprio usuário (usuarios.residente_vinculado). Nenhum outro morador.
-- Idempotente. Rode após a 0125.
-- ===========================================================================

-- Residente vinculado ao usuário autenticado (null para quem não é família).
create or replace function public.app_residente_vinculado()
returns uuid language sql stable security definer set search_path = public as $$
  select u.residente_vinculado from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', '')) and u.ativo
  order by u.id limit 1
$$;

comment on function public.app_residente_vinculado is
  'Residente vinculado ao usuário autenticado — usado para escopar o portal da família.';

-- Leitura: equipe vê tudo (como antes); família vê SÓ o próprio residente.
drop policy if exists plano_cuidado_select on public.plano_cuidado_item;
create policy plano_cuidado_select on public.plano_cuidado_item for select to authenticated
  using (
    public.app_perfil() <> 'familia'
    or residente_id = public.app_residente_vinculado()
  );

-- Escrita: inalterada (master/coordenação).
-- Fim.
