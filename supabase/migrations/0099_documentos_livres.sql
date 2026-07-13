-- ===========================================================================
-- 0099 — Documentação Institucional: modelo LIVRE (sem checklist fixo)
-- ---------------------------------------------------------------------------
-- A 0097 nasceu com um checklist canônico (coluna `tipo` = slug obrigatório).
-- A casa quer a aba totalmente livre: adicionar/editar/excluir qualquer
-- documento, sem modelos pré-definidos. `tipo` deixa de ser obrigatório
-- (fica como rótulo opcional/legado). A edição e a exclusão já eram
-- permitidas pela policy `docinst_write` (for all) — nada muda na RLS.
-- Idempotente. Rode DEPOIS da 0097.
-- ===========================================================================

alter table public.documento_institucional alter column tipo drop not null;

-- Fim.
