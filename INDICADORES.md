# Indicadores da gestão — disciplina de consolidação

**Princípio:** o **Painel da Administração** é a fonte única dos indicadores
financeiro-operacionais. O **cockpit do Master** é síntese executiva e
**não repete** os mesmos números com aparências diferentes — quando há
sobreposição, ele resume e aponta para o detalhe na Administração.

**Fonte única de dados:** `src/hooks/useIndicadoresGestao.ts`
- `useResumoMes(mes)` — números canônicos do mês (ocupação, financeiro, custos,
  resultado). Consumido pelos DOIS painéis, então o mesmo número nunca é
  recalculado de formas diferentes.
- `useEvolucaoFinanceira(mesBase, n)` — série de faturamento/resultado mês a mês.

**Definições canônicas:**
- `faturamento = mensalidades (longa) + upselling + 13º (nov/dez) + cobranças
  temporárias (curta permanência + day care)` — fonte única `useResumoMes`:
  mensalidades só de longa permanência; upselling e cobranças somam TODAS as do
  mês (inclui day care, que não está em `demo.linhas` por não ocupar leito);
  o 13º é linha calculada do demonstrativo. Sem duplicar a lógica de mensalidade.
- `recebido = mensalidades de hóspedes com pagamento "paga"`
- `resultado = faturamento − (custo de pessoal + custo de materiais)`
- `custo de materiais = soma (limpeza + manutenção) do mês` — vem do módulo
  "Custos de materiais" (`useCustosMateriaisDoMes`), já descontado no resultado.
- `taxa de ocupação = ativos / capacidade` (capacidade = config `total_suites`,
  editável no Painel da Administração); sem capacidade → "sem dados".
- **Ocupação de LEITOS** = longa + curta permanência (modalidade). O **Day Care**
  NÃO ocupa leito: é excluído de `useResidentes` (não entra em ocupação/mapa/
  operacional) e contado à parte em `useResumoMes.dayCareAtivos`.

---

## O que foi REMOVIDO / FUNDIDO (e por quê)

### Painel da Administração
- **Fundido:** "Receita (mensalidades)" + "Upselling do mês" + "Receita total
  prevista" (3 cards) → **1 card "Faturamento do mês"**, decompondo
  mensalidades + upselling na nota. Eram o mesmo valor exibido em pedaços.
