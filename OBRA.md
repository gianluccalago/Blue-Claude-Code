# Módulo Obra — estado da implementação

Acompanhamento da construção da ILPI (13.688,56 m², Curitiba, construtora
TRÍADE — MO por empreitada por medida R$ 914,66/m² + projetos R$ 500.000).
Princípio inegociável: **o dinheiro nunca depende de percentual subjetivo** — a
medição da MO só ocorre com a etapa 100% concluída (verificada in loco, com
foto). O acompanhamento gerencial usa um % de conclusão editável por etapa (com
galeria de fotos datadas para evidência), mas o financeiro segue sendo
consequência aritmética dos pesos e das etapas fechadas.

## Fases executadas

### ✅ Fase 0 — Fundação (migration `0099_obra_fundacao.sql`)
- Papel **`obra_prestador`** (construtora) no constraint de perfil + `PerfilDef`
  "Construtora" (menu só com "Obra"; RLS nega todo o resto no banco).
- **Feature flag** `modulo_obra_ativo` em `obra_config`: desligada, o item some
  do menu (filtro no Sidebar) e a rota mostra aviso amigável.
- **`obra_audit_log`** + trigger genérico (`fn_obra_audit`, SECURITY DEFINER) em
  todas as tabelas `obra_` mutáveis: quem (e-mail do JWT), perfil, ação,
  antes → depois. Leitura master/direção; escrita só pelo trigger.
- **Bucket privado `obra`** com policies (leitura/insert: master, direção,
  prestador; update/delete: master/direção). Paths por entidade
  (`checklist/fase-N/<etapaId>/<ts>`).
- **Seeds dos dados FIXOS do contrato** (não inventados):
  - 4 fases sequenciais (M5 2.952,41 · M3 2.785,30 · M4 2.302,08 · M1+2
    5.648,77 m²), Fase 1 com preço fixo, 2–4 reajustáveis por IPCA.
  - 21 disciplinas do Anexo III com valores/prazos/revisões (sondagem 0
    revisões; estrutural condicionado a laudo+elevadores; BIM 3 rodadas+IFC).
  - Alíquotas: INSS 11% (ativa), ISS Curitiba 5% (ativa — **confirmar CNAE**),
    IRRF 1,2% e CSRF 4,65% (inativas até configurar).
  - Tolerâncias de perdas: concreto 5 / aço 8 / blocos 5 / cerâmicos 10 /
    tintas 5 / demais 5 (%).
  - Parâmetros: retenção 5%, TRD 90d, multa fase 0,05%/d teto 5%, bônus 1%/30d
    teto 2%, projetos 500k, multa projeto 0,15%/d teto 10%, consumíveis 1,5%,
    reposição 3%.
- **Teste de RLS**: roteiro comentado no fim da 0099 (rodar com JWT
  `obra_prestador`: só a flag e a estrutura física são legíveis; alíquotas,
  disciplinas, audit e tabelas do app = 0 linhas/negado).

### ✅ Fase 1 — Estrutura física e etapas verificáveis
- `obra_fases` (status: não iniciada → em andamento → TRP → TRD) com **guarda de
  sequência contratual** (fase N só inicia com TRP da N−1; botão bloqueado
  explica o motivo — regra do projeto).
- `obra_etapas`: curva de pesos padrão semeada nas 4 fases (12 etapas, soma
  100: preliminares 3, fundações 8, estrutura 22, alvenaria 11, cobertura 3,
  impermeabilização 2, instalações 22, revestimentos 20, esquadrias 5,
  louças 2, externas 1, comissionamento 1) — **editável pelo master** (modal
  valida soma = 100); a trava pós-1ª-medição chega com a Fase 2.
- `obra_checklist_execucao`: verificação **binária com FOTO OBRIGATÓRIA**
  (input com `capture="environment"` p/ câmera no canteiro), observação
  obrigatória ao REABRIR etapa concluída. Estado da etapa = registro mais
  recente (histórico completo preservado + auditoria).
- Tela `/app/{master|direcao|obra_prestador}/obra`: cards das 4 fases com
  status + avanço físico; mapa da fase (etapas, peso, última verificação com
  data/autor); iniciar fase (pede IPCA acumulado nas reajustáveis); galeria de
  fotos com carimbo (etapa · data/hora · autor) sobre URL assinada.

## Decisões críticas (onde o prompt cedeu à realidade do app)
1. **Rota**: o prompt pedia `/obra`, mas TODO o app roteia `/app/$perfil/x` e a
   regra 5 do próprio prompt manda seguir o padrão existente → rota plana
   `obra` compartilhada. O prestador só tem esse item de menu.
