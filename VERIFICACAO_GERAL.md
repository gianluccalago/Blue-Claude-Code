# Verificação geral de integridade — Blue Senior Living

Sweep após a grande leva (ciclo de vida do hóspede, modalidades, consolidação de
indicadores, CRM/funil, custos de materiais, 13º, módulo+painéis de RH, NPS
setorial, análise de saídas, day care/diárias). **Nenhuma funcionalidade nova** —
só verificação, correção de regressões (mudança mínima) e registro.

Status final: **build verde · typecheck verde**.

---

## 1) Build e tipos
- ✅ `tsc -b --noEmit` e `vite build` passam.
- ✅ Tipos Supabase cobrem TODAS as tabelas novas: `custo_material`,
  `tabela_diaria`, `cobranca_temporaria`, `rh_ausencia`, `rh_afastamento`,
  `rh_desligamento`, `enxoval`, `enxoval_movimento`, `baixa_viagem`,
  `registro_peso`, `log_alteracao`, `configuracao` — e os campos novos em
  `residentes` (sexo, status_hospede, data_saida, motivo_saida, modalidade,
  data_inicio_estadia, data_fim_prevista, numero_hospede) e `upselling.recorrente`.
- ℹ️ Único `as never` remanescente: `headCount(tabela)` em `useNotificacoes.ts`
  (helper genérico de contagem por nome de tabela dinâmico). NÃO é lacuna de
  tipos de tabela nova — mantido.

## 2) Filtro "ativo" (regressão mais provável) — CORRIGIDO
Hooks centrais já filtravam (`useResidentes`, `useHospedesDesignados`,
`useResidenteFamilia`, escalados do médico, alertas da coordenação, contadores
de notificação, join do painel da farmácia). Encontrados e corrigidos vazamentos
em telas que liam tabelas GLOBAIS sem cruzar com a lista de ativos:

- **ACHADO:** Coordenação › Intercorrências listava de `useTodasIntercorrencias()`
  sem filtrar por hóspede ativo → intercorrência de inativo vazava.
  **CORREÇÃO:** filtrar por `info.has(i.residente_id)` (mapa de ativos).
- **ACHADO:** Coordenação › Painel (visão geral) contava/listava
  medicações/intercorrências pendentes de inativos (hooks `useMedicacoesPendentesHoje`
  / `useIntercorrenciasRecentes` não filtram por status).
  **CORREÇÃO:** filtrar `medsAbertas`/`intercAbertas`/`intercorrenciasHoje` por
  `ativosIds` (de `useResidentes`).
- **ACHADO (coerência):** Master › Painel estratégico e Painel operacional
  contavam "alertas críticos" de inativos.
  **CORREÇÃO:** mesmo filtro por `ativosIds` (inativo não infla alerta).
- ℹ️ Telas que já guardavam corretamente (sem alteração): Médico › Painel clínico
  (`.filter(x => !!x.residente)` contra o mapa de ativos) e
  Coordenação/Enfermagem › Medicação de enfermagem (`if (!residente) continue`).

## 3) Modalidades de estadia — OK + endurecido
- ✅ Curta permanência flui igual à longa (via `useResidentes`), com selo
  "Curta permanência" (FichaHospedeCard, HospedeSelector, Mapa das Suítes).
- ✅ Day care excluído de `useResidentes`/`useHospedesDesignados` (não ocupa
  leito; vive em `useFrequentadoresDayCare` e na tela própria).
- **ENDURECIDO (defensivo):** day care também excluído do join do painel da
  farmácia (`useTodasPrescricoesAtivas`) e do contador total de hóspedes da
  Farmácia (`useNotificacoes`).
- ✅ Encerramento de estadia temporária reaproveita o ciclo de inativação
  (`useRegistrarSaida`) na tela de Day Care e no Mapa.
- ✅ Ocupação de leitos = longa + curta (`useResumoMes.ativos`); day care contado
  à parte (`dayCareAtivos`).

