-- ===========================================================================
-- 0114 — MÓDULO OBRA · Portal da construtora: leitura do PRÓPRIO contrato de
--        projetos (atividades, valores devidos, progresso medido).
-- ---------------------------------------------------------------------------
-- Com o cronograma real da TRÍADE, o contrato de projetos (R$ 500.000) É da
-- construtora — atividades, valores por marco (entrada/R00/R01), prazos e o
-- progresso que o Contratante mede passam a ser LEGÍVEIS pelo obra_prestador.
-- A regra antiga (0099) escondia as disciplinas do prestador; ela valia para o
-- financeiro do Contratante, que continua fechado: materiais, cotações, OCs,
-- retenções, baseline e custos indiretos seguem master/direção apenas.
-- Escrita nas disciplinas/progresso: continua só master/direção.
-- Idempotente. Rode após a 0113.
-- ===========================================================================

-- Atividades de projeto: o prestador LÊ (contrato dele — nomes, valores,
-- datas, status e progresso). Policies de SELECT são somadas por OR à
-- policy "all" de master/direção já existente.
drop policy if exists obra_disciplinas_select_prestador on public.obra_disciplinas;
create policy obra_disciplinas_select_prestador on public.obra_disciplinas
  for select to authenticated
  using (public.app_perfil() = 'obra_prestador');

-- Histórico de progresso (apontamentos semanais do Contratante): leitura.
drop policy if exists obra_disc_prog_select_prestador on public.obra_disciplina_progresso;
create policy obra_disc_prog_select_prestador on public.obra_disciplina_progresso
  for select to authenticated
  using (public.app_perfil() = 'obra_prestador');

-- Fim.
