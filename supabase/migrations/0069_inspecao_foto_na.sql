-- ===========================================================================
-- 0069 — Inspeção de suítes: foto opcional na não-conformidade + item "N/A"
-- ---------------------------------------------------------------------------
-- AJUSTE 1: ao marcar um item como "não conforme", a Hotelaria pode (opcional)
-- anexar UMA foto do problema. A foto fica no item da inspeção (foto_url) e,
-- quando a não-conformidade gera o chamado automático, é repassada ao chamado
-- em `foto_problema_url` — a manutenção vê o problema antes de ir ao local.
-- Essa foto do PROBLEMA é distinta da `foto_url` do chamado (evidência do
-- conserto no encerramento): as duas coexistem.
--
-- AJUSTE 2: o status do item passa a aceitar 'nao_se_aplica' (N/A) — ex.: quarto
-- sem sacada. É NEUTRO: não conta como conformidade nem não-conformidade e não
-- gera chamado (a lógica em JS já filtra por 'nao_conforme').
--
-- As fotos reutilizam o bucket existente 'manutencao-fotos' (mesmo domínio de
-- manutenção; criado em 0020). Idempotente.
-- ===========================================================================

-- Foto opcional do item de inspeção (problema visto).
alter table public.inspecao_item add column if not exists foto_url text;

-- status agora aceita 'nao_se_aplica' (N/A). Recria o check de forma idempotente.
alter table public.inspecao_item drop constraint if exists inspecao_item_status_check;
alter table public.inspecao_item add constraint inspecao_item_status_check
  check (status in ('conforme','nao_conforme','nao_se_aplica'));

-- Foto do PROBLEMA no chamado (vinda da inspeção). Distinta da foto_url de
-- encerramento — ambas convivem.
alter table public.chamado_manutencao add column if not exists foto_problema_url text;
