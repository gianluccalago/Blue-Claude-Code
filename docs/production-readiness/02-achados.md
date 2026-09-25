# 02 · Achados

Gravidade: **Bloqueador** (acesso indevido, perda ou corrupção de dados, autoria falsa, gravação no residente errado, indução a erro assistencial), **Alto**, **Médio**, **Baixo**. Estado: **Corrigido** (com teste), **Corrigido sem teste automatizado**, **Aberto**, **Decisão pendente**.

Evidência "smoke" refere-se a `supabase/tests/rls_smoke.sql` (rodado por `npm run db:check`); "unit" a `src/**/*.test.ts`; "crawler" ao teste de rotas em navegador (fora do repositório).

## Segurança e identidade

- **SEG-01 · Bloqueador · Corrigido.** RPCs `SECURITY DEFINER` aceitavam usuário sem perfil. `app_perfil()` devolvia NULL para inativo, `sem_acesso` ou conta de cadastro público; `if NULL not in (...)` nunca disparava a exceção. 12 funções afetadas, inclusive `admin_definir_senha` (troca da senha do Master) e `obra_pagar_medicao/marco`. Além disso o EXECUTE nunca fora revogado de `anon`. Arquivo: `0133_endurecimento_seguranca.sql` (seções 1 e 2). Teste: smoke `inativo não paga marco`, `inativo não troca senha do master`, `anon não executa obra_pagar_marco`.
- **SEG-02 · Bloqueador · Corrigido.** Policies "não é família" (`app_perfil() <> 'familia'`) em 25 tabelas liberavam prontuário, escala e modelos de rotina para a construtora e para perfis não clínicos. Corrigido com listas de permissão (equipe interna lê; equipe clínica grava; família só o próprio). Teste: smoke, 12 verificações da construtora e 8 da família.
- **SEG-03 · Bloqueador · Corrigido.** `usuarios` legível por qualquer logado (salários, contatos, vínculo família↔residente) e a tela de remuneração alcançável por URL. Corrigido: própria linha ou equipe interna; perfis externos limitados ao próprio menu (`AppShell`). Teste: smoke `só vê a própria linha em usuarios`.
- **SEG-04 · Bloqueador · Corrigido.** Sete buckets de fotos e comprovantes com policy só por bucket. Corrigido por perfil e pasta; construtora sem `nf/comprovantes/`. Teste: smoke (fotos da família, intercorrências, comprovantes de materiais, `nf/comprovantes`).
- **SEG-05 · Bloqueador · Corrigido.** `fc_lancamentos_bkp_0131` sem RLS e acessível com a chave pública. Teste: smoke `backup do caixa fora do alcance`.
- **SEG-06 · Bloqueador · Corrigido.** Escalada de perfil: administração e direção podiam se promover; coordenação podia duplicar o e-mail do Master e rebaixá-lo. Corrigido com índice único em `lower(email)` e trigger. Teste: smoke, 3 verificações.
- **SEG-07 · Alto · Corrigido (banco local).** Inativar ou marcar `sem_acesso` não revogava a credencial. Trigger bane em `auth.users` e apaga refresh tokens. Limitação: comprovado só no stub; validar no Auth real em homologação.
- **SEG-08 · Bloqueador · Corrigido.** Autoria escolhida pelo cliente em 80 colunas `*_por`; no Modo Camaleão o Master gravava como a pessoa encarnada. Trigger genérico grava o nome do autenticado em 77 tabelas (`0134`). Teste: smoke `autoria da medicação vem do servidor`. Limitações: `livro_controlados` fora (o hash encadeado inclui o autor enviado à RPC; mover o autor para dentro da RPC é o próximo passo — Aberto como SEG-08b); as colunas de autoria continuam como TEXTO (nome), não como id de usuário.
- **SEG-09 · Alto · Corrigido sem teste automatizado.** Redefinir senha com qualquer sessão ativa; agora só pelo link de recuperação, encerrando outras sessões. "Resetar para blue" substituído por link oficial. Resolução do usuário sem curinga no `ilike`. Cache limpo no logout e na troca.
- **SEG-10 · Bloqueador · Aberto (fora do código).** 31 de 32 contas de produção com senha "blue"; 14 contas de demonstração ativas em produção. Ver `05-status-continuidade.md`.
- **SEG-11 · Médio · Aberto.** Política de senha: mínimo 6 caracteres e "Secure password change" desligado no painel. Recomendação: mínimo 10, ligar a opção.
- **SEG-12 · Médio · Aberto.** CPF, nome e CRM do Responsável Técnico no bundle público (`src/lib/relatorioSanitario.ts`). Mover para `configuracao` com leitura restrita.
- **SEG-13 · Médio · Aberto.** Sem CSP no `render.yaml`; sessão em `localStorage` (um XSS leva o token). Sem XSS identificado no código (não há `dangerouslySetInnerHTML`; React escapa por padrão), mas a defesa em profundidade está ausente.
- **SEG-14 · Médio · Aberto.** Colunas financeiras e pessoais do hóspede (`mensalidade_valor`, CPF do responsável) legíveis por hotelaria, farmácia, nutrição e cuidadores designados; salários dentro de `usuarios` visíveis para toda a equipe interna. Solução: tabela ou view separada.
- **SEG-15 · Baixo · Aberto.** `xlsx` 0.18.5 com vulnerabilidade conhecida sem correção no npm (o app só escreve planilhas); `dompurify` transitivo com correção disponível via `npm audit fix`.

