-- ===========================================================================
-- 0108 — MÓDULO OBRA · Materiais fora do escopo do prestador (construtora).
-- ---------------------------------------------------------------------------
-- Decisão do Contratante: custos de materiais, fornecedores diretos, demais
-- custos e indiretos NÃO fazem parte do acesso da construtora e não devem
-- aparecer para ela. Os custos já eram master/direção apenas (cotações, OCs,
-- recebimentos, consumo, reposição — 0102; retenções — 0100; baseline/indiretos
-- — 0103/0107). Restava a LISTA de planejamento de materiais
-- (obra_planejamento_materiais — quantidades previstas, sem preços), que o
-- prestador ainda podia LER. Esta migration remove esse acesso: materiais ficam
-- 100% fora do portal do prestador. Nenhuma tela do prestador usa esses dados
-- (o portal não renderiza materiais), então não há impacto funcional.
-- Idempotente. Rode após a 0107.
-- ===========================================================================

-- Planejamento de materiais: agora master/direção apenas (era +obra_prestador).
drop policy if exists obra_planmat_select on public.obra_planejamento_materiais;
create policy obra_planmat_select on public.obra_planejamento_materiais for select to authenticated
  using (public.app_perfil() in ('master','direcao'));

-- Fim.
