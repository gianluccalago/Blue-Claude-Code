# AUDITORIA LEAN + DISNEY — Blue Senior Living

> ## STATUS DE EXECUÇÃO (2026-06-12)
> As melhorias aprovadas foram executadas em 5 commits (um por bloco), build verde em todos:
>
> **BLOCO 1 — Poka-yoke de segurança** (`46986a1`, migração `0035`)
> - ✅ 1.1 Intercorrência: foto+nome+alergia ao selecionar; botão confirma o nome.
> - ✅ 1.2 Medicação: cabeçalho com foto+nome+alergia; selo "tomar com alimento" pela dieta.
> - ✅ 1.3 Prescrição: alerta de alergia com confirmação explícita registrada (`alerta_alergia`).
> - ✅ 1.4 Escalas: colisão de horário bloqueada (criar/editar/recorrente, noturno incluído).
> - ✅ 1.5 Dispensação: saldo insuficiente avisado ANTES, com confirmação explícita.
> - ✅ 1.6 Medicação "Não": motivo em 1 toque (Recusou/Indisposto/Ausente/Outro), visível à coordenação.
>
> **BLOCO 2 — Fila puxada** (`249afb9`)
> - ✅ 2.1 Idade + ordenação mais-antiga-primeiro + dono em todas as filas (Painel, Escalados, Solicitações, Chamados).
> - ✅ 2.2 Limites centrais em `src/lib/sla.ts` (4h/24h/48h provisórios — a pactuar pela gestão) + selo "atrasado".
> - ✅ 2.3 Escalas: fila "vagos a cobrir" por urgência (vermelho ≤24h, âmbar ≤72h).
> - ✅ 2.4 Escalados: selo "REINCIDENTE após resolução de [data]" (janela 48h).
> - ✅ 2.5 Manutenção: foto obrigatória ao resolver; vencidos no topo; emergências acima de tudo.
>
> **BLOCO 3 — Fluxo de turno e lote** (`111bafe`)
> - ✅ 3.1 Enfermagem: visão "AGORA (casa)" — atrasados em vermelho + período corrente; por-hóspede preservada.
> - ✅ 3.2 Dispensação: mapa virou fila (pendentes primeiro, contador feito/pendente).
> - ✅ 3.3 Atividades: fila "Registrar hoje".
> - ✅ 3.4 Lote: resolver pendências selecionadas de uma vez; tarefa de plano para vários hóspedes.
>
> **BLOCO 4 — Trilha de auditoria** (`f1dbc70`, migração `0036`)
> - ✅ 4.1 `log_alteracao` (imutável por RLS) em mensalidade (motivo obrigatório), tabela de preços, remuneração e valor final do pagamento.
> - ✅ 4.2 Histórico somente-leitura em Mensalidades e Remuneração.
> - ✅ 4.3 Rouparia: movimentações com trilha imutável (correção = novo lançamento) — implementado via log de cada movimentação, sem tabela própria de lançamentos (mais simples, mesmo efeito de trilha).
>
> **BLOCO 5 — Portal da família** (`c07cbbb`, migração `0037`)
> - ✅ 5.1 Card "O dia de [nome]" (alimentação + atividade com foto; sem dados sensíveis; vazio acolhedor).
> - ✅ 5.2 Legenda da foto (descrição da execução).
> - ✅ 5.3 "Recebemos sua solicitação" → "Em análise por [setor]" (automático) → "Respondida".
> - ✅ 5.4 "Combinados com a família" visível aos cuidadores designados (leitura).
> - ✅ 5.5 "Como foi" do compromisso (cuidador/enfermagem) → portal da família.
> - ✅ 5.6 Extras narrados no demonstrativo (apresentação).
> - ✅ 5.7 Placeholders honestos e acolhedores (câmera/sinais vitais).
>
> **FICOU DE FORA (com motivo)** — itens da auditoria NÃO aprovados nesta rodada:
> - Interação medicamentosa/contraindicação por classe (1.3 fase 2): exige base farmacológica — fora do escopo aprovado.
> - Bloco "Experiência" nos painéis do Master (NPS família, pulso da equipe): depende de ritual de coleta a definir pela gestão (§5.2).
> - Admissão como ritual de boas-vindas, fio único família↔equipe completo, tendências mês-a-mês nos painéis, "ações de agora" no Painel Operacional: não listados nos blocos aprovados.
> - Confirmação da cozinha na dieta e preferências alimentares: envolvem fluxo humano da cozinha (§5.4), não aprovado nesta rodada.
> - SLAs definitivos: os valores em `src/lib/sla.ts` são provisórios por decisão — serão pactuados pela gestão (§5.1).
>
> **Migrações a rodar no Supabase (idempotentes):** `0035_poka_yoke.sql`, `0036_log_alteracao.sql`, `0037_portal_familia.sql`.

