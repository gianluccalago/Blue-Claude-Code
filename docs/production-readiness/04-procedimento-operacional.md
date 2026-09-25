# 04 · Procedimento operacional

## Instalação e execução local

```bash
git clone https://github.com/gianluccalago/Blue-Claude-Code.git
cd Blue-Claude-Code
npm ci
cp .env.example .env        # preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm run dev                 # http://localhost:5173
```

Verificação completa (o que a CI roda):

```bash
npm run check               # tipos, lint, 127 testes, build
npm run db:check            # exige um Postgres 16 descartável: PGHOST/PGPORT/PGUSER/PGPASSWORD
```

`db:check` cria um banco novo, aplica `supabase/tests/stubs-supabase.sql`, todas as migrations na ordem (menos as listadas em `supabase/tests/skip.txt`) e o smoke de RLS por perfil. Ele apaga o banco que criou. Nunca aponte para o projeto real.

## Variáveis de ambiente (sem segredos)

- `VITE_SUPABASE_URL` — URL do projeto Supabase.
- `VITE_SUPABASE_ANON_KEY` — chave pública (anon/publishable). É a única chave no cliente. A autorização real é a RLS.
- Não existe chave `service_role` no código nem nas variáveis do front. Se alguma vez aparecer, revogue no painel.

## Build de produção e hospedagem

- `npm run build` gera `dist/` (validado em 25/09: 2367 módulos, sem erro). O `postbuild` copia `index.html` para `404.html` (rotas do lado do cliente).
- Render (`render.yaml`): site estático com rewrite de `/*` para `index.html`. Verificar após cada deploy: `/` (login), `/redefinir-senha` (link do e-mail), `/app/master`, uma rota funda (`/app/cuidador/checklist`) e o 404 (`/xyz` deve mostrar "Página não encontrada").
- Pendente: cabeçalhos de segurança (CSP, `X-Frame-Options`, `Referrer-Policy`) no `render.yaml`.

## Migrations em produção

- Aplicação manual no SQL Editor, na ordem numérica. Não há tabela de controle; registre no `05-status-continuidade.md` (ou no seu controle) a última aplicada.
- **Nunca reexecutar a `0001_init.sql`** em base com dados (faz `drop table … cascade`). **Nunca reexecutar a `0129`** (marcada como revertida). A `0130` e a `0132` são reversões: só se quiser desfazer a 0129 ou a 0131.
- Todas as demais são idempotentes (`if not exists`, `drop policy if exists`, guardas de existência). Reexecutar não causa dano.
- Pendentes de aplicação em produção em 25/09: **0133** e **0134**.
- Reversão: cada migration de dados que remove algo cria backup antes (`fc_lancamentos_bkp_0131`) e tem a reversão numerada. Para policies e triggers, a reversão é reaplicar a migration anterior da mesma tabela; não há script automático. Antes de qualquer migration em produção: backup manual (Database → Backups) ou `pg_dump` do schema `public`.

## Logs, monitoramento e resposta

- Estado atual: sem monitoramento de erros no cliente e sem logs de aplicação. Erros só no console do navegador; o tratador global mostra toast e registra `console.error("[mutation]")`.
- Recomendação mínima antes do piloto: um coletor de erros do front (Sentry ou equivalente) com o cuidado de NÃO enviar payloads com dados assistenciais (mascarar `residente_id`, nomes e textos livres); alertas do Supabase para uso de CPU, conexões e erros 5xx; revisão semanal dos logs de Auth (logins falhos).
- Procedimento de resposta: erro assistencial reportado → registrar hora, perfil, tela e hóspede (id) → conferir no banco os registros do período (`administracao`, `tarefa_registro`, `intercorrencia`) → corrigir o dado com um registro novo (nunca editar histórico) → anotar no `log_alteracao` quando for financeiro.

## Backup e restauração

- Supabase faz backup diário nos planos pagos (confirmar o plano e a retenção no painel: Database → Backups). PITR só em planos superiores.
- **Restauração nunca foi validada.** Procedimento a executar em homologação: criar um projeto vazio, restaurar o último backup, aplicar as migrations pendentes, rodar `supabase/tests/rls_smoke.sql` adaptado e abrir o app apontando para esse projeto. Registrar duração e problemas.
- Complemento recomendado: `pg_dump` semanal do schema `public` guardado fora do Supabase.

## Atualização e reversão do app

- Atualizar: enviar a branch, aguardar a CI verde, aplicar as migrations novas no SQL Editor **antes** do deploy do front (o front novo pode depender de coluna nova), depois o deploy no Render.
- Reverter o front: redeploy do commit anterior no Render. Se a migration nova adicionou coluna ou policy, o front antigo continua funcionando (as migrations são aditivas); se removeu algo, use a reversão numerada correspondente.

## Roteiro de homologação humana (fluxos assistenciais)

Executar em projeto de homologação separado, com dados fictícios, por pessoas de cada perfil:

1. Cuidadora, plantão diurno: check-in; checklist do hóspede A (marcar, desfazer, justificar); medicação da manhã "sim, todas" e da tarde "parcial" com item faltante; registrar eliminação; registrar intercorrência com foto; check-out.
2. Cuidadora, plantão noturno atravessando a meia-noite: registrar a dose da noite às 20h, confirmar às 00h30 que continua registrada; checklist das 22h e das 06h (ver decisão 3).
3. Enfermagem: administrar injetável; registrar procedimento; ver as pendências da cuidadora.
4. Coordenação: painel de pendências; resolver, escalar ao médico, silenciar alerta e vê-lo voltar; designar cuidadora a hóspede; criar escala com noturno; ajustar ponto.
5. Médico: nova prescrição com alergia cadastrada (alerta obrigatório); editar prescrição; suspender; evolução e IVCF (conferir que o grau mudou); receita em PDF; fila de escalados.
6. Farmácia: provisionar estoque com meia dose; dispensar; estornar; livro de controlados (lançar e verificar integridade).
7. Família: portal só do próprio hóspede; solicitação; fotos; plano de cuidados.
8. Administração: mensalidade com centavos; cobrança do mês com um hóspede que saiu no meio do mês; demonstrativo.
9. Master: inativar um usuário e confirmar que ele não entra mais; Modo Camaleão só leitura (ver decisão 15).
10. Construtora: portal com RDO, entrega e NF; confirmar que não vê nada além do próprio menu.

Critério de aprovação de cada item: o dado persistiu após recarregar a página, apareceu na tela do outro perfil envolvido e ficou com a autoria correta.

## Plano de piloto

- Duração: 2 semanas, um turno diurno e um noturno, com 3 a 5 usuários (coordenação, duas cuidadoras, médico, farmácia) e no máximo 3 hóspedes reais **somente após** a rotação de senhas, a remoção ou bloqueio das contas de demonstração e a aplicação das migrations 0133 e 0134.
- Acompanhamento diário: revisão dos registros do dia (medicação, checklist, intercorrências) contra o papel da casa; lista de divergências; correções em commits pequenos com teste.
- Saída do piloto: zero divergência assistencial não explicada por 5 dias seguidos; backup restaurado com sucesso pelo menos uma vez; decisões 1 a 4 e 13 a 15 tomadas.
