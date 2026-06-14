-- ===========================================================================
-- 0065 — Número do quarto SEM traços (Bloco·Andar·Suíte·Letra → 1204A)
-- ---------------------------------------------------------------------------
-- A nomenclatura do quarto passa a ser uma string contínua, sem separadores:
-- bloco(1) + andar(1) + suíte(2 dígitos) + letra (ex.: "1-2-04-A" → "1204A").
-- Normaliza os valores já gravados que estão no formato antigo com traços;
-- texto livre (que não casa o padrão) fica intacto. Idempotente.
-- ===========================================================================

update public.residentes
set quarto = upper(
  regexp_replace(replace(quarto, '-', ''), '\s', '', 'g')
)
where quarto ~ '^\s*\d+-\d+-\d+\s*-?\s*[A-Ca-c]?\s*$';