Data: 2026-06-12 · Escopo: app inteiro (10 perfis, ~50 telas/fluxos) · Natureza: **somente proposta** — nada implementado, build intocado.
Referenciais: **Lean Healthcare** (Graban / Toyota na saúde) e **"Se a Disney Administrasse seu Hospital"** (Fred Lee).
Método: três passadas (Lean → Fred Lee → síntese), telas percorridas uma a uma com evidência de código.

> Premissa que orienta toda a priorização: **o ativo nº 1 é a aderência da ponta**. Cada toque a mais na tablet do cuidador é risco de burla. Por isso, "reduzir fricção" e "tornar o certo o caminho mais fácil" (poka-yoke) valem mais aqui do que em qualquer hospital.

---

## 1. SUMÁRIO EXECUTIVO

O app é, hoje, um **excelente sistema de CAPTURA**: ações de 1–2 toques, identidade do hóspede fixa no Checklist (nome, quarto, alergia, dieta no topo), trava de plantão (poka-yoke de turno), estados de vazio/erro/carregando consistentes, IVCF-20 e posologia padronizados, escalações clínicas que fluem do cuidador ao médico. Isso é raro e deve ser preservado.

A fragilidade não está na captura — está em **três frentes**: (a) falta **qualidade na fonte** (poka-yoke) nos pontos de risco; (b) falta **gestão visual puxada** (fila com dono + prazo) — o trabalho se empilha sem quem nem quando; (c) o sistema fala em **tarefas e números**, raramente em **pessoa e cuidado percebido** — sobretudo no portal da família.

### Os 5 maiores DESPERDÍCIOS (Lean)

1. **Ausência de poka-yoke nos pontos de erro caro** (jidoka/qualidade na fonte). A **Escala** deixa marcar o mesmo profissional em turnos sobrepostos e deixa turnos **vagos** sem trava; a **Dispensação** confirma com estoque zero/negativo; a **Prescrição** não checa **alergia**; ajustes de **mensalidade/remuneração** não têm trilha. O sistema permite o erro previsível em vez de impedi-lo na origem.
2. **Pendências sem fluxo puxado (kanban) — inventário de espera** (puxada/heijunka). Pendências, escalações, solicitações e chamados se **empilham sem dono nominal nem SLA**. O Painel mostra "Escalado ao médico · 14:02" mas não "quem" nem "vencido há 3h". Ninguém sabe, ao bater o olho, **o que atacar primeiro**.
3. **Fragmentação entre módulos — defeito e retrabalho à espera** (defeito + talento subutilizado). A **alergia** é cadastrada uma vez e aparece em só 2 telas — **falta exatamente na Intercorrência** (onde o cuidador escolhe o hóspede sob pressão); a **dieta** não aparece na Medicação ("tomar com comida"); a nota do médico não volta à prescrição; a medicação "Não administrada" não diz **por quê** (gera follow-up manual).
4. **Trabalho empurrado hóspede-a-hóspede em vez de "visão do turno"** (movimentação/espera; falta heijunka). **MedicacaoEnfermagem** obriga navegar com setas ‹ ›; **Dispensação** não tem fila "próximos N"; **Atividades** não tem fila "registrar hoje". A carga não é nivelada — concentra picos e exige navegação manual.
5. **Talento subutilizado + sem trabalho em lote** (respeito pelas pessoas / muda de superprocessamento). Coordenação/enfermeira **resolvem item a item** (marcar 10 = 10 cliques); IVCF-20 só pelo médico; nenhuma sugestão automática (3º dia sem evacuar → sugerir conduta). Observações são **campo livre em todo lugar** → variabilidade (trabalho não padronizado), difícil de auditar.

### As 5 maiores OPORTUNIDADES DE EXPERIÊNCIA (Fred Lee)

