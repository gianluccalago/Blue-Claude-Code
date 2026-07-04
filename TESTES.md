# Testes funcionais — Blue Senior Living

**Escopo:** verificação funcional ponta a ponta dos 12 fluxos do dia a dia da
casa. **Não é auditoria de segurança.** Bugs objetivos corrigidos com mudança
mínima; ambíguos/estruturais em **REQUER DECISÃO**. Nenhuma funcionalidade nova.

**Método (honesto):** não há banco vivo neste ambiente, então a "simulação" é
**rastreamento estático** da lógica — hooks, libs, queries, componentes e
migrations — traçando cada cenário (caminho feliz e caso-limite) e conferindo
invariantes. O que depende de execução real (RLS sob JWT, concorrência, GPS,
conteúdo de PDF/XLSX) está listado em "Não coberto".

**Estado ao final:** `tsc -b --noEmit` limpo · `npm run build` verde.

---

## 1. Sumário — bugs corrigidos

| # | Sev | Fluxo | Bug | Correção |
|---|-----|-------|-----|----------|
| 1 | ALTO | F2 medicação | `parsearQtd` arredondava a dose por administração (`Math.ceil`): meia dose virava 1 comprimido → ziploc/baixa erradas e estoque negativo (~dia 15) | `Dispensacao.tsx`: remove o `Math.ceil` (usa a fração, como os outros parsers) |
| 2 | ALTO | F1 cuidador | Tolerância ±10min inconsistente: `usePlantao` liberava o plantão mas `useHospedes` retornava vazio → "sem hóspedes" para quem chega 5min antes | `useHospedes.ts`: `dentroDoTurno` com a mesma `TOLERANCIA_MS` |
| 3 | ALTO | F1/F4 | Check-out de noturno após a meia-noite sumia (o bloco de ponto só aparecia se `t.data === hoje`) | `MinhaEscala.tsx`: libera o ponto também no noturno da véspera em andamento |
| 4 | MÉDIO | F1/F12 | "Dia civil" das eliminações usava fuso do dispositivo (resto do app usa America/Sao_Paulo) | `useEliminacao.ts` + `Checklist.tsx`: `inicioDoDiaISO()` (SP) |
| 5 | MÉDIO | F10/F12 | "Ontem" da foto do dia calculado em UTC (some às 21h+) | `Inicio.tsx`: `dataISO(somarDias(new Date(), -1))` |
| 6 | MÉDIO | F10 | Recado da equipe renderizava mesmo com hóspede inativado | `Inicio.tsx`: `{r && <CardRecadoEquipe/>}` |
| 7 | MÉDIO | F8 vigilância | Trigger de sentinela marcava "queda com lesão" em negações ("sem lesão", "nega sangramento") → notificação compulsória falsa | Migration `0096`: regex trata negação; casos ambíguos vão à revisão manual |
| 8 | BAIXO | F6/F12 | Segundo `hojeISO` em `mensalidade.ts` device-local (não SP) | Passa a delegar ao `utils.hojeISO` (pinado em SP) |
| 9 | BAIXO | F2 | `trim()` não colapsava espaços internos → "AAS  INFANTIL" ≠ "AAS INFANTIL" no casamento por nome | `useMedico.ts`: `.replace(/\s+/g," ")` antes do `toUpperCase()` |

---

## 2. Resultado por fluxo

### F1 — Ciclo do cuidador
- **OK:** check-in com geolocalização (Haversine, raio 150m, isento vs não) na tela
  Minha Escala; "meus hóspedes" do turno ativo (fora do plantão → vazio); checklist
  bloqueado por `plantao.liberado`; medicação oral binária + motivo de recusa;
  intercorrência sempre livre incl. "Outras" com texto obrigatório; enfermagem vê
  todos (day care só diurno); compromissos com ciência; check-out.
