# Demo para a RPLK — como usar

Cenário fictício completo ("Residencial Demo") para apresentar o app ao vivo.
Nenhum dado real de morador, colaborador ou família.

## Comandos

**Carregar o cenário** (rode no dia da reunião — as datas são relativas a esse dia):
Supabase → SQL Editor → cole `seed/DEMO_SEED.sql` → Run. Pode rodar quantas vezes quiser.

**Remover tudo:** Supabase → SQL Editor → cole `seed/DEMO_LIMPEZA.sql` → Run.

**Login:** `demo.diretor@demo.local` · senha `blue` (Master — do Camaleão você alcança os outros perfis).

## O que tem aqui

| Arquivo | O que é |
|---|---|
| `ROTEIRO-DEMO.md` | O percurso de 6 paradas, com pré-voo e falas. **Comece por aqui.** |
| `seed/DEMO_SEED.sql` | Carrega o cenário (12 moradores, equipe, CRM, escala, indicadores). |
| `seed/DEMO_LIMPEZA.sql` | Remove o cenário e devolve a base ao estado anterior. |
| `screenshots/` | 16 capturas em 1920x1080 + `INDEX.md` dizendo o que é cada uma. |
| `video/percurso-demo.webm` | Gravação do percurso, sem áudio (para narrar por cima). |
| `gerar-demo.mjs` | Gera os dois SQLs. Edite aqui, nunca o SQL direto. |
| `capturar.mjs` / `gravar.mjs` | Refazem as capturas e o vídeo (precisam do ambiente de desenvolvimento). |
| `api-local.mjs` | Só para gerar capturas/vídeo fora do Supabase. Não faz parte do app. |

## Isolamento (importante)

O app **não tem separação por cliente**: dados fictícios e reais convivem na mesma
base. O cenário se protege assim:

- Todo registro da demo nasce com UUID no bloco `de3000xx-…`; a limpeza apaga
  exatamente esse bloco.
- Os **moradores e as oportunidades de CRM que já vinham nas migrações** são
  colocados de lado durante a demo (inativados / pausados) e **devolvidos ao
  estado anterior** pela limpeza — senão a demo apareceria com 27 moradores e o
  funil cheio de famílias que não fazem parte da história.
- Os nomes são plausíveis e **sem prefixo**, porque as telas precisam parecer
  reais nas capturas. A identificação é pelo UUID, não pelo texto.

## Data de referência (DEMO_REFERENCE_DATE)

Fica na primeira função do `DEMO_SEED.sql`:

```sql
create or replace function public.demo_ref() returns date
  language sql stable as $$ select current_date $$;
```

Por padrão é o dia em que você roda o seed. Para fixar outra data, troque
`current_date` por `date '2026-09-15'`, por exemplo.