1. **O portal da família responde "quem é" e "quanto custa" — não "como meu pai está SENDO CUIDADO hoje"** (percepção é realidade / cuidado percebido). Falta a **narrativa do dia**: humor, alimentação, sono, atividade, um recado humano. Os dados para isso **já são capturados** (aceitação, atividades, eliminação) — só não viram história.
2. **Solicitações e Compromissos têm cara de protocolo, não de conversa** (cortesia antes da eficiência / prontidão). Sem SLA visível, sem "já estamos cuidando disso", sem **follow-up depois da consulta externa**, sem confirmação de leitura. E a resposta do médico à família **não chega ao cuidador** que está com a pessoa.
3. **A equipe age sobre "linha de tarefa", não sobre a pessoa** (transformar tarefa em cuidado / elenco). Em várias telas de ação falta **nome+foto+1 linha de quem a pessoa é** (o que gosta, o que teme). A **Intercorrência** nem mostra alergia; a **Medicação** mostra o alérgeno mas **não o nome/foto** de quem vai receber.
4. **Os momentos da verdade passam pelos mesmos formulários frios** (momentos da verdade / encenação). Admissão, primeira semana, intercorrência grave, falecimento — nenhum tem um fluxo à altura. A admissão deveria ser um ritual de boas-vindas (história de vida, foto, preferências), não um cadastro.
5. **Medimos só produção; nada de lealdade** (medir o que importa). Os painéis do Master mostram ocupação, receita, aderência, alertas — **zero** NPS da família, pulso da equipe, bem-estar percebido do hóspede. Fred Lee mandaria medir o que prediz lealdade. (E há duas promessas **não cumpridas** à família: `Câmera do quarto` e `Sinais vitais` são telas "em desenvolvimento".)

---

## 2. ACHADOS POR PERFIL

Formato de cada achado: **ONDE → PROBLEMA (conceito violado) → IMPACTO → PROPOSTA → ESFORÇO**.

### 2.1 CUIDADOR (ponta — tablet, alto volume)
Telas percorridas: `Checklist`, `Medicacao`, `Compromissos`, `Intercorrencia`, `MinhaEscala`, `PlantaoBar`.

**Pontos fortes (preservar):** identidade fixa no topo do Checklist (nome, quarto, **alergia em vermelho**, dieta); ações de 1 toque (marcar feito, aceitação alimentar, eliminação com 2 botões grandes); trava de plantão (poka-yoke de turno); banner de alergia pulsante na Medicação; estados vazio/erro/carregando completos.

- **Intercorrência → falta alergia e confirmação do hóspede** (poka-yoke ausente / cuidado percebido). O cuidador escolhe o hóspede num `select` (linha ~152) **sem ver alergia/foto**, sob pressão de um evento agudo. **Impacto:** registro no hóspede errado e decisão sem o dado de segurança mais crítico — baixa frequência, dano altíssimo. **Proposta:** ao escolher o hóspede, mostrar **foto + nome + faixa de alergia** (reusar o banner do Checklist); confirmação visual antes de enviar. **Esforço:** baixo (dado e componentes já existem).
- **Medicação binária sem motivo de recusa** (defeito de informação / jidoka). "Sim, todas" ou "Não", sem "por quê" (recusou, dormindo, vomitando) nem parcial por item. **Impacto:** o médico precisa **caçar o motivo** depois (retrabalho); perde-se sinal clínico. **Proposta:** no "Não", 3 botões de motivo (Recusou / Indisposto / Ausente) — 1 toque a mais, opcional. **Esforço:** baixo.
- **Medicação não mostra nome/foto do hóspede nem "tomar com comida"** (cuidado percebido / fragmentação da dieta). Mostra o alérgeno, mas não **quem** é nem a restrição de dieta relevante à via oral. **Impacto:** risco de troca em casa com nomes parecidos; decisão sem contexto. **Proposta:** cabeçalho com foto+nome (igual Checklist) e, quando houver, selo "tomar com alimento". **Esforço:** baixo.
- **Checklist registra AÇÃO, não OBSERVAÇÃO** (transformar tarefa em cuidado). "Higiene pessoal · feito" não captura reação/dor/condição de pele/humor. **Impacto:** perde-se o cuidado percebido e sinais precoces; a família nunca ouve a história. **Proposta:** campo opcional de 1 toque por tarefa ("tudo bem / resistência / observação"), alimentando a narrativa da família. **Esforço:** médio.
- **Compromissos sem conflito de agenda nem retorno** (fluxo / momentos da verdade). O cuidador dá "ciência" mas nada cruza o transporte 14:00 com o almoço 12:00, e não há registro do **resultado** da consulta. **Impacto:** dia desorganizado; família sem desfecho. **Proposta:** aviso de conflito ao dar ciência; campo "como foi" após o compromisso (vai ao portal). **Esforço:** médio.

### 2.2 ENFERMAGEM
Telas: clone do Cuidador + `MedicacaoEnfermagem` (analisada em 2.3). Valem os mesmos achados da ponta; some-se a navegação ‹ › da medicação de enfermagem (ver 2.3).

