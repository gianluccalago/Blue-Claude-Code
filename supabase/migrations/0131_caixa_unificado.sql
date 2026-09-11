-- ===========================================================================
-- 0131 — FLUXO DE CAIXA UNIFICADO: uma fonte só, com entradas, saídas e saldo.
-- ---------------------------------------------------------------------------
-- O app tinha duas estruturas olhando para lugares diferentes:
--   · fc_extrato      → a planilha do sócio-diretor (43 meses), que alimenta
--                       o Demonstrativo em PDF;
--   · fc_lancamentos  → a planilha CustoBlue (só obra, até 18/07/2026), que
--                       alimenta a tela de Fluxo de Caixa.
-- Era por isso que agosto parecia vazio na tela: o dinheiro estava no app,
-- mas na outra estrutura. A partir daqui, fc_lancamentos é A FONTE ÚNICA.
--
-- O QUE MUDA
--   a) fc_lancamentos ganha `grupo` (entrada/saida) e `ordem`, e passa a
--      aceitar valor COM SINAL — a convenção da planilha do sócio-diretor,
--      que ele lê há 43 meses (dividendos pagos são negativos no bloco de
--      entradas, por exemplo).
--   b) O extrato inteiro é migrado para fc_lancamentos, classificado por
--      centro de custo a partir do rótulo (função fc_centro_do_rotulo).
--   c) As 144 linhas da CustoBlue saem: são um SUBCONJUNTO do mesmo dinheiro
--      (o extrato é a planilha completa da empresa). Sai também a linha de
--      R$ 10.000 da entrada da Terraplanagem, que está dentro da linha
--      "Triade" de agosto — senão o mesmo pagamento contaria duas vezes.
--
-- REVERSÍVEL: tudo o que existia é copiado para fc_lancamentos_bkp_0131
-- antes de qualquer remoção. A 0132 desfaz, se precisar.
--
-- O extrato (fc_extrato) NÃO é apagado — fica como registro histórico.
-- Idempotente. Rode após a 0130.
-- ===========================================================================

-- ── a · Estrutura ──────────────────────────────────────────────────────────
alter table public.fc_lancamentos
  add column if not exists grupo text not null default 'saida',
  add column if not exists ordem int not null default 0;

alter table public.fc_lancamentos drop constraint if exists fc_lancamentos_grupo_check;
alter table public.fc_lancamentos add constraint fc_lancamentos_grupo_check
  check (grupo in ('entrada','saida'));

-- Valor passa a ser COM SINAL (negativo = saiu dinheiro).
alter table public.fc_lancamentos drop constraint if exists fc_lancamentos_valor_check;

comment on column public.fc_lancamentos.valor is
  'Valor COM SINAL, na convenção da planilha do sócio-diretor: negativo = saída de caixa.';
comment on column public.fc_lancamentos.grupo is
  'Bloco do extrato: entrada (receitas e movimentações societárias) ou saida.';

-- ── b · Classificação por centro de custo ──────────────────────────────────
create or replace function public.fc_centro_do_rotulo(p_rotulo text, p_grupo text)
returns text language sql immutable as $$
  select case
    when p_grupo = 'entrada' and r like 'aluguel%'                         then 'receita_aluguel'
    when p_grupo = 'entrada' and r like 'rendimento%'                      then 'receita_financeira'
    when p_grupo = 'entrada'                                               then 'socios'
    when r like 'parcela%terreno%' or r ~ '^terreno' or r like '%terreno % entrada%'
      or r like 'entrada terreno%' or r like 'itbi%' or r like 'iptu%'
      or r like 'funrejus%' or r like '%cart_rio%' or r like 'taxas judiciais%'
      or r like 'taxas cart%' or r like 'edvaldo%' or r like 'advogado edvaldo%'
      or r like '%rvore%' or r like '%arvore%' or r like 'jardineiro%'
      or r like 'aluguel motoserra%' or r like 'gasolina corte%'
      or r like 'combustivel cortar grama%' or r like 'taxa corte%'
      or r in ('copel','sanepar','agua','água')
      or r like 'humberto%'   -- corretor do terreno (a CustoBlue chamava de "Corretor")
                                                                           then 'terreno'
    when r like 'arquitet%' or r like 'bacoccini%' or r like 'rrts%'
      or r like 'top_grafo%' or r like 'topografo%' or r like 'c_lculo%'
      or r like 'calculo%' or r like 'laudo%' or r like 'taxas alvar%'
      or r like 'taxa cvco%' or r like 'taxas processo habite%'            then 'projetos'
    when r like 'triade%' or r like 'tríade%'                              then 'complementares'
    when r like 'obras no seniors%' or r like 'sonar%' or r like '%mangona%'
      or r like 'motor%' or r like 'baterias%' or r like 'carregador%'
      or r like 'port_o%' or r like 'guarda corpo%' or r like 'coletes%'
      or r like 'despesas com haste%' or r like 'gustavo sag%'
      or r like 'taxas processo concrecenter%' or r like 'iss obra%'
      or r like 'servi_o motor%' or r like 'lincoln%'                      then 'seniors_club'
    when r like 'despesas obra pagas por%'                                 then 'indiretos'
    when r like 'emprestimo%' or r like 'empr_stimo%'                      then 'socios'
    when r like 'marlon%' or r like 'cabelo%'
      or r like 'uber%' or r like 'copiadora%' or r like 'combustivel%'
      or r like 'gasolina%'                                                then 'indiretos'
    when r in ('pis','cofins','irpj','csll') or r like 'ir retido%'
      or r like 'ir s.nf%' or r like 'tributos federais%'                   then 'impostos'
    when r like 'contabilidade%' or r like 'tarifas banc%'
      or r like 'certificado %' or r like 'certificado eletr%'
      or r like 'taxa%junta comercial%' or r like 'taxas junta%'
      or r like 'escrilex%' or r like 'advogado%' or r like '%giuliano%'
      or r like 'a__o trabalhista%' or r like 'acordo andrea%'
      or r like 'taxa de envio%'                                           then 'administrativo'
    else 'indiretos'
  end
  from (select lower(btrim(p_rotulo)) as r) t