## Integridade do banco

- **BD-01 · Bloqueador · Corrigido.** 28 cascatas a partir de `residentes`; a gestão podia apagar um hóspede e levar o prontuário. Trigger recusa quando há histórico. Teste: smoke `master não apaga hóspede com prontuário`.
- **BD-02 · Médio · Corrigido.** Faltavam índices em `residente_id` em 10 tabelas clínicas e no par `(residente_id, administrado_em)`. Sem medição de desempenho antes e depois (volume atual pequeno).
- **BD-03 · Médio · Corrigido.** Estoque por hóspede com quantidades inteiras: meia dose não baixava. Colunas migradas para `numeric(10,2)`.
- **BD-04 · Alto · Aberto.** Escritas não atômicas no cliente: prescrição (editar, admissão), dieta, modelo de rotina, pagamento de NF, baixa de viagem. Precisam de RPC transacional (ver CLI-01).
- **BD-05 · Médio · Aberto.** Sem unique em `administracao` (residente, período, dia) nem em `tarefa_registro`: duplo clique cria dois registros. Mantido porque "registrar de novo" é o fluxo de correção; decisão em `03-decisoes-pendentes.md`.
- **BD-06 · Baixo · Aberto.** Tipos TypeScript × schema: `residentes.cpf` existe no tipo e não no banco (o código lê como opcional); a comparação automática apontou 70 colunas de tabelas auxiliares (crm_etapa, obra_ensaios, obra_documentos…) ausentes no bloco `Row` do tipo — provavelmente tipadas em outra forma; não afeta o build. Verificação: script ad hoc em 25/09; sem teste permanente.
- **BD-07 · Alto · Aberto.** Instalação limpa validada (134 migrations em banco descartável, 0 erros). Atualização de versão anterior com dados preservados validada só para o caixa (0120→0131→0133→0134 sobre cópia). Restauração de backup nunca executada.

## Fluxos assistenciais

- **CLI-01 · Bloqueador · Aberto.** Edição de prescrição suspende antes de inserir; falha no insert deixa o hóspede sem a medicação nas telas. Admissão insere prescrições antes do documento; repetir duplica. Arquivos: `useMedico.ts`, `useEvolucaoAdmissao.ts`. Correção proposta: RPC `editar_prescricao` e `registrar_admissao` transacionais.
- **CLI-02 · Alto · Aberto.** Checklist e status "em atraso" viram o dia à meia-noite no plantão noturno (`useChecklist.ts`, `Checklist.tsx`). Depende de definir a "data do plantão" para tarefas após a meia-noite.
- **CLI-03 · Alto · Aberto.** Pendências de medicação da Coordenação somem à meia-noite sem resolução e não fecham quando há "sim" posterior (`useCoordenacao.ts`, `Painel.tsx`).
- **CLI-04 · Alto · Corrigido sem teste automatizado.** Dose da noite aparecia "não registrada" depois da meia-noite no noturno. Janela agora começa no início do turno (`useMedicacao.ts`, `Medicacao.tsx`).
- **CLI-05 · Alto · Decisão pendente.** Posologia padrão sugere horários incompatíveis com "8/8h" e "6/6h" (`Prescricoes.tsx`). Não alterado por ser regra clínica.
- **CLI-06 · Alto · Aberto.** Modelo de rotina aplicado duas vezes duplica todas as tarefas (`usePlanos.ts`).
- **CLI-07 · Alto · Aberto.** Day Care excluído de prescrição, plano, dieta, atividades e do painel da Coordenação (`useResidentes` em `usePlanos.ts`).
- **CLI-08 · Médio · Aberto.** Alerta de eliminação marcado "reincidente" para sempre a partir de qualquer silenciamento antigo (`useEliminacao.ts`).
- **CLI-09 · Médio · Aberto.** Medicação continua registrável para hóspede que saiu da lista de designados, sem cabeçalho de identidade (`Medicacao.tsx`).
- **CLI-10 · Médio · Decisão pendente.** Cuidadora pode marcar tarefas de responsabilidade da enfermagem (`Checklist.tsx`).
- **CLI-11 · Médio · Decisão pendente.** Sem proteção no banco contra registro duplicado de administração por período.
- **CLI-12 · Alto · Corrigido.** Alergias e altura informadas pelo médico não chegavam ao cadastro (RLS negava sem erro). Policy + trigger de colunas (`0133`). Teste: smoke `médico grava alergia`.
- **CLI-13 · Alto · Corrigido sem teste automatizado.** Prescrição salva sem quantidade e sem retorno de erro. Quantidade obrigatória por período; erro e sucesso exibidos.
- **CLI-14 · Alto · Corrigido.** Contatos de emergência fictícios na tela de intercorrência. Agora SAMU + telefone do plantão configurado.
- **CLI-15 · Médio · Aberto.** Alergia comparada por texto inteiro; "Alérgico a dipirona" não casa com "DIPIRONA 500MG" (`lib/alergia.ts`).
- **CLI-16 · Médio · Aberto.** Estorno duplo no livro de controlados permitido pela RPC (`0098`); "dispensar de novo" sem efeito com sucesso falso; ajuste de provisionamento não corrige saldo.