### 2.3 COORDENAÇÃO ASSISTENCIAL
Telas percorridas: `Painel`, `MedicacaoEnfermagem`, `Intercorrencias`, `Escalas`, `PlanosCuidado`, `ModelosRotina`, inbox `SolicitacoesFamiliaInbox`.

- **Escalas: sem detecção de sobreposição / duplo turno** (poka-yoke ausente — o achado mais grave de operação). A única validação ao salvar é `!!data && !!inicioTime && !!fimTime` (TurnoModal ~l.93). É possível pôr o **mesmo profissional** em 08–14 **e** 12–18 no mesmo dia; a criação recorrente só deduplica por **dia**, não por **horário** (useTurnos ~l.142). **Impacto:** erro de folha/PJ, falta de cobertura real, retrabalho de conferência manual — recorrente. **Proposta:** ao salvar, checar colisão de horário do profissional (inclusive entre categorias) e **bloquear/avisar**; opcional: descanso mínimo entre turnos. **Esforço:** médio.
- **Escalas: turno vago não trava nem prioriza** (gestão visual / puxada). Há banner de vagos, mas todo vago é vermelho igual — "vago hoje 20:00" tem a mesma cor de "vago terça 07:00". **Impacto:** o urgente some no meio do crônico. **Proposta:** severidade por proximidade (vermelho ≤24h, âmbar ≤72h) e fila "vagos a cobrir por ordem de urgência". **Esforço:** baixo-médio.
- **Painel: pendências sem dono nem SLA** (puxada/heijunka — inventário de espera). Mostra "Escalado ao médico · hora" sem **nome do médico** nem "vencido há Xh" (Painel ~l.424). **Impacto:** ninguém sabe o que atacar primeiro; coisas envelhecem caladas. **Proposta:** em cada pendência, **idade** ("aberta há 3h"), **dono nominal** e selo de SLA estourado; ordenar por vencimento. **Esforço:** médio.
- **Resolver sem prova / sem lote** (jidoka / talento subutilizado). "Marcar resolvido" assume que foi feito; e cada item é 1 clique (sem seleção múltipla). **Impacto:** resolução "no papel"; coordenação digitando o que poderia ser lote. **Proposta:** ação em lote + (onde fizer sentido) exigir 1 linha de conduta ao resolver. **Esforço:** baixo-médio.
- **MedicacaoEnfermagem: navegação hóspede-a-hóspede e sem janela de horário** (movimentação/espera; sem heijunka; gestão visual). Setas ‹ › por hóspede; nada destaca "atrasado" (são 09:30 e a Manhã 08:00 não fica vermelha). **Impacto:** navegação custosa em pico; risco de atraso invisível. **Proposta:** visão "due agora / próximos 15 min" de toda a casa; realce de atraso. **Esforço:** médio.
- **PlanosCuidado: responsável sem checagem de escala e tarefa sem conclusão** (fluxo / completion tracking). Atribui "curativo 08:00" a alguém que pode estar de folga (sem cruzar Escalas) e o item não tem "feito_por/feito_em" próprio. **Impacto:** tarefa órfã; sem rastro de execução no nível do plano. **Proposta:** validar disponibilidade na atribuição; herdar status de execução do Checklist. **Esforço:** médio.
- **ModelosRotina / PlanosCuidado: texto livre + sem sugestão por grau** (trabalho padronizado / talento). "Virar 2/2h" vs "Turn q2h"; e grau III não sugere o modelo correspondente. **Impacto:** variabilidade, difícil treinar/auditar. **Proposta:** biblioteca de tarefas padronizadas (escolher, não digitar) e sugestão de modelo pelo grau IVCF. **Esforço:** médio.

### 2.4 MÉDICO GERIATRA
Telas percorridas: `Prescricoes`, `EscaladosMedico`, `Evolucao` (com IVCF-20).

- **Prescrição sem checagem de alergia/interação** (poka-yoke clínico ausente). Valida só medicamento não-vazio + ≥1 período (~l.461); nada cruza a **alergia** do hóspede nem duplicidade de classe. **Impacto:** evento adverso evitável — baixa frequência, dano gravíssimo. **Proposta:** alerta "hóspede alérgico a X" ao prescrever (a alergia já está no cadastro); fase 2: interação por classe. **Esforço:** médio (alergia: baixo).
- **Evolução é texto livre sem estrutura nem gatilho** (padronização / fluxo). Nota livre; IVCF-20 "Grau III" não força revisão de plano nem avisa a coordenação. **Impacto:** decisão clínica não vira ação; variabilidade de registro. **Proposta:** ao salvar IVCF Grau III/divergência, sugerir revisão de plano e notificar coordenação. **Esforço:** médio. *(Forte: o painel "Contexto do dia" na Evolução — intercorrências e aceitação de hoje — é exemplar de genchi genbutsu; ampliar esse padrão.)*
- **Escalados sem SLA, sem dono de origem, sem reabertura** (gestão visual). Não mostra "escalado há 4h" nem quem escalou; resolvido some, e se recorrer em 2h não avisa "reaberto". **Impacto:** fila clínica sem prioridade; recorrência cega. **Proposta:** idade + origem + alerta de recorrência pós-resolução. **Esforço:** baixo-médio.