2. **Carimbo na foto**: data/autor são gravados no REGISTRO (banco + auditoria)
   e exibidos sobre a imagem na galeria — não se queima pixel (frágil,
   pesado no celular do canteiro e não é evidência melhor que o registro).
3. **Testes de cálculo**: Vitest foi adicionado na Fase 2 (`npm test`). As
   funções financeiras vivem em `src/lib/obraCalc.ts` (puras) e são cobertas por
   19 casos com os números do contrato. A UI e as RPCs consomem esses cálculos.
4. **Trava dos pesos**: a condição "trava após a 1ª medição" referencia
   `obra_medicoes` (Fase 2) — o guard definitivo (trigger) entra lá; hoje a
   edição é restrita a master/direção e 100% auditada.
5. **Disciplinas semeadas na Fase 0** (dados fixos), mas leitura restrita a
   master/direção até a Fase 3 definir o que o prestador vê do próprio fluxo.

### ✅ Fase 2 — Medições e pagamentos da MO (migration `0100_obra_medicoes.sql`)
- `obra_medicoes` (BM): mês, fase, etapas reivindicadas, % medido, e SNAPSHOT da
  memória (bruto, retenção 5%, INSS, ISS, outras, líquido). Fluxo canônico
  Pendente → Em análise → Aprovado/Reprovado (c/ motivo) → NF → Pago.
- `obra_medicao_etapas`: etapas de cada BM; uma etapa só é medida uma vez
  (liberada se o BM for reprovado — guarda na app via `useEtapasMedidas`).
- `obra_documentos_mensais` (INSS/FGTS/ISS/folha por mês) = **gate de pagamento**.
- `obra_retencoes_ledger` por fase (retido / liberado_trp / liberado_trd); saldo
  em mãos = Σ retido − Σ liberado. **Só master/direção leem** (financeiro).
- `obra_recebimento_pendencias`: vícios do TRP; o TRD exige 90 dias + todas sanadas.
- **RPCs atômicas (SECURITY DEFINER, auditadas)**:
  - `obra_pagar_medicao` — GATE server-side (4 documentos do mês + NF + status
    Aprovado), marca Pago e posta a retenção no ledger (advisory lock por fase).
  - `obra_emitir_trp` — exige 100% físico verificado + medições pagas; libera 50%.
  - `obra_emitir_trd` — exige 90 dias desde o TRP + pendências sanadas; libera saldo.
- Multa/bônus de fase vs cronograma (`obra_fases.data_fim_prevista` × TRP).
- **Cálculos puros e TESTADOS** (`src/lib/obraCalc.ts` + `obraCalc.test.ts`,
  vitest, 19 casos com os números do contrato): medição/retenção/INSS/ISS/líquido,
  reajuste IPCA, saldo de retenção, multa (teto 5%) e bônus (30d, teto 2%).
  Ex. verificado: Fundações 8% Fase 1 → bruto 216.036,11 · líquido 170.668,52.
- UI em abas (shell `ObraShell`): **Execução** (Fase 1) e **Medições e pagamentos**
  (documentos do mês com contador 0/4, BMs com memória de cálculo, fluxo de
  status, "Aprovar pagamento" bloqueado com o motivo, TRP/TRD com guardas,
  retenções, multa/bônus, pendências). Botões bloqueados sempre explicam o porquê.

### ✅ Fase 3 — Projetos complementares (migration `0101_obra_projetos.sql`)
- `obra_disciplina_marcos`: marcos de pagamento por disciplina, semeados por
  valor — **> R$ 10.000**: Início 25% → R00 40% → R01 25% → Retido 10%;
  **≤ R$ 10.000**: Início 50% → Entrega 50%. Cada marco tem entrega, status
  (Pendente→Em análise→Aprovado/Reprovado→Pago) e valor (snapshot).
- `obra_disciplinas` ganhou `art_url`, `data_base` (base do prazo) e
  `data_conclusao`. Prazo previsto = data-base + prazo_dias (Estrutural: laudo
  geotécnico + estudo de elevadores). Contador de revisões `0/max` com alerta.
- `obra_bim_rodadas`: rodadas de compatibilização (mín. 3 + final com IFC).
- **RPC `obra_pagar_marco`** (atômica, auditada): gate de entrega Aprovada + ART
  da disciplina anexada; o marco **Retido** só libera após a compatibilização
  final do BIM (rodada final com IFC). Ao pagar todos os marcos → disciplina
  Concluída.