## 4) Indicadores / fonte única — 1 incoerência CORRIGIDA
- ✅ `useResumoMes` é a fonte única; Administração e Master leem dela.
- ✅ Faturamento = mensalidades (longa, de `demo.linhas`) + upselling (TODOS, de
  `demo.upsellingTodos`) + 13º (nov/dez) + cobranças temporárias (TODAS, de
  `demo.cobrancasTemporariasTodas`, inclui day care). Cada parcela somada UMA vez
  (sem duplicar com `demo.linhas.total`, usado só no demonstrativo).
- ✅ Resultado = faturamento − (custo de pessoal + custo de materiais); materiais
  alimentado (deixa de ser "—" com lançamentos).
- **ACHADO:** o gráfico de evolução de faturamento (`useEvolucaoFinanceira`) NÃO
  somava as cobranças temporárias → divergia do faturamento do painel.
  **CORREÇÃO:** incluída a soma de `cobranca_temporaria` por mês na evolução
  (coerente com `useResumoMes`). Comentário desatualizado da definição corrigido.
- ✅ 13º proporcional (mensalidade base × meses no ano ÷ 12, 2 parcelas nov/dez)
  flui via `demo.linhas` sem duplicar.

## 5) Integrações cruzadas — OK
- ✅ Upselling: tabela única; `recorrente` distingue fixos no Mapa das Suítes
  (`fixoPorResidente`).
- ✅ CRM → admissão vincula residente; Funil lê do CRM (leads/visitas/vendas/
  conversão/ticket). LP/CP/SD conectado via `useModalidadePorResidente`.
- ✅ NPS: coleta (Coord/Multi/Nutri) e análise (Master/Adm) intactas; comparativo
  trimestral lê de `nps_pesquisa`/`nps_resposta`.
- ✅ Análise de saídas e matriz tempo×motivo leem de `useResidentesInativos`.
- ✅ Painéis de RH leem de `rh_*` + `turnos`; CID restrito (RLS gestão).

## 6) Permissões / RLS — OK
- ✅ RH (`rh_*`), CRM/`crm_oportunidade` (SELECT Administração na 0074),
  `cobranca_temporaria`/`tabela_diaria`, `custo_material` restritos à gestão;
  CID só grupo. Família lê só o seu (cobrança e demonstrativo filtram o residente).
- ✅ Pessoal "sem acesso" (sem_acesso=true) não loga (AuthProvider bloqueia),
  aparece em Equipe/custos.
- ✅ Família não vê inativo: `useResidenteFamilia` filtra `status_hospede=ativo`.

## 7) Regras de negócio críticas — não alteradas
Nenhuma alteração nas regras de medicação (VO binária do cuidador; injetável/
procedimento da enfermagem; baixa na dispensação), checklist/ponto, IVCF→grau,
PDF assinado pelo prescritor, tabela de preços (só Master). Apenas leituras
ganharam o filtro de ativo onde faltava (acima).

## 8) Estados vazios / dados — OK
- ✅ Telas novas com "sem dados"/"Não informado"; gráficos analíticos exibem
  estado magro graciosamente (combo/pizza com `EmptyState` quando vazio).
- ✅ Mês de referência coerente entre módulos (helpers de `lib/mensalidade`).

---

## NÃO CORRIGIDO — requer decisão
1. **Registros clínicos abertos de hóspede inativado.** Ao inativar, intercorrências/
   pendências/prescrições do hóspede permanecem no banco (histórico preservado) e
   passam a ser FILTRADAS das telas operacionais (correções acima). Decisão: ao
   registrar saída, deve-se AUTO-RESOLVER/encerrar esses registros abertos, ou
   mantê-los apenas ocultos (estado atual)? Hoje: ocultos, dados preservados.
2. **Aplicação da cadeia completa de migrations.** Cada migration nova (0064–0077)
   foi validada isoladamente em Postgres local; a aplicação ponta-a-ponta no
   Supabase do projeto depende de rodar os SQLs pendentes. Confirmar execução das
   migrations 0064–0077 no banco.
3. **Headcount histórico do RH** usa `data_admissao` (backfill 2 anos na 0077) +
   `rh_desligamento`. Para meses anteriores ao backfill, o headcount é aproximado.
   Decisão: importar admissões reais se/quando disponíveis.