### 2.5 FARMÁCIA
Telas percorridas: `PainelFarmacia`, `EstoqueHospede`, `Dispensacao` (+ `PedidosMensais`/`CustosMedicamento`, construídos nesta sessão).

- **Dispensação confirma sem checar estoque** (poka-yoke ausente / jidoka). A UI deixa "Confirmar" mesmo com saldo zero/negativo; a baixa ocorre depois. **Impacto:** estoque vira ficção; ziploc "montado" sem item. **Proposta:** bloquear/avisar na hora se saldo < necessário; estado "dispensado mas não administrado". **Esforço:** baixo-médio.
- **Sem fila puxada nem janela de tempo** (puxada/heijunka / gestão visual). Provisionamento usa "dia 20" fixo; dispensação navega resident-by-resident sem "próximos N" nem contagem para o horário. **Impacto:** picos não nivelados; atraso invisível. **Proposta:** kanban "a provisionar/a dispensar" com SLA; fila do período. **Esforço:** médio.
- **Sugestão de quantidade parseia texto livre da prescrição** (defeito silencioso). Quebra "2 cp" por espaço; se vier "2cp", falha sem avisar. **Impacto:** provisionamento errado. **Proposta:** quantidade estruturada na prescrição (número + unidade). **Esforço:** médio (depende da prescrição).
- **Sem rastro de quem administrou de fato** (qualidade na fonte). Dispensação registra período/itens, não a conferência final. **Impacto:** elo perdido dispensação→administração. **Proposta:** conferência (e foto opcional) no fechamento do ziploc. **Esforço:** médio.

### 2.6 HOTELARIA
Telas percorridas: `PainelHotelaria`, `InspecaoSuites`, `Manutencao`, `Rouparia`.

- **Manutenção resolvida sem evidência e sem SLA** (jidoka / gestão visual). "Confirmar resolução" aceita sem foto; prazo é opcional e não escala se vencer. **Impacto:** resolução "no papel"; sem accountability; emergência sem fila. **Proposta:** foto obrigatória ao resolver; prazo com escalonamento automático; fila por urgência. **Esforço:** baixo-médio.
- **Inspeção sem foto e não avisa risco ao hóspede** (poka-yoke / segurança). Bom: trava de salvar só com todos os itens. Mas "botão de emergência testado = não-conforme" só vira chamado — não alerta a enfermagem. **Impacto:** risco de segurança tratado como manutenção comum. **Proposta:** itens críticos de segurança disparam alerta assistencial, não só chamado; foto por não-conformidade. **Esforço:** médio.
- **Rouparia/Manutenção sem trilha** (padronização / auditoria). Saldo de rouparia editável sem histórico; chamado de não-conformidade sem descrição quando o inspetor não preenche observação. **Impacto:** dados sem auditoria. **Proposta:** log de alterações; herdar nome do item como descrição mínima. **Esforço:** baixo.

### 2.7 NUTRICIONISTA
Telas percorridas: `Dietas`, `Acompanhamento`, `Evolucao`.

- **Dieta sem confirmação da cozinha nem preferências** (fluxo / cuidado percebido). Define dieta, mas não há estado "cozinha ciente"; captura **restrições médicas**, não **gostos** (o que a pessoa adora/detesta). **Impacto:** comida na dieta errada; refeição como tarefa, não prazer. **Proposta:** "ciência da cozinha"; campo de preferências/aversões que aparece ao cuidador e no portal. **Esforço:** médio.
- **Acompanhamento sem tendência e parsing frágil** (gestão visual / defeito). Lê aceitação parseando o título da tarefa; sem gráfico de tendência. **Impacto:** queda de aceitação demora a saltar aos olhos. **Proposta:** mini-tendência 7 dias; dado de aceitação estruturado. **Esforço:** baixo-médio.

### 2.8 EQUIPE MULTIDISCIPLINAR
Tela percorrida: `Atividades`.

