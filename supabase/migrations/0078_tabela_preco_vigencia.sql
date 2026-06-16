-- ===========================================================================
-- 0078 — Tabela de preços com VIGÊNCIA datada (histórico de preços)
-- ---------------------------------------------------------------------------
-- Antes: UMA linha por combinação tipo_suite × grau × ocupacao (o preço atual,
-- sobrescrito a cada ajuste — sem histórico). Agora cada combinação pode ter N
-- VIGÊNCIAS: cada linha carrega `valor` + `vigente_a_partir_de` (date).
--
--   • O preço VIGENTE de uma combinação numa data = a vigência de MAIOR
--     `vigente_a_partir_de` ≤ data consultada.
--   • Mudar um preço CRIA uma nova vigência (não sobrescreve) → o histórico de
--     preços anteriores é preservado.
--   • Afeta SOMENTE NOVOS CONTRATOS: a mensalidade sugerida de um hóspede usa o
--     preço vigente na data de ENTRADA dele (data_admissao). Residentes atuais
--     NÃO são reajustados automaticamente — cada um mantém `mensalidade_valor`
--     manual (regra de negócio inalterada).
--
-- Relação com a trilha `log_alteracao` (0036): COEXISTEM, sem duplicar. A
-- vigência é a REGRA DE COBRANÇA (qual valor vale e desde quando); o
-- log_alteracao é a AUDITORIA da edição (quem alterou, quando, de→para, motivo).
-- Cada novo preço grava a vigência (aqui) e uma entrada de auditoria (no app,
-- via registrarLogAlteracao, registro_id = a chave da combinação).
--
-- Idempotente. Supera a unicidade (tipo_suite, grau, ocupacao) criada na 0052.
-- ===========================================================================

-- 1) Coluna de vigência. Default '2000-01-01' faz as linhas EXISTENTES valerem
--    "desde sempre" — não muda nenhum preço atual, só lhes dá uma data base.
alter table public.tabela_preco
  add column if not exists vigente_a_partir_de date not null default '2000-01-01';

-- 2) A unicidade passa a incluir a vigência (várias vigências por combinação).
--    Remove a unicidade antiga (tipo_suite, grau, ocupacao) da 0052.
alter table public.tabela_preco drop constraint if exists tabela_preco_tipo_suite_grau_key;
alter table public.tabela_preco drop constraint if exists tabela_preco_tipo_grau_ocupacao_key;
alter table public.tabela_preco drop constraint if exists tabela_preco_tipo_grau_ocupacao_vigencia_key;
alter table public.tabela_preco add constraint tabela_preco_tipo_grau_ocupacao_vigencia_key
  unique (tipo_suite, grau, ocupacao, vigente_a_partir_de);

-- 3) Índice para resolver o preço vigente rapidamente (combinação + data desc).
create index if not exists idx_tabela_preco_vigencia
  on public.tabela_preco (tipo_suite, grau, ocupacao, vigente_a_partir_de desc);

-- RLS inalterada: SELECT master/administracao/direcao (0053) e ESCRITA
-- master/direcao (0055) já cobrem insert/update/delete das novas vigências.
