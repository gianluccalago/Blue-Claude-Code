-- ===========================================================================
-- 0052 — Tabela de preços por tipo × grau × OCUPAÇÃO (27 combinações)
-- ---------------------------------------------------------------------------
-- Antes: preço por (tipo_suite, grau). Agora também por ocupação:
--   • Suíte / Suíte Premium / Apartamento → simples, duplo
--   • Long Stay                            → simples, duplo, triplo
--
-- Migração: os preços atuais viram a linha "simples" (ponto de partida) e as
-- demais ocupações são criadas com o MESMO valor inicial — todas editáveis
-- depois pelo Master. Também alinha o vocabulário de residentes.ocupacao
-- (individual→simples, dupla→duplo). Depende da 0051 (rename de tipos).
-- Idempotente.
-- ===========================================================================

-- 1) Coluna ocupacao (default 'simples' preenche as linhas existentes).
alter table public.tabela_preco
  add column if not exists ocupacao text not null default 'simples';

alter table public.tabela_preco drop constraint if exists tabela_preco_ocupacao_check;
alter table public.tabela_preco add constraint tabela_preco_ocupacao_check
  check (ocupacao in ('simples','duplo','triplo'));

-- 2) Unicidade passa a incluir ocupacao.
alter table public.tabela_preco drop constraint if exists tabela_preco_tipo_suite_grau_key;
alter table public.tabela_preco drop constraint if exists tabela_preco_tipo_grau_ocupacao_key;
alter table public.tabela_preco add constraint tabela_preco_tipo_grau_ocupacao_key
  unique (tipo_suite, grau, ocupacao);

-- 3) Cria as demais combinações válidas a partir das linhas "simples".
--    duplo para TODOS os tipos; triplo apenas para Long Stay. Valor inicial =
--    o da linha simples correspondente (editável).
insert into public.tabela_preco (tipo_suite, grau, ocupacao, valor)
  select tipo_suite, grau, 'duplo', valor
  from public.tabela_preco where ocupacao = 'simples'
  on conflict (tipo_suite, grau, ocupacao) do nothing;

insert into public.tabela_preco (tipo_suite, grau, ocupacao, valor)
  select tipo_suite, grau, 'triplo', valor
  from public.tabela_preco where ocupacao = 'simples' and tipo_suite = 'Long Stay'
  on conflict (tipo_suite, grau, ocupacao) do nothing;

-- 4) residentes.ocupacao: alinha o vocabulário ao da precificação.
update public.residentes set ocupacao = 'simples' where ocupacao = 'individual';
update public.residentes set ocupacao = 'duplo'   where ocupacao = 'dupla';