- **Atividade exige foto mas mede só presença** (cuidado percebido / medição). Marca quem participou + foto, mas não **engajamento/humor** nem alimenta narrativa. **Impacto:** perde-se o momento que encantaria a família. **Proposta:** 1 toque de "como participou" por hóspede + legenda da foto que vai ao portal. **Esforço:** baixo-médio.
- **Sem fila "registrar hoje"** (puxada). Navega data manualmente. **Proposta:** fila do dia pendente de registro. **Esforço:** baixo.

### 2.9 ADMINISTRAÇÃO
Telas percorridas: `PainelAdministracao`, `Mensalidades`, `RemuneracaoEquipe` (+ `Upselling`, `Demonstrativo`, `CustosPessoal`, `TabelaPrecos`).

- **Ajuste de mensalidade/remuneração sem trilha** (qualidade na fonte / auditoria). Override de valor com observação opcional; mudança de remuneração sobrescreve sem histórico. **Impacto:** financeiro sem auditoria; risco de erro/abuso invisível. **Proposta:** log imutável de alterações (quem/quando/de→para/motivo obrigatório). **Esforço:** baixo.
- **Painéis sem tendência nem laço de confiança** (medição / percepção). Mostra resultado do mês, não trajetória; nada que devolva confiança a quem paga. **Impacto:** decisão sem trend; oportunidade de lealdade perdida. **Proposta:** mini-tendência mês a mês; (no portal família) demonstrativo que **explica** os extras como cuidado, não cobrança fria. **Esforço:** médio.

### 2.10 MASTER (CEO-médico)
Telas percorridas: `PainelEstrategico`, `PainelOperacional`, `SupervisaoClinica`, `Visao360`, `Residentes/Hóspedes`, `Equipe`, `Profissionais`.

- **Métricas só de produção — nada de lealdade/experiência** (medir o que importa — Fred Lee). Ocupação, receita, aderência, alertas. **Zero** NPS família, pulso/rotatividade da equipe, bem-estar percebido. **Impacto:** voa-se cego no que prediz retenção de famílias e de equipe — o que de fato sustenta 40→200 leitos. **Proposta:** bloco "Experiência": NPS família, pulso da equipe, % solicitações no prazo, bem-estar do hóspede. **Esforço:** médio (a coleta é o trabalho; ver §5).
- **Painéis são leitura sem "faça isto primeiro"** (puxada / gestão visual). Operacional lista 6 blocos; o supervisor prioriza de cabeça; sem som/alerta para emergência. **Impacto:** tempo de reação e carga cognitiva. **Proposta:** faixa "ações de agora" ordenada por risco×SLA no topo do Operacional. **Esforço:** médio.
- **Forte:** `SupervisaoClinica` (flags de IVCF/divergência/risco) e o `PainelEstrategico` com `SEM DADOS` honesto são bons exemplos de gestão visual — falta a **lane de ação** (tocar no hóspede → reavaliar/escalar) e **tendência**.

### 2.11 FAMÍLIA (portal curado)
Telas percorridas: `Inicio`, `Fotos`, `Mensalidade`, `Solicitacoes` (+ `Compromissos`), `CameraQuarto`, `SinaisVitais`.

- **Não responde "como meu pai está hoje"** (percepção é realidade / cuidado percebido — a maior oportunidade do app). Início mostra quem é; falta a **narrativa do dia**. **Impacto:** a família mede a casa pela sensação de saber/ser cuidada — hoje ela vê dados, não cuidado. **Proposta:** card "O dia de [nome]" agregando o que **já existe** (humor/observação do cuidador, aceitação alimentar, atividade com foto, sono/eliminação em linguagem humana, recado da equipe). **Esforço:** médio.
- **Fotos sem emoção; Mensalidade sem vínculo de cuidado** (encenação / storytelling). Foto diz "participou", não "como estava"; mensalidade é transação pura, sem nome nem o que o extra significou. **Impacto:** momentos viram registro. **Proposta:** legenda afetiva na foto; demonstrativo que narra o extra como cuidado. **Esforço:** baixo.
- **Solicitações/Compromissos com cara de protocolo** (cortesia / prontidão / momentos da verdade). Sem SLA visível, sem "recebemos, estamos cuidando", sem follow-up após a consulta; e a resposta do médico **não chega ao cuidador**. **Impacto:** ansiedade e sensação de burocracia justamente onde a confiança se ganha. **Proposta:** SLA e status "em andamento" visíveis; confirmação de leitura; desfecho do compromisso; fio único família↔equipe espelhado ao cuidador. **Esforço:** médio.
- **Promessas não cumpridas** (percepção). `Câmera do quarto` e `Sinais vitais` são telas "em desenvolvimento". **Impacto:** promessa visível e não entregue corrói confiança. **Proposta:** ou entregar, ou comunicar com honestidade ("em breve, com consentimento") — não deixar como placeholder mudo. **Esforço:** baixo (comunicar) / alto (integrar sensores/câmera).

