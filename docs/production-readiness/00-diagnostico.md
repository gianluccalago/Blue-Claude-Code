# 00 · Inventário e diagnóstico

Estado registrado antes das correções desta rodada (25/09/2026): branch `claude/hopeful-franklin-yikyq4`, commit `8313ff0`, árvore limpa. A branch principal do repositório não se chama `main`; todo o desenvolvimento acontece nesta branch de feature, sem merge.

## Stack e execução

- React 18 + TypeScript (strict) + Vite 6 + Tailwind 3; roteamento TanStack Router 1.170; dados TanStack Query 5; Supabase JS 2 (Auth + PostgREST + Storage).
- PDFs com jsPDF, planilhas com xlsx, ambos carregados sob demanda.
- Scripts: `dev`, `build` (tsc + eslint + vite build), `lint`, `test` (vitest), `check` (novo: tipos + lint + testes + build), `db:check` (novo: migrations do zero + smoke de RLS em banco descartável).
- Hospedagem prevista: Render (arquivo `render.yaml`, site estático com rewrite para `index.html`). Sem CSP configurada.
- Integração contínua: não existia. Adicionado `.github/workflows/ci.yml` com dois jobs (app e banco). Ainda não executado no GitHub (a branch precisa ser enviada e o Actions habilitado).

## Rotas, telas e perfis

- 16 perfis com menu (`src/data/profiles.ts`): master, direcao, administracao, coordenacao, enfermeira, enfermagem, cuidador, medico, multidisciplinar, farmacia, nutricionista, hotelaria, lavanderia, servicos_gerais, familia, obra_prestador. Todos são reais; nenhum está "em construção".
- 165 rotas de menu sob `/app/$perfil/...` (`src/router.tsx`); as mesmas telas são registradas para qualquer segmento de perfil. A trava de navegação está no `AppShell`: o segmento tem de ser o perfil do usuário (Master é isento) e, desde 24/09, perfis externos (família e construtora) só abrem rotas do próprio menu.
- Módulos: operação clínica (checklist, medicação, intercorrências, eliminações, plano de cuidados, escalas e plantão), médico (prescrições, evolução, IVCF, testes cognitivos, admissão), farmácia (estoque por hóspede, dispensação, livro de controlados, resgate), nutrição, hotelaria e manutenção, lavanderia e enxoval, RH, financeiro (mensalidades, cobrança, demonstrativo, upselling), CRM e agenda de visitas, vigilância sanitária, portal da família, módulo Obra (fases, cronograma, medições, NF, caixa dos sócios) e portal da construtora.

## Funcionalidade real, demonstração e mocks

- Não há mocks de tela no código de produção: todas as leituras e escritas vão ao Supabase.
- Dados de demonstração: o seed das migrations (residentes `a0000000-…`, usuários `@blueseniorliving.com.br`) e o cenário de demo (`demo-assets/`, usuários `@demo.local`). **Os dois estão no projeto de produção.** Há script de limpeza para o cenário de demo (`demo-assets/seed/DEMO_LIMPEZA.sql`).
- Dados fixos no código: contatos do Responsável Técnico (nome, CRM, CPF) em `src/lib/relatorioSanitario.ts` (vai no bundle público); assinatura do sócio-diretor em `src/lib/extratoSocios.ts`.
- Erros silenciados: 39 pontos que devolviam lista vazia em caso de erro (corrigidos no módulo Obra e no caixa em 24/09; restam os de `src/lib/storage.ts`, que devolvem `null` em upload, e `familia/PlanoCuidados.tsx`); 36 desestruturações `const { data } = await supabase…` sem ler `error` (parcialmente corrigidas).

## Fluxos de leitura e escrita

- A interface fala direto com o PostgREST via chave pública; não há camada de servidor própria. Toda autorização efetiva é RLS mais funções `SECURITY DEFINER` (RPCs) no Postgres.
- Escritas críticas por RPC: dispensação (atômica, com trava), livro de controlados (append-only com hash encadeado), pagamento de medição e marco na Obra, submissão de BM, planejamento de atividade, troca de senha por Master, solicitações de acesso e reset (anônimas).
- Escritas críticas SEM RPC (não atômicas, no cliente): criar e editar prescrição (suspende e reinsere), evolução de admissão (várias tabelas), definir dieta, aplicar modelo de rotina, pagar NF (itens um a um), baixa de estoque em viagem (lê e grava).

