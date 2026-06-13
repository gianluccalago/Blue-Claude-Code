-- ===========================================================================
-- 0050 — Sinalização da gestão nos chamados ("priorizado/cobrado")
-- ---------------------------------------------------------------------------
-- A Administração/Master supervisionam os serviços: podem SINALIZAR um chamado
-- como priorizado (um empurrão), visível em destaque para o perfil responsável
-- (Hotelaria/Serviços Gerais). NÃO executam nem resolvem — só sinalizam.
--
-- A RLS de UPDATE (0049) já permite Administração/Master/Direção atualizarem
-- qualquer chamado; aqui só adicionamos as colunas da flag. Idempotente.
-- ===========================================================================

alter table public.chamado_manutencao
  add column if not exists cobrado_gestao boolean not null default false,
  add column if not exists cobrado_em     timestamptz;

comment on column public.chamado_manutencao.cobrado_gestao is
  'Chamado priorizado/cobrado pela gestão (Administração/Master). Empurrão, não execução.';
