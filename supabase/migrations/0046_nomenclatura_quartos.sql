-- ===========================================================================
-- 0046 — Nomenclatura padronizada do quarto: Bloco-Andar-Suíte-Letra
-- ---------------------------------------------------------------------------
-- Todo hóspede passa a ter o número no formato  B-A-SS-L:
--   1 · Bloco (1–5)   2 · Andar (1–3)   3 · Suíte (1–99, 2 dígitos)
--   4 · Letra A/B/C   (simples = sempre A; duplo A/B; triplo A/B/C)
--
-- O formato antigo já embutia bloco-andar-suíte ("1-2-04") e a única dupla já
-- vinha marcada com a letra na própria string ("1-2-06b" = 2º leito). Por isso
-- um normalizador genérico resolve tudo: padroniza a suíte com 2 dígitos,
-- aproveita a letra existente (maiúscula) ou assume "A" quando ausente.
-- Idempotente: rodar de novo sobre "1-2-06-B" reproduz "1-2-06-B".
-- ===========================================================================

update public.residentes r
set quarto = parts[1] || '-' || parts[2] || '-' || lpad(parts[3], 2, '0')
             || '-' || upper(coalesce(parts[4], 'A'))
from (
  select id, regexp_match(quarto, '^(\d+)-(\d+)-(\d+)\s*-?\s*([A-Ca-c])?$') as parts
  from public.residentes
  where quarto is not null
) x
where r.id = x.id and x.parts is not null;

-- Otávio (a…0002) divide o quarto 1-2-06 com a Neusa (c…0008): vira o leito A
-- de uma dupla, deixando a ocupação coerente com o leito B já existente.
update public.residentes
  set ocupacao = 'dupla'
  where id = 'a0000000-0000-0000-0000-000000000002';