- **Multa de projeto** 0,15%/dia sobre a disciplina, teto 10% (calc pura testada).
- UI (aba "Projetos complementares"): resumo global (contratado/pago/BIM),
  lista de disciplinas com status/prazo/multa/revisões/ART e marcos; modal por
  disciplina (data-base, ART, revisões, marcos com pagar/aprovar/reprovar); painel
  BIM (rodadas + registrar com relatório/IFC). Pagamentos bloqueados explicam o motivo.
- Testes: +5 casos (multa de disciplina com Estrutural R$ 98.800; prazo data-base).
  Total **24 casos** verdes.

### ✅ Fase 4 — Materiais (migration `0102_obra_materiais.sql`)
- Cadeia completa: `obra_planejamento_materiais` (lista da construtora, data de
  necessidade/antecedência) → `obra_cotacoes` (mín. 3 fornecedores, escolher) →
  `obra_ordens_compra` (valor comprometido, status, previsão) →
  `obra_recebimentos` (conferência + foto; divergência sinaliza NC → Fase 7) →
  `obra_consumo` (baixa por etapa/fase) → `obra_estoque_reposicao` (3% acabamentos).
- **Perdas × tolerância → glosa** por categoria (consumo real × previsto vs
  tolerância; excedente valorado pelo preço médio das OCs vira proposta de glosa
  na medição do mês). **Curva ABC** dos itens (A≤80%/B≤95%/C).
- **Alertas**: OC sem entrega a ≤7d do prazo; item sem OC a ≤15d da necessidade.
- RLS: planejamento visível ao prestador; cotações/OCs/recebimentos/consumo/
  reposição são master/direção (fornecedores e valores ocultos).
- Cálculos testados (Vitest, +5 = **29 casos**): glosa por categoria e curva ABC.
- UI: aba "Materiais" — métricas, tabela de perdas, curva ABC e as seções da
  cadeia com modais (planejar, cotar/emitir OC, receber com foto, consumo, reposição).

### ✅ Fase 5 — Financeiro consolidado (migration `0103_obra_baseline.sql`)
- `obra_baseline`: orçado por pacote (MO por fase + Projetos semeados do
  contrato; Materiais/Fornecedores/Ensaios/Taxas editáveis pelo master). RLS
  master/direção (financeiro).
- Painel: **orçado × comprometido × realizado × saldo** por grupo (MO = medições
  bruto; Projetos = marcos; Materiais = OCs), com total.
- **Curva S física × financeira** (SVG inline): física = % medido acumulado sobre
  a área total; financeira = pago acumulado sobre o orçado.
- **Custo/m² acumulado**; **contas a pagar** (agenda por vencimento: medições
  Aprovadas, marcos Aprovados, OCs com previsão) e **fluxo de caixa mensal**.
- **Export CSV** de qualquer grade (`lib/exportCsv.ts`, genérico).
- Cálculos testados (Vitest, +6 = **35 casos**): série acumulada mensal, soma por
  mês, custo/m², saldo orçamentário.

### ✅ Fase 6 — Portal do prestador (migration `0104_obra_portal_prestador.sql`)
- Tela própria e isolada (`PortalPrestador`, roteada no `ObraShell` quando o
  perfil é `obra_prestador`): cronograma/avanço das fases, minhas medições
  (status + motivo de reprovação), documentos do mês, entregas de projeto e BIM,
  pendências, feed de notificações. **Nada de financeiro do Contratante.**
- **RPC `obra_submeter_bm`** (SECURITY DEFINER): o prestador escolhe mês + etapas
  concluídas; o servidor VALIDA (etapa da fase, concluída, ainda não medida) e
  CALCULA os valores (bruto/retenção/INSS/ISS/líquido) — entra como Pendente. O
  prestador nunca digita valor.
- **RPC `obra_submeter_entrega`**: upload da entrega de um marco → Em análise.
- RLS pontual: prestador insere/atualiza os 4 documentos mensais, insere rodadas
  BIM e lê o cronograma das disciplinas (sem cotações/OCs/ledger/baseline).
- **Notificações**: fila `obra_notificacoes` + trigger que enfileira "BM
  reprovado"; feed in-app no portal. **Envio por e-mail** depende de uma Edge
  Function/provedor (fora deste repo) — a fila e o feed já ficam prontos; os
  avisos de "documento vencendo / marco próximo" são calculados na tela por data.