$$;

comment on function public.fc_centro_do_rotulo is
  'Centro de custo a partir do rótulo da planilha do sócio-diretor. Sem "outros": todo rótulo conhecido tem destino, e o que escapar cai em indiretos.';

-- Dia plausível dentro do mês (o extrato do sócio é mensal; o caixa é diário).
create or replace function public.fc_dia_do_centro(p_centro text) returns int
language sql immutable as $$
  select case p_centro
    when 'receita_aluguel'    then 5
    when 'receita_financeira' then 28
    when 'socios'             then 25
    when 'projetos'           then 5
    when 'impostos'           then 20
    when 'administrativo'     then 15
    when 'seniors_club'       then 12
    else 10
  end
$$;

-- ── c · RLS: o extrato inteiro é dos sócios ────────────────────────────────
-- Antes, fc_lancamentos só tinha custo de obra e a administração podia ver.
-- Agora carrega aluguel, aportes, dividendos e empréstimos — assunto de sócio.
-- A administração continua vendo exatamente o que via: saídas do empreendimento.
drop policy if exists fc_lanc_all on public.fc_lancamentos;
create policy fc_lanc_all on public.fc_lancamentos for all to authenticated
  using (
    public.app_perfil() in ('master','direcao')
    or (public.app_perfil() = 'administracao' and grupo = 'saida'
        and centro_custo in ('terreno','projetos','complementares','construtora','materiais','indiretos'))
  )
  with check (
    public.app_perfil() in ('master','direcao')
    or (public.app_perfil() = 'administracao' and grupo = 'saida'
        and centro_custo in ('terreno','projetos','complementares','construtora','materiais','indiretos'))
  );

-- ── d · Migração, com backup ───────────────────────────────────────────────
do $$
declare v_bkp int; v_antes int; v_depois int;
begin
  -- Backup completo do que existia (uma vez só).
  if to_regclass('public.fc_lancamentos_bkp_0131') is null then
    create table public.fc_lancamentos_bkp_0131 as select * from public.fc_lancamentos;
    select count(*) into v_bkp from public.fc_lancamentos_bkp_0131;
    raise notice 'Backup criado: % linha(s) em fc_lancamentos_bkp_0131.', v_bkp;
  else
    raise notice 'Backup fc_lancamentos_bkp_0131 já existe — preservado.';
  end if;

  select count(*) into v_antes from public.fc_lancamentos;

  -- Já migrado? (marca: existe lançamento do grupo entrada)
  if exists (select 1 from public.fc_lancamentos where grupo = 'entrada') then
    raise notice 'Extrato já migrado — nada a fazer.';
    return;
  end if;

  -- Linhas do CustoBlue: subconjunto do extrato, saem.
  delete from public.fc_lancamentos where origem = 'planilha';
  -- Entrada da Terraplanagem: está dentro da linha "Triade" de ago/26.
  delete from public.fc_lancamentos
   where origem = 'marco' and data >= date '2026-08-01' and data < date '2026-09-01';

  -- O que sobrou (manuais e sincronizados) vira valor COM SINAL.
  update public.fc_lancamentos set valor = -abs(valor), grupo = 'saida' where valor > 0;

  -- O extrato inteiro entra como a nova base.
  insert into public.fc_lancamentos
    (data, valor, grupo, ordem, centro_custo, fornecedor, descricao, pagador, origem, registrado_por)
  select
    make_date(split_part(e.mes,'-',1)::int, split_part(e.mes,'-',2)::int,
              public.fc_dia_do_centro(public.fc_centro_do_rotulo(e.rotulo, e.grupo))),
    e.valor,
    e.grupo,
    e.ordem,
    public.fc_centro_do_rotulo(e.rotulo, e.grupo),
    e.rotulo,
    'Extrato mensal do sócio-diretor · ' || e.mes,
    'seniors',
    'planilha',
    coalesce(e.registrado_por, 'planilha dos sócios')
  from public.fc_extrato e;

  select count(*) into v_depois from public.fc_lancamentos;
  raise notice 'Fluxo de Caixa unificado: % linha(s) antes, % agora.', v_antes, v_depois;
end $$;

-- ── Conferência ────────────────────────────────────────────────────────────
do $$
declare v_ent numeric; v_sai numeric; v_qtd int;
begin
  select coalesce(sum(valor) filter (where grupo='entrada'), 0),
         coalesce(sum(valor) filter (where grupo='saida'), 0), count(*)
    into v_ent, v_sai, v_qtd from public.fc_lancamentos;
  raise notice '% lançamentos · entradas % · saídas %', v_qtd, round(v_ent,2), round(v_sai,2);
end $$;

-- Fim.