- **Corrigido:** tolerância ±10min (#2), check-out noturno pós-meia-noite (#3),
  dia civil das eliminações (#4).
- **REQUER DECISÃO:** check-in pelo `PlantaoBar` (botão do Checklist/Medicação) grava
  ponto **sem geofence/isenção** — contorna a regra de 150m (o componente admite que
  "geolocalização será acoplada depois"). Ver #A. E "Como foi" do compromisso só
  aparece no dia seguinte (`data < hoje`) — ver #F.

### F2 — Ciclo da medicação
- **OK:** cadeia do nome do medicamento normalizada a MAIÚSCULAS da prescrição →
  estoque/dispensação/viagem/resgate (a RPC 0094 casa por igualdade exata; acento
  preservado consistentemente); cuidador confirma sem tocar estoque; estorno de
  dispensação devolve estoque (RPC atômica); baixa de viagem calcula X dias e
  estorna; hóspede novo no meio do mês vai para "aguardando 1º ciclo"; **PDF sempre
  assinado pelo prescritor** (bloqueia emissão se `prescrito_por` nulo/não-médico).
- **Corrigido:** dose fracionada (#1), espaços internos no nome (#9).
- **REQUER DECISÃO:** "Dispensar de novo" virou no-op silencioso com toast falso de
  sucesso (#B); não-orais provisionados mas nunca decrementados (#C); baixa de viagem
  não-atômica/sem idempotência (#D); prescrição sem quantidade diverge entre estoque
  (=1) e PDF ("uso contínuo") (#E).

### F3 — Cobertura assistencial
- **OK (tudo):** designação individual e em lote por módulo/andar; parsing "1204A" e
  quarto fora do padrão sem quebrar (cai em "sem local"); designação cai quando o
  cuidador sai da escala; hóspede novo nasce descoberto; enfermeira automática da
  escala; risco de cobertura (designado sem check-in); day care só no diurno; RLS de
  escrita inclui enfermagem (0082).

### F4 — Escalas e ponto
- **OK:** colisão de turno bloqueada (intervalo, cobre noturno, ignora o próprio id);
  noturno pertence ao dia que inicia; desconto de 1h de almoço só na carga do PJ 12h
  (não afeta remuneração); ajuste manual de ponto pela Coordenação (soma 1 dia na
  saída do noturno).
- **REQUER DECISÃO:** limite de 3 meses da recorrência só na UI (não no hook) (#G);
  modal permite `fim < inicio` sem marcar "dia seguinte" → timestamps invertidos (#H);
  `turnoCorrente` corta o diurno às 18h enquanto a escala vai até 19h (default) (#I).

### F5 — Ciclo de vida do hóspede
- **OK:** admissão alimenta patologias (dedup normalizado) e prescrição real (só no
  create); curta permanência = longa + selo; day care sem leito (ocupação/proporção
  noturna); inativação some de TODAS as telas operacionais (cada hook filtra
  `status_hospede='ativo'`); RDC/histórico/financeiro corretamente NÃO filtram; suíte
  libera; reativação; óbito concilia agravo + saída "Falecimento" sem duplicar.
- **REQUER DECISÃO:** admissão não é transacional — falha parcial pode duplicar
  prescrição numa retentativa (#J); day care entra no denominador dos indicadores RDC
  (dia 15) — decisão do RT (#K).

### F6 — Financeiro
- **OK:** faturamento = mensalidade + cobrança temporária + upselling + 13º, cada de
  fonte independente (sem dupla contagem); mês sem lançamentos → 0 (sem NaN); 13º
  proporcional (abril → 9/12; nov 2/12; dez 1/12; out 0; ano anterior integral; futuro
  0); upselling das 3 origens convergindo sem duplicar; pacote de sessões = 1
  lançamento; resultado = faturamento − pessoal − materiais; `useResumoMes` é a mesma
  fonte em Administração e Master; demonstrativo da família bate com a Adm.
- **Corrigido:** `hojeISO` device-local (#8).
- **REQUER DECISÃO:** `useResumoMes` (roster ativo agora) diverge de
  `useEvolucaoFinanceira` (roster por data, inclui quem saiu no mês) na MESMA tela,
  para hóspede inativado no mês corrente (#L).

### F7 — Nutrição/cozinha
- **OK:** custo de insumo recalcula prato/cardápio (custo derivado, nunca persistido;
  trilha em `insumo_preco_historico`); desperdício com fallback sem divisão por zero;
  IMC geriátrico (<22 / 22-27 / >27) + perda ≥5% + tendência; "quem falta pesar";
  escala da cozinha par/ímpar por dia-do-mês.
- **REQUER DECISÃO:** trocar a **unidade** de um insumo já usado em pratos não
  reconverte quantidades nem avisa (não há conversão kg↔g; o prato herda a unidade do
  insumo) (#M).

### F8 — Vigilância sanitária
- **OK:** queda com lesão gera sentinela pendente; RT registra notificação;
  denominador RDC = população no dia 15 (admissão/saída antes/depois tratadas; string
  ISO); mês sem população → "—" (sem NaN); proporção de cuidadores com `Math.ceil` por
  grau; hóspede sem grau sinalizado e fora do cálculo; carteira vacinal
  pendente/desatualizada/em-dia; relatório sanitário — edição não toca o banco, trilha
  guarda original+editado, PDF sai limpo.
- **Corrigido:** falso-positivo do sentinela em negações (#7 / migration 0096).

### F9 — Agenda de visitas
- **OK:** slots só nos 4 horários em dias úteis; bloqueio some do site (RPC filtra
  `bloqueada=false`); fluxo pendente→em contato→confirmada/cancelada/remarcada libera
  o slot corretamente; **wa.me sempre no número do cliente** normalizado (máscara, com/
  sem DDI, zero de operadora — todos conferidos); marcação manual livre; duplo clique
  guardado por `isPending`.
- **REQUER DECISÃO:** sem enforcement atômico de capacidade → dois agendamentos podem
  furar o mesmo slot (TOCTOU/overbooking); a RPC "desconta" mas não garante na escrita
  (#N).

### F10 — Portal da família
- **OK:** "dia de [nome]" por atividades/refeições; **aceitação baixa NUNCA aparece
  negativa** (só frases positivas mapeadas; o resto é omitido); recado da equipe; fotos
  só do residente vinculado (bucket privado); nada clínico cru consultado; hóspede
  inativado some.
- **Corrigido:** "ontem" em UTC (#5), recado de hóspede inativado (#6).

### F11 — Clínico
- **OK (tudo):** IVCF determina grau com tetos de seção e cortes 6/7 e 14/15; MEEM soma
  ≤30 com tetos por item; MoCA soma + ajuste de escolaridade travando em `min(bruto+1,
  30)`, escolaridade nula/inválida → sem ajuste, total recalculado no hook (fonte da
  verdade); testes cognitivos NÃO alteram `grau_dependencia`; alerta de alergia
  não-bloqueante ao prescrever.
- **REQUER DECISÃO:** alerta de alergia ignora tokens < 4 letras (ex.: "AAS") e não
  cobre sinônimos comerciais (#O).

### F12 — Transversais
- **OK:** timezone SP nas comparações (após #4/#5/#8; `utils` pinado via `Intl`); duplo
  clique não duplica (medicação/dispensação idempotente 0094/agendamento por
  `isPending`); mutação com erro avisa o usuário (handlers com try/catch → toast; nenhum
  salvamento silenciosamente falho nos fluxos avaliados); estados vazios sem
  null/NaN/tela branca (`Number.isFinite`/`EmptyState`/`?? []`); badges contam certo por
  perfil.
- **Nota (não bug):** o badge inline "N respostas" no início da família conta todas as
  respondidas, enquanto o da sidebar usa janela de 7 dias — critérios diferentes, ambos
  corretos para o seu contexto.

---

## 3. REQUER DECISÃO

> Comportamento ambíguo ou correção que muda fluxo/regra — **não alterado** sem sua
> confirmação. Recomendação em cada um.

- **#A [ALTO] Check-in do PlantaoBar sem geofence.** O botão do Checklist/Medicação bate
  ponto sem validar GPS nem isenção — não-isento contorna os 150m. **Recomendação:**
  aplicar a validação de posição do `MinhaEscala` no `usePlantao.fazerCheckIn` para
  não-isento, ou desabilitar o check-in do PlantaoBar e direcionar à "Minha escala".
  Não corrigido por ser conclusão de feature (fluxo de GPS/permissão).
- **#B [MÉDIO] "Dispensar de novo" no-op + toast falso.** Pós-idempotência (0094), redispensar
  não insere nem baixa, mas a UI diz "estoque baixado". **Recomendação:** a RPC retornar
  um flag `inserted` (ou a UI bloquear "Dispensar de novo" quando já dispensado, exigindo
  estorno+redispensa). Envolve mudança na RPC/tipos — decida a semântica.
- **#C [MÉDIO] Não-orais provisionados sem baixa.** Insulina/injetável/sonda entram no
  estoque mas nenhum fluxo os decrementa (saldo nunca depleta). **Recomendação:** confirmar
  se é informativo; se não, criar baixa na administração de enfermagem ou excluí-los do
  provisionamento.
- **#D [MÉDIO] Baixa de viagem não-atômica.** Read-modify-write sem idempotência (duplo
  clique duplica). **Recomendação:** RPC transacional como a da dispensação (0094).
- **#E [BAIXO] Prescrição sem quantidade.** Estoque trata "" como 1; PDF como "uso contínuo".
  **Recomendação:** exigir quantidade quando o período é marcado, ou unificar o default.
- **#F [BAIXO] "Como foi" do compromisso** só no dia seguinte (`data < hoje`). Se o desfecho
  deve poder ser registrado no mesmo dia, trocar para `<=`.
- **#G [BAIXO] Recorrência 3 meses só na UI.** Replicar o guard no
  `useCriarTurnosRecorrentes` para robustez.
- **#H [BAIXO] Modal permite `fim < inicio`** sem marcar "dia seguinte" → timestamps
  invertidos. **Recomendação:** auto-detectar e forçar "dia seguinte".
- **#I [BAIXO] `turnoCorrente` corta às 18h** enquanto a escala vai até 19h (só afeta o
  default navegável). Alinhar a 19h se o default precisar refletir a escala.
- **#J [MÉDIO] Admissão não-transacional.** Falha entre `prescricao.insert` e
  `evolucao_admissao.insert` pode duplicar prescrição numa retentativa. **Recomendação:**
  RPC transacional (inserir o documento antes ou envolver tudo numa transação).
- **#K [MÉDIO] Day care no denominador RDC (dia 15).** `populacaoDia15` não exclui
  `day_care`. **Recomendação:** confirmar com o RT se compõe os indicadores; se não,
  filtrar `modalidade <> 'day_care'` no denominador e no numerador de agravos.
- **#L [MÉDIO] `useResumoMes` × `useEvolucaoFinanceira` divergem** para hóspede inativado no
  mês corrente (roster ativo-agora vs por-data), na mesma tela. **Recomendação:** unificar o
  critério de roster via `presenteNoMes` para o mês de referência em ambos.
- **#M [BAIXO] Troca de unidade de insumo** não reconverte quantidades de pratos nem avisa.
  **Recomendação:** bloquear/alertar troca de unidade quando o insumo já é usado, ou gravar a
  unidade na `prato_insumo`.
- **#N [MÉDIO] Overbooking da agenda.** Sem guarda atômica de capacidade entre o
  `slots_livres` (read) e o insert. **Recomendação (SQL pronto):** trigger `BEFORE INSERT`
  em `visita_agendamento` que reconta ocupações do `(data,hora)` sob `pg_advisory_xact_lock`
  e rejeita quando `capacidade` esgotada — funciona também para o insert anônimo do site.
  Não aplicado porque muda o contrato do insert público (o site precisa tratar a rejeição).
- **#O [BAIXO] Alerta de alergia** ignora tokens < 4 letras (ex.: "AAS") e sinônimos
  comerciais. **Recomendação:** allowlist de fármacos curtos conhecidos; segue como apoio ao
  julgamento clínico, não substituto.

---

## 4. Correções aplicadas (arquivos)

- `src/routes/farmacia/Dispensacao.tsx` — dose sem `Math.ceil` (#1).
- `src/hooks/useHospedes.ts` — tolerância ±10min (`dentroDoTurno`) (#2).
- `src/routes/cuidador/MinhaEscala.tsx` — ponto no noturno em andamento (#3).
- `src/hooks/useEliminacao.ts` + `src/routes/cuidador/Checklist.tsx` — dia civil SP (#4).
- `src/routes/familia/Inicio.tsx` — "ontem" em SP (#5) + recado só com hóspede ativo (#6).
- `supabase/migrations/0096_sentinela_queda_negacao.sql` — trigger trata negações (#7).
- `src/lib/mensalidade.ts` — `hojeISO` delega ao `utils` (#8).
- `src/hooks/useMedico.ts` — normaliza espaços internos do nome do medicamento (#9).

**Validação:** `tsc -b --noEmit` limpo · `npm run build` verde.

---

## 5. Não coberto (limite do ambiente)

- **Sem banco vivo:** RLS efetiva por perfil sob JWT real; volumes/dados reais (seeds,
  duplicatas, vigências de preço); execução real de triggers (0085/0086/0096) e RPCs
  (0094) — verificados por leitura do SQL, não executados.
- **Concorrência real:** overbooking da agenda (#N), idempotência da dispensação sob
  duplo clique concorrente, baixa de viagem não-atômica (#D) — a lógica foi lida, o race
  não foi disparado.
- **GPS do navegador** (posição real, distância ao estabelecimento) e permissão.
- **Conteúdo binário** dos PDFs (receita, relatório sanitário) e XLSX — só o fluxo e a
  ausência de marcas de edição foram confirmados por código.
- **Fuso do dispositivo em produção:** os bugs de dia civil (#4/#5/#8) só se manifestam em
  tablet fora de America/Sao_Paulo; em SP já estavam corretos.
- **Reatividade do React Query** entre telas (invalidations → refetch) — inferida pelas
  queryKeys, não observada em runtime.
- **Módulos não varridos a fundo:** RH/afastamentos, NPS, enxoval/lavanderia, câmera do
  quarto (família) — fora dos 12 fluxos priorizados.