---

## 3. ACHADOS TRANSVERSAIS (padrões que se repetem)

1. **Gestão visual sem DONO e sem SLA** — Painel, Escalados, Intercorrências, Solicitações, Chamados: tudo mostra estado, quase nada mostra **idade**, **responsável nominal** e **vencimento**. Sem isso não há sistema puxado; é um monte de inventário esperando. *(puxada/heijunka)*
2. **Poka-yoke ausente nos pontos de erro caro** — dispensar sem estoque, sobrepor turno, prescrever contra alergia, ajustar valor sem trilha. O padrão é "permitir e corrigir depois", o oposto de **qualidade na fonte (jidoka)**.
3. **Fragmentação de dados / falta de reconciliação** — alergia, dieta, motivo de recusa, nota do médico, disponibilidade na escala: cada módulo é uma ilha. O dado existe, mas **não flui** para onde a decisão acontece. *(defeito + retrabalho)*
4. **Texto livre por toda parte** — observações de médico, intercorrência, evolução, solicitação, tarefa: sem template. Variabilidade alta, auditoria difícil, treino difícil. *(trabalho não padronizado)*
5. **Pessoa virou linha de tarefa fora do Checklist** — o Checklist acerta (identidade fixa); Intercorrência, Medicação(enf), Dispensação, painéis tratam o hóspede como ID. Falta **nome+foto+1 linha** onde a equipe age. *(cuidado percebido / elenco)*
6. **Trabalho empurrado e sem lote** — navegação hóspede-a-hóspede, ações unitárias, sem fila do turno. *(movimentação/espera; talento subutilizado)*
7. **Mede-se produção, não lealdade** — em nenhum nível há experiência da família ou da equipe. *(Fred Lee: medir o que importa)*

---

## 4. TOP 15 PRIORIZADO (impacto ÷ esforço)

> Dois ranques, como pedido. Critério: risco/percepção evitados ÷ esforço de implementação. "Reuso" = aproveita componente/dado que já existe.

### 4.1 TOP LEAN (operação)

| # | Mudança | Conceito | Esforço | Por que primeiro |
|---|---|---|---|---|
| 1 | **Alergia + foto + nome do hóspede na Intercorrência** (e na Medicação) | poka-yoke / cuidado percebido | Baixo | Dano máximo, esforço mínimo: o dado e o banner já existem; fecha o buraco de segurança da ponta. |
| 2 | **Detecção de sobreposição / duplo turno na Escala** | poka-yoke (jidoka) | Médio | Erro recorrente de folha/cobertura; uma query de colisão elimina retrabalho e risco trabalhista. |
| 3 | **Trava de estoque na Dispensação** | poka-yoke | Baixo-médio | Impede o estoque virar ficção; protege o modelo ziploc inteiro. |
| 4 | **Idade + dono nominal + SLA nas filas** (Painel, Escalados, Inbox, Chamados) | puxada / gestão visual | Médio | Transforma "pilha de pendências" em fila puxada; muda como a casa inteira prioriza. |
| 5 | **Motivo de recusa na medicação** (não → 3 botões) | jidoka / qualidade na fonte | Baixo | 1 toque elimina horas de follow-up do médico e gera sinal clínico. |
| 6 | **Checagem de alergia ao prescrever** | poka-yoke clínico | Médio | Evento adverso evitável; alergia já está no cadastro. |
| 7 | **Visão "do turno / due agora" na Medicação de enfermagem e Dispensação** | heijunka / fluxo | Médio | Acaba com a navegação ‹ › em pico; nivela carga. |
| 8 | **Ações em lote** (resolver vários; aplicar tarefa a vários) | talento / muda | Baixo-médio | Devolve tempo à coordenação; reduz cliques repetitivos. |
| 9 | **Trilha de auditoria em ajustes financeiros/remuneração** | qualidade na fonte | Baixo | Risco financeiro invisível hoje; baixo custo, alto controle. |
| 10 | **Foto obrigatória + SLA com escalonamento na Manutenção** | jidoka / gestão visual | Baixo-médio | Fim da resolução "no papel"; fila de emergência clara. |

### 4.2 TOP EXPERIÊNCIA (família / hóspede)