## Escalas e plantão

- **ESC-01 · Médio · Aberto.** Colisão de turnos compara timestamps como texto em formatos diferentes (`useTurnos.ts`).
- **ESC-02 · Médio · Aberto.** Check-in do checklist ignora GPS e apaga check-out; modal aceita fim antes do início (`usePlantao.ts`, `TurnoModal.tsx`).
- **ESC-03 · Médio · Aberto.** Ajuste manual de ponto sem rastro de quem ajustou nem do valor anterior.

## Financeiro e gestão

- **FIN-01 · Bloqueador (números) · Corrigido sem teste automatizado.** Faturamento sobre os ativos de hoje. Novo `useResidentesDoMes` (admitidos até o fim do mês; saídos dentro ou depois do mês). Mensalidade continua cheia na entrada e na saída (pró-rata é decisão).
- **FIN-02 · Alto · Aberto.** Inadimplência com duas definições opostas; vencimento padrão nunca vira "vencido" sem registro.
- **FIN-03 · Alto · Aberto.** Ocupação divide hóspedes por suítes; aderência ao plano inclui inativos; alertas críticos contam o histórico inteiro.
- **FIN-04 · Alto · Aberto.** Custo de pessoal do card difere do gráfico; inativar apaga custo retroativo; preço de fallback segue grau clínico.
- **FIN-05 · Alto · Corrigido.** Parse de dinheiro multiplicava por 100 ao editar (baseline, custos, disciplinas) e lia "12.500,00" como 12,5 (NF, materiais, livro, CRM). `lerReais` em 15 pontos. Teste: unit `lerReais`.
- **FIN-06 · Alto · Corrigido.** Caixa: paginação, sincronização só com todas as fontes, erros propagados, desfazer limpa o caixa, conciliação "Triade", editor do extrato não corrompe linhas sincronizadas, IPCA corrige meses sem desembolso. Teste: unit (`useFluxoCaixa.test.ts`, `fluxoCaixa.test.ts`).
- **FIN-07 · Médio · Aberto.** CRM: etapa guardada por nome (renomear deixa órfãs); oportunidade não editável; curta permanência com status em dois lugares.

## Módulo Obra

- **OBR-01 · Alto · Corrigido.** Construtora podia inserir NF já "paga", faturar item em duas NFs, assinar RDO como Contratante e alterar a resposta do Contratante. Policy + triggers (`0133`). Teste: smoke `construtora não insere NF já paga`; teste manual do item duplicado em 24/09.
- **OBR-02 · Alto · Decisão pendente.** Construtora move prazos e lança avanço 100% (vira "Concluído"), e a multa é calculada contra o prazo que ela edita.
- **OBR-03 · Médio · Aberto.** Medição faturada pelo líquido; status de fase editável permite liberar retenção duas vezes; desfazer medição desalinha o ledger; pagamento de NF item a item sem transação; data de pagamento das RPCs em UTC.
- **OBR-04 · Médio · Aberto.** OC com status por entrega; glosa mistura unidades; "recorrente/mês" soma todos os meses.

## Interface e qualidade

- **UX-01 · Médio · Aberto.** Foco de teclado invisível (outline global removido); 81 botões só com ícone sem nome; 193 rótulos não associados; 15 tabelas sem rolagem própria.
- **UX-02 · Médio · Aberto.** 38 dos 47 diálogos não fecham com Esc; nenhum prende o foco. (Portal e centralização: corrigidos em 24/09, 27 modais.)
- **UX-03 · Alto · Corrigido.** Sem ErrorBoundary/404; dezenas de mutations sem tratamento de erro. Tela de erro em português; tratador global com mensagens traduzidas.
- **UX-04 · Médio · Aberto.** Bundle único de 2,2 MB (sem carregamento por rota).
- **UX-05 · Médio · Aberto.** 79 cópias das classes de input; 15 navegadores de mês copiados; 6 leitores de número; helpers de data em 4 versões.
- **UX-06 · Médio · Aberto.** Painéis do Master e da Administração ignoram erros de algumas consultas e mostram "sem dados".
- **UX-07 · Médio · Aberto.** Upload de foto da intercorrência que falha é engolido: ocorrência salva sem foto e toast de sucesso.
- **UX-08 · Baixo · Aberto.** Mensagens de desenvolvedor visíveis ("rode a migration…"); CSV com ponto decimal e sem neutralizar fórmulas; fotos sem redimensionar.