## Schema, migrations, RLS, storage

- 134 migrations em `supabase/migrations/`, aplicadas manualmente no SQL Editor (não há CLI nem tabela de controle de versão). A 0001 faz `drop table … cascade` de 15 tabelas: é o script de criação inicial e não pode ser reexecutado em base com dados. As de reversão (0130, 0132) só se aplicam quando se quer desfazer; a 0129 está marcada como revertida e não deve ser reexecutada.
- RLS ligada em todas as tabelas de `public` (nenhuma `disable row level security` vigente). `demo_all` não existe mais. As únicas policies para `anon` são da agenda pública de visitas (leitura de disponibilidade e inserção de agendamento).
- Identidade: `app_perfil()` resolve o perfil pela linha ativa de `usuarios` com o e-mail do JWT (desde a 0133 devolve `'sem_perfil'` em vez de NULL; e-mail com índice único). `app_residente_familia()` dá o residente da família.
- Storage: buckets privados; policies por perfil e pasta desde a 0133; bucket `obra` com pastas por papel.
- Residentes tem 28 chaves estrangeiras com `ON DELETE CASCADE`; desde a 0134 um trigger recusa a exclusão quando há histórico assistencial.

## Autenticação e autoria

- Supabase Auth com e-mail e senha; recuperação por link; sessão persistida em `localStorage`; sem expiração forçada além da do Supabase.
- Perfil vem de `usuarios` (não do JWT). Modo Camaleão (Master "vê como" outro perfil) é só no cliente; a RLS sempre vale para o Master real.
- Autoria: até a 0134, 80 colunas `*_por` (texto) eram preenchidas pelo cliente com `usuarioAtual.nome` (identidade EFETIVA, ou seja, a encarnada no Camaleão). Agora um trigger genérico grava o nome do usuário autenticado no servidor em 77 tabelas. Exceções: `fc_*` e `livro_controlados` (ver achados).

## Testes, CI, observabilidade

- Unitários: vitest, 127 testes em 10 arquivos, só funções puras (cálculos da obra, caixa, faturamento, datas, classificação, sincronização).
- Integração com banco: `scripts/db-check.sh` (novo) cria um banco descartável, aplica stubs do Supabase e todas as migrations, e roda `supabase/tests/rls_smoke.sql` (36 verificações por perfil). Executado localmente com sucesso em 25/09.
- Ponta a ponta: crawler Playwright (`demo-assets/`-style, fora do repositório) que abre as 165 rotas dos 16 perfis com a API emulada sobre Postgres local. Verifica renderização, erros de console, textos suspeitos e estouro horizontal a 400 px. Não verifica persistência real nem RLS.
- Observabilidade: nenhuma (sem Sentry ou equivalente, sem logs de aplicação). Erros vão ao console do navegador.

## Revalidação dos pontos da inspeção anterior

- Seleção de perfil sem login (`src/routes/SelecaoPerfil.tsx`): **não existe mais**. A entrada é `src/routes/Login.tsx`, com Supabase Auth.
- Perfil obtido da URL (`src/router.tsx`): **ainda é o desenho** (rotas sob `/app/$perfil`), mas o `AppShell` compara o segmento com o perfil real e redireciona; a RLS não depende da URL. Confirmado no crawler e no smoke.
- Policy `demo_all` ampla: **removida**; nenhuma policy `using (true)` para `anon` além da agenda.
- `DROP TABLE … CASCADE` na 0001: **presente**; é o bootstrap. Documentado como "nunca reexecutar" em `04-procedimento-operacional.md`.
- `CUIDADOR_ATUAL` para autoria: **é um alias de `usuarioAtual`** (identidade efetiva). Continua sendo enviado pelo cliente em 59 arquivos, mas desde a 0134 o servidor sobrescreve as colunas de autoria com o usuário autenticado.
- Ausência de script de testes e lint limitado ao TypeScript: **`npm test` existe (vitest)**; eslint roda no build; adicionados `check`, `db:check` e o workflow de CI.