### ✅ Fase 7 — Transversais + dashboard executivo (migration `0105_obra_transversais.sql`)
- **Insumos críticos do Contratante** (semeados: elevadores/SPDA/gás/AVAC/gerador/
  laboratório) com responsável, prazo-limite e **semáforo** (verde/amarelo/vermelho).
- **Ensaios** (`obra_ensaios`): agenda + resultado (conforme/não conforme); ensaio
  pendente e atrasado é alerta vermelho.
- **Diário de obra** (`obra_diario`): registro + foto.
- **Não-conformidades** (`obra_nao_conformidades`): apontamento → em correção →
  reinspeção (foto) → encerramento. **NC aberta em etapa BLOQUEIA a aprovação da
  medição** que reivindica a etapa (trigger `before update` em `obra_medicoes`).
- **Documentos da obra** (`obra_documentos`): alvará/ART/CNO-INSS/apólices/licenças
  com vencimento e alertas 30/15/5 dias.
- **Aditivos** (`obra_aditivos`): escopo/valor/prazo + PDF assinado.
- **Painel executivo** (aba "Painel", home do módulo): avanço físico × cronograma,
  próximos pagamentos 30 dias, retenções em mãos, NCs abertas, semáforo de insumos
  críticos, documentos a vencer.
- Cálculos testados (Vitest, +5 = **40 casos**): `nivelPrazo` (semáforo com janelas
  15/30 dias).

### ✅ Hardening + polimento (migration `0106_obra_hardening.sql`)
Auditoria de segurança (2 auditores: SQL e front) pós-Fase 7. Corrigido:
- **[MÉDIA→ALTA] Storage escopado por pasta**: o prestador lia/listava TODO o
  bucket `obra` (inclusive PDFs de aditivos, apólices e laudos). Agora SELECT
  dele é restrito a `checklist/ documentos/ entregas/ bim/ nf/` e INSERT a
  `documentos/ entregas/ bim/`.
- **[MÉDIA] Gate do BIM**: o prestador podia inserir rodada `final=true` com IFC
  e destravar sozinho o marco Retido (10%). Agora só insere rodadas NÃO-finais;
  a final é ato do master/direção.
- **[BAIXA] TOCTOU de NC**: `obra_pagar_medicao` agora reavalia NC aberta nas
  etapas (NC criada entre a aprovação e o pagamento também bloqueia).
- **[Front] Curva S física** tinha fator 100× (saturava em 100%) — corrigido.
- **[Front] ObraControles** ganhou guard de perfil (era a única aba sem) e
  `disabled` nos botões de mutação (revisão de disciplina não era idempotente).
- **[Front] Fail-safe** no join de `useEtapasMedidas` (objeto OU array).