- **Removido (duplicata interna):** "Recebido no mês" aparecia 2x (na barra do
  hero **e** num StatCard). Agora 1x, no bloco Financeiro ("Recebido vs.
  pendente").
- **Removido (irrelevante/redundante):** card de texto "Resumo do mês" — repetia
  em prosa todos os números já exibidos nos cards. Não levava a nenhuma decisão.
- **Renomeado:** "Hóspedes ocupando suítes" → "Hóspedes ativos" (alinhado ao
  Master e ao ciclo de vida ativo/inativo).
- **Adicionado:** seletor de mês; bloco Ocupação (taxa real + entradas/saídas);
  custo de materiais (placeholder "—"); **gráfico de evolução do faturamento**.

### Cockpit do Master (Painel estratégico)
- **Removido (já coberto na Administração):** "Receita prevista", "Custo de
  pessoal", "Resultado bruto", "Inadimplência" (detalhe) e "Recebido vs.
  previsto". Eram os MESMOS números do Painel da Administração, com layout
  diferente — exatamente a duplicação a evitar.
- **Mantido como síntese:** **"Resultado do mês"** (+ "Faturamento do mês" como
  contexto), ambos linkando para o detalhe na Administração.
- **Substituído:** o cálculo financeiro manual do Master passou a vir de
  `useResumoMes` (mesma fonte da Administração) — fim do recálculo paralelo.
- **Corrigido:** "Taxa de ocupação" deixou de ser sempre "sem dados" — agora é
  real quando a capacidade está cadastrada.
- **Adicionado:** "Entradas no mês" e "Saídas no mês" (síntese executiva).

---

## Lista final de indicadores por painel

### Painel da Administração (`/app/administracao` · Administração e Direção)
Seletor de mês no topo. Hero: **Resultado do mês** + % recebido.

**Bloco Ocupação**
- Hóspedes ativos (→ Mapa das Suítes) · de N suítes
- Taxa de ocupação (% · "sem dados" se capacidade não cadastrada)
- Entradas no mês
- Saídas no mês (→ Análise de Saídas)
- Editar capacidade (total de suítes)

**Bloco Financeiro do mês**
- Faturamento do mês (→ Demonstrativo) · mensalidades + upselling
- Recebido vs. pendente (→ Cobrança) · % recebido
- Inadimplência (→ Cobrança) · valor + nº de hóspedes

**Bloco Custos e resultado**
- Custo de pessoal (→ Custos de pessoal)
- Custo de materiais ("—" até existir o módulo)
- **Resultado do mês** (destaque) · faturamento − custos

**Evolução do faturamento (12 meses)** — gráfico, alternando Faturamento/Resultado.
O faturamento mensal da evolução soma mensalidades (longa) + upselling +
cobranças temporárias (curta/day care), coerente com `useResumoMes`.

**Cards de apoio** (não-financeiros, sem duplicar números):
- Serviços (só Administração) · Telefone do plantão (só Administração)
- Funil comercial (só Direção)

### Cockpit do Master (`/app/master` · Painel estratégico)
Seletor de mês no topo (escopo financeiro).

**Ocupação:** Residentes ativos · Taxa de ocupação · Entradas no mês ·
Saídas no mês (→ Análise de Saídas) · Grau de dependência · Por tipo de suíte

**Resultado (síntese):** Resultado do mês (→ Administração) ·
Faturamento do mês (→ Demonstrativo)

**Operacional e assistencial (tempo real):** Alertas críticos · Aderência ao
plano (hoje) · Manutenção · Hotelaria

**Clínico:** IVCF desatualizado · Divergência de grau · Sem evacuação (3+ dias)
· Baixa aceitação alimentar

> O **Painel Operacional do Master** (`/app/master/operacional`) é puramente
> operacional/assistencial e **não** carrega indicadores financeiros — sem
> sobreposição com os painéis acima.

### Painéis de RH (`/app/{administracao,direcao,master}/rh-paineis`)
Visão analítica de pessoal (Administração/Direção e Master). Lê dos registros de
RH (`rh_ausencia`/`rh_afastamento`/`rh_desligamento`) e da escala (`turnos`).
Não duplica indicadores existentes — é o módulo de RH.
- **Cobertura:** tabela mensal (funcionários, plantões, descobertos =
  `profissional_id is null`, coberturas por tipo, % atestados/plantões). Export Excel.
- **Turnover** = (desligamentos no mês ÷ headcount médio) × 100 · combo (barras
  ano atual vs anterior + linha de meta) · pizza de motivos · tabela por cargo.
- **Absenteísmo** = (dias perdidos afastamento+faltas/atestados ÷ dias
  trabalháveis) × 100 · combo + teto · tabela cargo×mês · combo por grupo de CID.
- Metas/tetos = constantes editáveis (`META_TURNOVER_PCT`, `TETO_ABSENTEISMO_PCT`
  em `lib/paineisRh.ts`). Observações qualitativas persistem em `configuracao`.
- **Privacidade:** CID só o grupo (sem diagnóstico); RLS restringe à gestão.

### Funil de Vendas (`/app/{administracao,direcao,master}/funil-vendas`)
Visão **histórica/analítica** do CRM (Administração/Direção e Master). Agrega o
CRM já existente (não recria coleta). Fonte: `useOportunidadesFunil` +
`lib/funilVendas` (definições de lead/qualificado/visita/venda comentadas lá).
- Tabela funil por mês (leads, qualificados, visitas, vendas, % de conversão,
  receita, ticket) + médias no rodapé · gráfico de evolução do ticket médio ·
  resumo de conversão do período. Export Excel.
- **Consolidação (sem duplicar):** o card "Funil comercial" do painel é o
  **snapshot do momento** (oportunidades ativas, visitas na semana, admissões no
  mês) e passa a **apontar** para o Funil histórico (a visão por mês/conversão).
  Nenhum número aparece nas duas telas na mesma forma.
- Acesso: Administração ganhou **SELECT** em `crm_oportunidade` (migration 0074)
  só para o funil — o CRM operacional (escrita) segue Direção/Master.
- Pendências: série **Meta** (OKR futuro) e correção por **IPCA** comentadas no
  código; **LP/CP/SD** (tipo de admissão) entra quando o CRM distinguir o tipo.

---

## Regra daqui pra frente
1. Indicador novo → entra primeiro em `useResumoMes`/`useEvolucaoFinanceira` se
   for financeiro-operacional, e é exibido em **um** lugar (Administração).
   O Master só referencia/resume.
2. Todo indicador leva a uma decisão/ação (tem link de detalhe quando faz
   sentido). Se não muda nenhuma decisão, não entra.
3. Sem números fictícios: fonte ausente → "sem dados"/"—" + comentário no
   código apontando a origem futura.

## Pendências de fonte de dados
- **NPS no Master:** existe a tela "Resultados NPS"; um resumo executivo pode
  ser plugado ao cockpit no futuro (não incluído para não exibir score sem o
  recorte definido).