| # | Mudança | Conceito | Esforço | Por que primeiro |
|---|---|---|---|---|
| 1 | **Card "O dia de [nome]" no portal da família** (humor, alimentação, atividade, sono, recado) | percepção é realidade / cuidado percebido | Médio | A maior alavanca de lealdade do app — e os dados já são capturados, só não viram história. |
| 2 | **Pessoa, não tarefa: foto+nome+1 linha (gosta/teme) nas telas de ação** | transformar tarefa em cuidado / elenco | Baixo | Reusa a ficha; faz a equipe **parecer e ser** atenciosa em cada toque. |
| 3 | **Solicitações com SLA visível + "estamos cuidando" + confirmação de leitura** | cortesia / prontidão | Baixo-médio | Tira a cara de protocolo do ponto onde a confiança se ganha ou se perde. |
| 4 | **Fio único família↔equipe, espelhado ao cuidador** | momentos da verdade / fluxo | Médio | A resposta do médico chega a quem está com a pessoa; acaba a fragmentação. |
| 5 | **Follow-up do compromisso externo** ("como foi a consulta") | momentos da verdade | Médio | Fecha o ciclo que hoje deixa a família no escuro depois da consulta. |
| 6 | **Bloco "Experiência" nos painéis do Master** (NPS família, pulso da equipe, % no prazo, bem-estar) | medir o que importa | Médio | Sem medir lealdade, escalar 40→200 é voar cego no que retém famílias e equipe. |
| 7 | **Legenda afetiva nas fotos + demonstrativo que narra o cuidado** | encenação / storytelling | Baixo | Converte registro em momento; transforma cobrança em valor percebido. |
| 8 | **Fluxo de admissão como ritual de boas-vindas** (história de vida, foto, preferências) | momentos da verdade | Médio-alto | O primeiro momento da verdade define a relação; hoje é um cadastro frio. |

---

## 5. MUDANÇAS DE PROCESSO (não-app) — honestidade sobre o que NÃO se resolve com código

Estes pontos apareceram na auditoria mas são de **operação/gestão**. Software pode apoiar, não substituir.

1. **SLA não é campo — é acordo.** Mostrar "vencido há 3h" só funciona se a casa **definir** os prazos (medicação, escalonamento, resposta à família) e **pactuar** com a equipe. Defina os SLAs primeiro; o app os torna visíveis depois.
2. **NPS e pulso da equipe exigem ritual, não só tela.** Medir lealdade pressupõe **rotina de coleta** (pesquisa à família após momentos-chave; pulso curto à equipe) e alguém **dono** de agir sobre o resultado. Sem o ritual, o bloco no painel fica vazio.
3. **Poka-yoke de alergia/interação depende de dado clínico confiável.** A trava só vale se as alergias estiverem **cadastradas e atualizadas** — isso é processo de admissão e de revisão clínica, não código.
4. **"Ciência da cozinha" e preferências alimentares são fluxo humano.** O app pode registrar; a cozinha precisa **incorporar** a checagem na rotina de preparo.
5. **Câmera do quarto e sinais vitais** envolvem **consentimento, LGPD e hardware** (sensores/wearables, integração). É decisão de produto/jurídico antes de ser tarefa de engenharia — e enquanto não houver decisão, é melhor **comunicar honestamente** à família do que exibir um placeholder.
6. **Trabalho padronizado começa no protocolo.** Templates de tarefa/observação só padronizam se a **coordenação clínica definir os padrões** (o que é "rotina grau III", o que registrar numa queda). O app oferece as escolhas; o conteúdo é decisão assistencial.
7. **Geolocalização do ponto (PJ)** é tema **trabalhista/jurídico** tanto quanto técnico — raio, tolerância e ajuste manual precisam de política antes de regra no código.
8. **Heijunka real (nivelar carga no turno)** é, no fim, **dimensionamento de equipe e desenho de escala** — o app evidencia os picos, mas nivelar exige decisão de gestão sobre quantas mãos em cada janela.

---

### Encerramento

A base é forte e rara: **captura de baixa fricção** que a ponta aceita. O salto de qualidade — operacional e de experiência — não está em mais telas, e sim em três movimentos: **(1) impedir o erro na fonte** (poka-yoke onde dói), **(2) puxar o trabalho com dono e prazo** (fila visível, não pilha), e **(3) fazer o sistema falar de pessoas e do dia** (cuidado percebido, dentro e para a família). Nada disso exige reescrever o app — quase tudo reaproveita dado e componente que **já existem**. Curadoria do dono do produto a partir do TOP 15.