**Polimento de usabilidade:** abas curtas (Medições/Projetos), meses por extenso
("Medição de Janeiro/2026"), tipos de documento e de aditivo viraram dropdowns
(nada de "digite o tipo"), rótulos de ação claros ("Iniciar correção", "Enviar
p/ reinspeção", "Apontar"), pendente de ensaio sem permissão vira selo
"aguardando resultado", nota didática do orçamento removida.

### ✅ Acompanhamento por % + galeria + custos indiretos (migration `0107_obra_acompanhamento_custos.sql`)
Três pedidos de uso (com telas na mão):
- **Execução vira registro de acompanhamento.** Cada etapa agora tem uma **barra
  de percentual de conclusão (0–100, editável)** — não mais só "concluída sim/não".
  A etapa acumula **várias fotos datadas** ao longo do tempo (tabela filha
  `obra_checklist_foto`, N por registro): a galeria mostra a evolução com carimbo
  de data. `obra_checklist_execucao` ganhou `percentual` (backfill = 100 onde já
  concluído) e `foto_url` deixou de ser obrigatória (um registro pode ser só
  atualização de %). O avanço físico passou a ser **ponderado pelo %**
  (`avancoFisico` usa `peso_pct × percentual/100`). **O dinheiro da MO segue
  objetivo:** a etapa só fica medível no BM ao atingir 100% (`etapaConcluida` =
  `percentual >= 100`) — o % serve para visão/gestão, não relaxa a medição.
- **Projetos:** os chips de marco agora exibem **`%`** explicitamente (era só o
  número solto — ambíguo).
- **Nova aba "Indiretos"** (`obra_custos_indiretos`, master/direção): registra
  honorário de engenharia, assinaturas de software, administrativo, taxas e
  gastos gerais **por competência mensal** (com flag de recorrente). KPIs
  (total, recorrente/mês, lançamentos), controle mensal agrupado, evolução e
  CSV. Alimenta o **painel** (5º KPI "Indiretos") e o **financeiro consolidado**
  (grupo `indiretos` no baseline; orçado editável, realizado = soma dos custos).

### ✅ Materiais fora do escopo do prestador (migration `0108_obra_prestador_sem_materiais.sql`)
Decisão do Contratante: **custos de materiais, fornecedores diretos, demais
custos e indiretos não fazem parte do acesso da construtora** e não aparecem para
ela. Os custos já eram master/direção apenas — cotações, ordens de compra,
recebimentos, consumo e reposição (0102); ledger de retenções (0100);
baseline/indiretos (0103/0107); e a storage do prestador é restrita a pastas sem
custo (checklist/documentos/entregas/bim/nf, 0106). Restava a **lista de
planejamento de materiais** (`obra_planejamento_materiais` — quantidades
previstas, sem preços), que o prestador ainda podia LER; a 0108 remove esse
acesso (agora master/direção). O portal do prestador não renderiza materiais, então
não há impacto funcional — apenas fecha a superfície de API. Escopo do prestador:
só o próprio contrato (estrutura física, medições de MO, entregas de projeto/BIM,
documentos do mês e notificações).

### ✅ Cronograma (Gantt) + correção do contrato (migration `0111_obra_cronograma_contrato.sql`)
- **Aba "Cronograma"** (master/direção): Gantt com três seções — **fases** (barra
  plano×real com preenchimento = avanço físico %, linha fina do previsto quando o
  real divergiu, status por cor COM rótulo: concluída/andamento/atrasada/prevista),
  **disciplinas de projeto** (data-base → data-base+prazo, marcador de conclusão)
  e **marcos de prazo** (losangos: insumos críticos, vencimento de documentos,
  ensaios agendados, entregas de OC; vencido = vermelho). Linha de HOJE, grade
  mensal, rolagem horizontal, tooltips por barra. `obra_fases` ganhou
  `data_inicio_prevista`; lápis na linha da fase edita início/fim previstos
  (`useAtualizarFaseCronograma`). Cálculos puros em `lib/obraGantt.ts` (janela,
  posições %, status) com **15 testes**.
- **Correção do contrato:** os **R$ 500.000 de projetos INTEGRAM o total**
  (desconto concedido pela contratada). O seed da 0103 somava MO (área×preço) +
  500k, superestimando o total. A 0111 recalcula a MO por fase = área×preço
  **menos o rateio dos projetos proporcional à área** → TOTAL (MO+projetos) =
  área total × preço = contrato final (R$ 12.520.378,29). **MO e Projetos agora
  são EDITÁVEIS** no financeiro (modal do grupo lista as 4 fases da MO de uma
  vez; projetos com selo "integra o total do contrato"). Atenção: as MEDIÇÕES
  continuam calculadas a área×preço/m² por etapa (regra contratual de medição) —
  se o desconto se materializar como abatimento nos BMs finais, ajuste a MO
  orçada ou o `preco_m2_mo` em obra_config conforme o acerto real.

### ✅ Flexibilização total do acesso interno (sem migration — só front)
Decisão do Contratante: o módulo é ferramenta de **estrito controle interno**
(master/direção) e não alimenta outras abas — rigidez é atrito. O banco já
permitia tudo (policies `for all`); as travas eram do front. O que abriu:
- **Execução:** histórico de acompanhamentos por etapa com **exclusão de
  registro errado** (fotos caem junto, auditoria preserva); **Editar fase**
  (status, datas reais TRP/TRD, IPCA — correção livre); **iniciar fase FORA da
  sequência contratual** com confirmação explícita (checkbox + auditoria);
  editor de etapas completo (**renomear, adicionar, excluir**, pesos — única
  regra dura que ficou: soma 100%; etapa já medida não sai — FK restrict).
- **Projetos:** **Nova disciplina** personalizada (valor, prazo, revisões e
  marcos próprios com % livres somando 100); **editar contrato** da disciplina
  (nome/valor/prazo/revisões — marcos não pagos recalculam; pagos ficam);
  **excluir disciplina** sem marco pago; **desfazer aprovação** de marco.
- **Indiretos:** lançamentos agora **editáveis** (além de criar/excluir).
- **Materiais:** excluir item de planejamento (cotações caem junto; OCs ficam),
  excluir cotação, **cancelar OC** e excluir lançamento de consumo (perdas e
  glosa recalculam).
- **Controles:** **novo insumo crítico** (lista deixou de ser fechada) e
  exclusão em tudo — insumos, ensaios, NCs (excluir NC apontada por engano
  libera a medição), documentos, aditivos e diário.
Invariantes que permaneceram (dinheiro/técnica): pesos = 100%, etapa medida não
some, marco PAGO é imutável, medição via RPC, glosa por tolerância, RLS do
prestador intacta.

### ✅ Cronograma REAL da TRÍADE (migration `0112_cronograma_triade_projetos.sql`)
Os cronogramas entregues pela construtora (XLSX financeiro + PDF físico,
16/07/26 → 18/04/27) SUBSTITUÍRAM as disciplinas genéricas do Anexo III:
- **21 atividades pagas = R$ 500.000 exatos** (fecha com o contrato/0111), cada
  uma com data-base real, duração e marcos reais: **Entrada 50% na data de
  início + R00 25% + R01 25%** (Sondagem: entrega única 100%, já Concluída).
- **10 itens sem desembolso** (IFC arquitetônico, estudos de tráfego/elevadores,
  HVAC e luminotécnico por módulo) com valor 0 — só linha do tempo.
- **Gate de pagamento ajustado ao contrato**: ART agora só é exigida nos marcos
  COM entrega (a Entrada vence no início, antes de existir ART). Retido→BIM
  permanece.
- Financeiro: **entradas pendentes entram nas Contas a Pagar** com vencimento =
  data de início da atividade (agenda de desembolso conhecida de antemão).
- Gantt ordena as disciplinas por data-base (cascata real do projeto).
- Divergência tratada: Hidrossanitário Módulos 1 e 2 = 12/10/26 (PDF); o Excel
  trazia 12/10/27 (digitação — estouraria a data final).
Seed idempotente (sentinela pelo nome da Sondagem) e ABORTA se houver marco
pago (não reescreve dinheiro).

### ✅ Reestruturação: controle da FASE ATUAL (migration `0113_obra_progresso_projetos.sql`)
Com o cronograma real em mãos, o módulo foi reorganizado em torno do que está
VIVO agora (desenvolvimento de projetos) — e não da obra física futura:
- **Nova aba "Central" (padrão)** — o centro de controle do dia a dia:
  · **Ações pendentes**: entradas a pagar (vencendo em ≤7 dias ou vencidas, com
    botão "Pagar entrada" que aprova+paga num clique), entregas R00/R01 em
    análise ("Analisar" abre o workspace) e marcos aprovados a pagar ("Pagar").
  · **Esta semana**: o que começa, o que vence, o que está em andamento (com
    barra de progresso) e o bloco vermelho de atrasadas.
  · **Desembolso mês a mês**: previsto (entrada no início; R00/R01 no prazo) ×
    pago, em barras por mês — a agenda dos R$ 500 mil.
- **Progresso por atividade** (coluna do cronograma da TRÍADE que faltava):
  `obra_disciplinas.progresso_pct` + histórico `obra_disciplina_progresso`
  (apontamento semanal com observação; auditado). Slider no workspace da
  atividade; barras de progresso na lista de Projetos e NAS BARRAS do Gantt;
  atraso real = prazo vencido com progresso < 100.
- **Workspace único da atividade** (`ModalDisciplina` exportado): aberto de
  qualquer lugar (Central, Projetos), concentra progresso semanal, contrato,
  ART, revisões e o ciclo de pagamento entrada→R00→R01.
- **Abas reorganizadas**: Central · Cronograma · Projetos · Financeiro ·
  Indiretos · **Obra física** (agrupa Painel/Execução/Medições/Materiais/
  Controles — prontas para o canteiro, fora do caminho até lá).
- **Financeiro**: contas a pagar agora projetam também R00/R01 pendentes no fim
  do prazo de cada atividade — agenda completa de desembolso.

### ✅ Portal da construtora adequado à fase de projetos (migration `0114_portal_prestador_projetos.sql`)
Nova seção **"Contrato de projetos — andamento e pagamentos"** no topo do
portal do prestador (o que é DELES, e só isso):
- KPIs: progresso geral medido (ponderado por valor), recebido de R$ 500 mil,
  aprovado a receber.
- **Próximos recebimentos** com previsão contratual (entrada na data de início;
  R00/R01 no fim do prazo), "liberado" quando aprovado, alerta quando a
  previsão passou.
- **Suas atividades**: barra de progresso MEDIDO pelo Contratante, recebidos ×
  valor da atividade, prazo, selos (concluída / prazo vencido / sem pagamento).
- RLS: `obra_disciplinas` e `obra_disciplina_progresso` ganharam policy de
  SELECT para `obra_prestador` (o contrato de projetos é da construtora). O
  financeiro do Contratante segue fechado: materiais, cotações, OCs,
  retenções, baseline e indiretos continuam master/direção.

### ✅ Contrato ASSINADO conferido + repositório de arquivos (migration `0115_contrato_assinado_arquivos.sql`)
Contrato TRÍADE assinado em 27/07/26 conferido cláusula a cláusula — o módulo
já batia em: R$914,66/m², áreas das 4 fases, projetos R$500 mil (50/25/25),
multa de fase 0,05%/d teto 5%, bônus 1%/30d teto 2%, multa de projeto
0,15%/d teto 10%, retenção 5% (50% TRP / 50% TRD), reposição 3%, consumíveis
1,5%, IPCA assinatura→início de fase, INSS art. 31/ISS na fonte, planejamento
de materiais 45/60 dias. O que o assinado acrescentou:
- **Pagamento do BM em até 15 dias corridos após a aprovação (8.1.2)** — as
  contas a pagar/painel agora projetam o vencimento como aprovação+15d.
- **Parâmetros novos em obra_config**: taxa de administração de 5% sobre a
  terraplenagem medida/paga (4.7.1 — única exceção de fornecedor direto;
  lançar junto às medições correspondentes), indenização de desmobilização
  R$2.000/evento (6.4), multa por ocorrência R$3.000 (14.3.1), data de
  assinatura (base do IPCA).
- **Obrigações da TRÍADE semeadas em insumos críticos** (para cobrar):
  Cronograma Executivo MS Project do Módulo 5 até 11/08/26 (5.5; demais fases
  60 dias antes), seguro-garantia/fiança de 5% da fase (8.2.2 — condição da
  1ª medição) e apólices (risco engenharia, RC ≥ R$200 mil, vida em grupo).
- **Repositório `obra_arquivos`** (master/direção; bucket obra, pasta
  arquivos/ — fora do alcance do prestador): card "Arquivos do
  empreendimento" na aba Projetos (contrato assinado + gerais) e seção
  "Arquivos da atividade (DWG · PDF · memoriais)" no workspace de cada
  atividade, com upload múltiplo, abrir via URL assinada e exclusão.

### ✅ Portal COLABORATIVO da construtora (migration `0117_portal_colaborativo.sql`)
O portal deixou de ser vitrine e virou canal de trabalho, em 7 abas:
**Início** (contrato de projetos + fases + pendências) · **Cronograma** (o
MESMO Gantt do Contratante — RLS zera custos/prazos internos) · **Insumos** ·
**Medições** · **Fotos** · **Entregas & Docs** · **Solicitações**.
- **Insumos (o coração)**: a TRÍADE pede material com DATA NECESSÁRIA
  (cláusula 6.1: 45/60 dias); nós respondemos na Central com STATUS
  (programado/comprado/negado) + DATA PROMETIDA + observação; ela marca
  "Recebido em obra" e lança BAIXA DE USO (obra_consumo → alimenta o nosso
  controle de perdas/glosa). `obra_planejamento_materiais` ganhou
  origem/status_atendimento/data_prometida/data_entrega/resposta; prestador
  voltou a LER e passou a INSERIR/ATUALIZAR (preços seguem ocultos —
  cotações/OCs/recebimentos continuam master/direção).
- **Medições**: KPIs (medido bruto, recebido líquido, aprovado a receber,
  retido 5%) + lista com valores + submeter BM, inclusive ANTECIPADO (etapas
  100% podem ser medidas a qualquer momento; pagamento em 15 dias).
- **Fotos de andamento**: upload múltiplo (pasta andamento/ liberada no
  storage) com fase + descrição; galeria dos dois lados e destaque na nossa
  Central (miniaturas + ampliação).
- **Solicitações gerais** (`obra_solicitacoes`): medição antecipada, acordos,
  pedidos avulsos — com resposta/status registrados pelo Contratante.
- **Central (nosso lado)**: card "Canais da TRÍADE" com pedidos aguardando
  resposta (modal status+data), solicitações abertas (responder) e fotos
  recentes do canteiro.
- **Adicional acordado**: "Supervisão da terraplanagem — taxa adm. 5%
  (4.7.1)" semeada como atividade sem valor fixo, visível dos dois lados.

### ✅ Diário de Obra — RDO compartilhado (migration `0118_diario_de_obra.sql`)
Pedido do engenheiro da TRÍADE — e peça CONTRATUAL: a prorrogação por chuva
impeditiva (13.2) e a indenização por paralisação (6.4) só valem com registro
no Diário Eletrônico de Obras (10.1.2). Aba **"Diário"** nas DUAS telas
(interno, após Cronograma; e portal da construtora), mesmo componente
(`DiarioObra.tsx`):
- **RDO completo por dia**: clima manhã/tarde (bom/nublado/chuva), flag
  CHUVA IMPEDITIVA (13.2), flag PARALISAÇÃO (6.4 — o form instrui a descrever
  o motivo), efetivo em campo, atividades executadas, ocorrências e VÁRIAS
  fotos (tabela filha `obra_diario_foto`, upload na pasta `diario/`).
- **KPIs do mês** (filtro por mês): dias com registro, dias de chuva
  impeditiva e dias de paralisação — os números que sustentam pleitos de
  prazo/indenização.
- **Autoria visível**: cada card mostra quem registrou + badge
  TRÍADE/Contratante (`perfil_registrador`). Os dois lados leem e registram;
  EXCLUIR é só master/direção (com confirmação; auditoria guarda o rastro).
- A seção antiga "Diário" de Obra física → Controles foi removida (hooks
  antigos de diário saíram de `useObraTransversais.ts`; o RDO vive em
  `useObraDiario.ts`).

### ✅ Faturamento da construtora — NF ↔ pagamento (migration `0119_faturamento_nf.sql`)
Fluxo acordado: DUAS janelas por mês (**dias 1 e 11**). Na janela, a TRÍADE
confere o que está **aferido e confirmado** por nós (marcos e medições com
status Aprovado), emite a NF contra a **Seniors Care Ltda. (CNPJ
42.200.613/0001-85)** e anexa; nós pagamos e anexamos o comprovante.
- **Tabela `obra_notas_fiscais`**: nº, valor, data de emissão, PDF (pasta
  nf/ do bucket), itens cobertos (snapshot jsonb marco/medição), status
  emitida→paga, comprovante, data e autor do pagamento. RLS: os dois lados
  veem e emitem; pagar/editar é master/direção; o prestador só exclui
  enquanto 'emitida'. Auditoria em tudo.
- **Portal (aba "Medições & NF")**: card das janelas (com destaque quando
  HOJE é dia 1/11) + card do TOMADOR (razão social, CNPJ com copiar,
  endereço, e o lembrete da 7.1.5.2 — destacar retenções INSS/ISS/IRRF);
  lista "Aprovado — pronto para faturar" com seleção de itens → modal
  "Anexar NF" (nº, data, valor pré-somado, PDF obrigatório); "Notas
  emitidas" com status e comprovante.
- **Nosso lado**: seção "Notas fiscais da construtora" no Financeiro
  (registrar pagamento com data + comprovante — anexável depois —, desfazer
  pagamento) e as NFs emitidas entram nas **Ações pendentes da Central**.
- **Pagamento da NF paga os itens** pelas MESMAS RPCs com gate de sempre
  (marco: entrega+ART; medição: docs do mês — a NF é espelhada na medição
  para o gate). Marco coberto por NF emitida sai da lista "aprovados a
  pagar" da Central (a ação vira pagar a NF). Tudo reversível: desfazer
  devolve os itens a Aprovado (nova RPC `obra_desfazer_pagamento_medicao`
  remove também o retido do ledger daquele BM).
- `lib/faturamento.ts`: janelas (próxima janela inclusive, virada de
  ano) com testes; dados do tomador centralizados.

## Módulo completo (Fases 0–7 + hardening + acompanhamento + cronograma)
**Migrations, na ordem:** 0099 → 0100 → 0101 → 0102 → 0103 → 0104 → 0105 → 0106
→ 0107 → 0108 → 0111 (0109/0110 são de acesso/login, fora do módulo). Todas
idempotentes. **Para ativar:** rode-as no Supabase (após a 0098) e crie o usuário
da construtora com perfil `obra_prestador` em Equipe e Acessos.

**Pendências conhecidas (documentadas):**
- Envio de e-mail das notificações (Fase 6) precisa de uma Edge Function/provedor
  — a fila `obra_notificacoes` e o feed in-app já estão prontos.
- Trava dos pesos das etapas "após 1ª medição" (Fase 1) é por UI/auditoria; um
  trigger duro pode endurecer se desejado.
