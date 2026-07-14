# Módulo Obra — estado da implementação

Acompanhamento da construção da ILPI (13.688,56 m², Curitiba, construtora
TRÍADE — MO por empreitada por medida R$ 914,66/m² + projetos R$ 500.000).
Princípio inegociável: **nenhum percentual subjetivo** — avanço físico = etapas
binárias verificáveis in loco (concluído sim/não + foto obrigatória); o
financeiro é consequência aritmética dos pesos.

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

## Módulo completo (Fases 0–7)
**Migrations, na ordem:** 0099 → 0100 → 0101 → 0102 → 0103 → 0104 → 0105.
Todas idempotentes. **Para ativar:** rode-as no Supabase (após a 0098) e crie o
usuário da construtora com perfil `obra_prestador` em Equipe e Acessos.

**Pendências conhecidas (documentadas):**
- Envio de e-mail das notificações (Fase 6) precisa de uma Edge Function/provedor
  — a fila `obra_notificacoes` e o feed in-app já estão prontos.
- Trava dos pesos das etapas "após 1ª medição" (Fase 1) é por UI/auditoria; um
  trigger duro pode endurecer se desejado.
