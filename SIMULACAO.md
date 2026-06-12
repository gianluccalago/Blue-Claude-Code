# SIMULAÇÃO DE PRODUÇÃO — Blue Senior Living

Uma **semana realista** da operação, para o dono executar **manualmente na interface** e encontrar o que auditoria de código não pega (fluxo, percepção, travas, cálculos).

- **Pré-requisito:** rodar o `SIMULACAO_SEED.sql` no Supabase (cria o cenário com prefixo `SIM-`). Rode também as migrações `0033`–`0037` antes, se ainda não rodou.
- **Login de todos os usuários SIM-:** senha **`blue`**.
- **Como anotar:** cada passo tem `[ ] OK / [ ] PROBLEMA: ___`. Marque ao executar.
- **Dica:** mantenha esta página aberta no celular/segunda tela enquanto opera o app no navegador.

> Datas no roteiro são relativas a **hoje** (o seed usa `now()`/`current_date`). "Amanhã à noite" = o turno vago; "ontem" = inspeção/plantões já realizados.

---

## ELENCO DO CENÁRIO (criado pelo seed)

### Hóspedes
| # | Nome | Grau (contratual→atual) | Suíte | Particularidade |
|---|---|---|---|---|
| R1 | SIM-Aparecida Nunes | III → III | Suíte | **Dieta pastosa + diabética** (tem **insulina**) · família vinculada |
| R2 | SIM-Otávio Prado | II → II | Apartamento | **ALERGIA: DIPIRONA** · família vinculada |
| R3 | SIM-Conceição Dias | I → I | Long Stay | Independente |
| R4 | SIM-Henrique Salles | **II → III (divergência!)** | Suíte Modular | Gatilho de renegociação |
| R5 | SIM-Lúcia Moraes | II → II | Suíte | — |
| R6 | SIM-Waldir Campos | III → III | Apartamento | — |
| R7 | **SIM-Therezinha Alves** | (vazio) | (vazio) | **Recém-chegada: sem ficha, sem prescrição, sem plano** — será admitida no Dia 1 |

### Equipe (login = e-mail abaixo · senha `blue`)
| Papel | Nome | E-mail | Observação |
|---|---|---|---|
| Cuidadora CLT | SIM-Ana | `sim.ana@blue.local` | **Isenta de ponto** · designada R1, R2, R3 (+R7) |
| Cuidadora CLT | SIM-Beatriz | `sim.beatriz@blue.local` | Isenta · designada R4, R5 |
| Cuidadora CLT | SIM-Carla | `sim.carla@blue.local` | Isenta · designada R6 |
| Cuidadora **PJ** | SIM-Patrícia | `sim.patricia@blue.local` | **NÃO isenta** (bate ponto) · plantão diurno R$180 / noturno R$220 |
| Enfermeira | SIM-Rosa | `sim.rosa@blue.local` | — |
| Médico | SIM-Dr. Geraldo | `sim.medico@blue.local` | CRM-PR 12345 |
| Coordenação | SIM-Marta | `sim.coord@blue.local` | — |
| Farmácia | SIM-Paulo | `sim.farmacia@blue.local` | — |
| Hotelaria | SIM-João | `sim.hotelaria@blue.local` | — |
| Multidisciplinar | SIM-Sandra (Fisio) | `sim.multi@blue.local` | — |
| Nutricionista | SIM-Helena | `sim.nutri@blue.local` | — |
| Administração | SIM-Roberto | `sim.adm@blue.local` | — |
| Master | SIM-Diretor | `sim.master@blue.local` | (ou use seu Master real) |
| Família 1 | SIM-Família Aparecida | `sim.familia1@blue.local` | Vê **só R1** |
| Família 2 | SIM-Família Otávio | `sim.familia2@blue.local` | Vê **só R2** |

### Estado inicial montado pelo seed
- Prescrições ativas para R1–R6 (4–6 medicamentos, vias variadas; R1 com insulina). R7 sem prescrição.
- Planos de cuidado para R1–R6 (variando por grau). R7 sem plano. Modelos de rotina existentes.
- Escala da **semana corrente**: turnos diurnos e noturnos cobrindo 7 dias; **1 turno VAGO amanhã à noite**; a PJ SIM-Patrícia em **4 plantões** (2 já com check-in/check-out preenchidos = realizados).
- Estoque do mês provisionado para **4 dos 6** (R1, R2, R3, R4). **R5 e R6 ficam SEM provisionamento** (de propósito). Estoque de resgate com 1 item em **saldo 2 (baixo)**.
- **2 solicitações de família abertas** (uma p/ Médico — R1; uma p/ Administração — R2). **1 chamado de manutenção aberto, urgência ALTA**. **1 inspeção de suíte de ontem com não-conformidade**.
- Mensalidades do mês: **4 pagas, 2 pendentes**. **3 lançamentos de upselling**.

---

## DIA 1 — ADMISSÃO (o novo hóspede entra no sistema)

| # | PERFIL | AÇÃO na interface | RESULTADO ESPERADO (checkpoint) | Anotação |
|---|---|---|---|---|
|1.1| **Master** (`sim.master`) | Menu **Hóspedes** → abrir **SIM-Therezinha Alves** → **Editar ficha** → preencher nome, nascimento, quarto, **grau contratual = III**, responsável legal, contato de emergência, dieta/alergias, história de vida; **enviar uma FOTO** | A ficha salva; a foto aparece no cabeçalho. Voltando à lista, Therezinha mostra quarto/suíte e grau | `[ ] OK / [ ] PROBLEMA: ___` |
|1.2| **Coordenação** (`sim.coord`) | Menu **Planos de cuidado** → selecionar **Therezinha** → **Aplicar modelo de rotina** (o modelo de grau III) | Tarefas do modelo entram no plano dela; contador de tarefas > 0 | `[ ] OK / [ ] PROBLEMA: ___` |
|1.3| **Médico** (`sim.medico`) | **Prescrições** → Therezinha → **Nova prescrição**: criar 2–3 medicamentos. Em um, usar **posologia 12/12h** | A posologia 12/12h marca automaticamente **Manhã + Noite**; a prescrição entra na lista de ativas | `[ ] OK / [ ] PROBLEMA: ___` |
|1.4| **Médico** | **Teste do poka-yoke de alergia:** selecionar **SIM-Otávio Prado (R2)** → Nova prescrição → digitar **DIPIRONA** | **Alerta vermelho "Hóspede alérgico a DIPIRONA"** aparece e **exige marcar a confirmação** antes de poder salvar. Marque, salve, e confira que ficou registrado | `[ ] OK / [ ] PROBLEMA: ___` |
|1.5| **Farmácia** (`sim.farmacia`) | **Estoque por hóspede** → Therezinha → mês atual → **Provisionar mês** (aceitar as quantidades sugeridas pelas prescrições) | O estoque do mês é criado para Therezinha; o **Painel da Farmácia** deixa de listá-la em "sem provisionamento" | `[ ] OK / [ ] PROBLEMA: ___` |
|1.6| **CHECKPOINT** | Logar como **Coordenação** e **Cuidadora SIM-Ana** | Therezinha aparece nos seletores de hóspede (Planos, Medicação, etc.) e, para Ana, em **Meus hóspedes** (o seed a designou a Ana) | `[ ] OK / [ ] PROBLEMA: ___` |

---

## DIA 2 — ROTINA DA PONTA (cuidadora no tablet)

| # | PERFIL | AÇÃO | RESULTADO ESPERADO | Anotação |
|---|---|---|---|---|
|2.1| **Cuidadora SIM-Ana** | Abrir **Checklist do turno** → a barra de plantão pede **check-in** → **Iniciar plantão** | Como Ana é **isenta**, o check-in é direto (sem geolocalização). A barra fica verde "Plantão ativo" e libera os registros | `[ ] OK / [ ] PROBLEMA: ___` |
|2.2| **SIM-Ana** | Selecionar **R1 (Aparecida)** → executar o checklist: marcar **tarefas como feitas**, registrar **aceitação alimentar** (incluindo a **ceia/noite**), registrar **eliminações** (urina/evacuação) | Cada ação confirma em 1 toque; o cabeçalho mostra **foto + nome + faixa de alergia/dieta**. Status das tarefas muda de cor | `[ ] OK / [ ] PROBLEMA: ___` |
|2.3| **SIM-Ana** | **Medicação** → R1 → período da Manhã → **"Sim, todas"** | Banner verde "Medicação administrada"; o cabeçalho de R1 mostra o selo **"Tomar com alimento"** (dieta) | `[ ] OK / [ ] PROBLEMA: ___` |
|2.4| **SIM-Ana** | **Medicação** → outro período → botão **"Não"** → escolher o motivo **"Recusou"** | Abre os 3 botões de motivo; ao tocar, grava e o banner mostra **"NÃO administrada — Motivo: Recusou"** | `[ ] OK / [ ] PROBLEMA: ___` |
|2.5| **SIM-Ana** | **Registrar intercorrência** → tipo **Queda** → subtipo → selecionar o hóspede **SIM-Otávio (R2)** | Ao selecionar R2, aparece **foto + nome + faixa vermelha "Alérgico a DIPIRONA"**; o botão diz **"Registrar intercorrência de Otávio"** (confirmação do nome). Registrar | `[ ] OK / [ ] PROBLEMA: ___` |
|2.6| **CHECKPOINT** | Logar como **Coordenação** → **Visão geral (Painel)** | A medicação "Não administrada" e a intercorrência de Queda aparecem em **Pendências**, cada uma com a **idade** ("aberta há X min") e ordenadas da mais antiga | `[ ] OK / [ ] PROBLEMA: ___` |

---

## DIA 3 — CICLO CLÍNICO (escala, conduta, IVCF, dieta)

| # | PERFIL | AÇÃO | RESULTADO ESPERADO | Anotação |
|---|---|---|---|---|
|3.1| **Coordenação** | No Painel, na pendência da **Queda (R2)** → **Escalar ao médico** | A pendência ganha o selo **"Escalado ao médico · hora"** | `[ ] OK / [ ] PROBLEMA: ___` |
|3.2| **Médico** | **Painel clínico (Escalados)** → a Queda de R2 aparece com **idade** e **"escalado por SIM-Marta"** → **Resolver** com conduta (ex: "Avaliado, sem fratura; observar") | O item some da fila; a conduta é gravada e volta ao Painel da Coordenação como "Resolvido pelo médico" | `[ ] OK / [ ] PROBLEMA: ___` |
|3.3| **Médico** | **Evolução** → **SIM-Therezinha** → **Nova avaliação IVCF-20** → responder as 20+ questões → salvar | A barra de progresso completa; ao salvar, calcula a **classificação (Grau)** e **atualiza o grau atual** da hóspede na ficha. Conferir que os tetos de cada seção não estouram | `[ ] OK / [ ] PROBLEMA: ___` |
|3.4| **Master/Coord** | Abrir a ficha de **SIM-Henrique (R4)** | **Destaque de divergência** (contratual II × atual III) visível na ficha e em Supervisão clínica — gatilho de renegociação | `[ ] OK / [ ] PROBLEMA: ___` |
|3.5| **Nutricionista** | **Dietas** → R1 (Aparecida) → confirmar/atualizar dieta **pastosa + restrição açúcar** → **Acompanhamento** → conferir a **aceitação alimentar registrada no Dia 2** | A dieta salva; a aba Acompanhamento mostra os níveis de aceitação que Ana lançou ontem | `[ ] OK / [ ] PROBLEMA: ___` |

---

## DIA 4 — FARMÁCIA (dispensação, pedidos, caixinha)

| # | PERFIL | AÇÃO | RESULTADO ESPERADO | Anotação |
|---|---|---|---|---|
|4.1| **Farmácia** | **Dispensação** → aba do período (Manhã) — agora é uma **fila**: hóspedes **pendentes primeiro** | A lista mostra os hóspedes do período com estado pendente/feito e o contador | `[ ] OK / [ ] PROBLEMA: ___` |
|4.2| **Farmácia** | Tentar **dispensar R5 ou R6** (os SEM provisionamento) | **Aviso destacado de saldo insuficiente** ANTES de confirmar; pede **confirmação explícita** ("dispensar mesmo assim deixará saldo negativo") | `[ ] OK / [ ] PROBLEMA: ___` |
|4.3| **Farmácia** | **Pedidos mensais** → **Selecionar todos** com prescrição → **Gerar receitas (ZIP)** | Baixa um `.zip` com um PDF por hóspede (`prescricao_[nome]_AAAA-MM-DD.pdf`), assinado pelo médico geriatra | `[ ] OK / [ ] PROBLEMA: ___` |
|4.4| **Farmácia** | **Custos de medicamento** → mês atual → lançar a **caixinha** de R1 (ex: R$ 320) | O custo é gravado | `[ ] OK / [ ] PROBLEMA: ___` |
|4.5| **CHECKPOINT** | **Administração** → **Upselling** (mês) e **Demonstrativo**; depois **Família 1** → Mensalidade | O custo da caixinha de R1 aparece como **"Medicamentos"** no upselling/demonstrativo da Administração **e** nos extras do portal da **Família 1** | `[ ] OK / [ ] PROBLEMA: ___` |

---

## DIA 5 — IMPREVISTOS (ponto, escala, hotelaria)

| # | PERFIL | AÇÃO | RESULTADO ESPERADO | Anotação |
|---|---|---|---|---|
|5.1| **Cuidadora PJ SIM-Patrícia** | **Minha escala** → no plantão de hoje → **Bater entrada** com a localização **FORA do raio** (no navegador, recuse a permissão de localização ou use um local distante) | O ponto é **RECUSADO** com mensagem clara (fora do raio / sem permissão). Nenhuma entrada é gravada | `[ ] OK / [ ] PROBLEMA: ___` |
|5.2| **Coordenação** | **Escalas** → abrir o turno da Patrícia → **ajuste manual** do check-in/checkout | O ponto é registrado manualmente, marcado como **"ajuste manual"** | `[ ] OK / [ ] PROBLEMA: ___` |
|5.3| **Coordenação** | **Escalas** → criar um **novo turno** para **SIM-Patrícia** que **sobreponha** o horário de um plantão dela existente | O sistema **BLOQUEIA** com aviso de **conflito de horário** (mostra o turno existente). Nada é criado | `[ ] OK / [ ] PROBLEMA: ___` |
|5.4| **Coordenação** | Na fila **"Vagos a cobrir"** (topo) → cobrir o **turno vago de amanhã à noite** atribuindo uma cuidadora | O vago some da fila; o turno passa a mostrar a profissional. (Repare na **cor por urgência** dos vagos) | `[ ] OK / [ ] PROBLEMA: ___` |
|5.5| **Hotelaria** | **Manutenção** → o chamado **urgência ALTA** está no topo → atribuir responsável → **Resolver** | Ao resolver, a **foto de evidência é OBRIGATÓRIA** (não dá para confirmar sem anexar). Anexe e confirme | `[ ] OK / [ ] PROBLEMA: ___` |
|5.6| **Hotelaria** | **Inspeção de suítes** → inspecionar uma suíte → marcar um item de segurança como **não-conforme** → salvar | A inspeção exige **todos os itens respondidos**; a não-conformidade **gera chamado de manutenção** automaticamente | `[ ] OK / [ ] PROBLEMA: ___` |

---

## DIA 6 — FAMÍLIA (percepção, privacidade, conversa)

| # | PERFIL | AÇÃO | RESULTADO ESPERADO | Anotação |
|---|---|---|---|---|
|6.1| **Família 1** (`sim.familia1`) | Abrir o **Início** do portal | Vê **só R1 (Aparecida)**; o card **"O dia de Aparecida"** mostra alimentação em linguagem calorosa (da aceitação do Dia 2) e, se houver, atividade com foto/legenda. **Não** aparece intercorrência/medicação/eliminação | `[ ] OK / [ ] PROBLEMA: ___` |
|6.2| **Família 1** | **TESTE DE RLS:** tentar ver dados de R2 (trocar na URL, ou conferir que nenhum seletor mostra outro hóspede) | **Falha/silêncio:** a família **nunca** vê outro hóspede que não o seu vinculado | `[ ] OK / [ ] PROBLEMA: ___` |
|6.3| **Família 2** (`sim.familia2`) | **Solicitações** → ver as solicitações abertas | Solicitação aberta mostra **"Recebemos sua solicitação — estamos cuidando disso"** (ou "Em análise por [setor]" se o setor já abriu a caixa) | `[ ] OK / [ ] PROBLEMA: ___` |
|6.4| **Administração** | **Solicitações da família** → abrir a de **R2** → **Responder** | Ao abrir a caixa, a solicitação vira **"Em análise por Administração"** para a família; ao responder, vira **"Respondida"** | `[ ] OK / [ ] PROBLEMA: ___` |
|6.5| **Família 2** | Voltar às **Solicitações** | Vê a **resposta** com autor e data, selo "Respondida"/"Resposta nova" | `[ ] OK / [ ] PROBLEMA: ___` |
|6.6| **Cuidadora SIM-Ana** | **Meus hóspedes** → seção **"Combinados com a família"** | A solicitação **respondida** de R1 (se houver) aparece em leitura para o cuidador designado | `[ ] OK / [ ] PROBLEMA: ___` |
|6.7| **Cuidadora SIM-Ana** | **Compromissos externos** → num compromisso **com data já passada** → preencher **"Como foi"** (ex: "Consulta realizada, retorno em 30 dias") | O desfecho é gravado | `[ ] OK / [ ] PROBLEMA: ___` |
|6.8| **Família** correspondente | **Compromissos** no portal | O **"Compromisso realizado — ..."** aparece junto ao compromisso, com autor e data | `[ ] OK / [ ] PROBLEMA: ___` |

---

## DIA 7 — FECHAMENTO (financeiro, painéis, camaleão)

| # | PERFIL | AÇÃO | RESULTADO ESPERADO | Anotação |
|---|---|---|---|---|
|7.1| **Administração** | **Mensalidades** (mês) → marcar as **2 pendentes** como pagas (use a seleção em lote, se quiser) | Status muda para Pago; inadimplência zera ou cai | `[ ] OK / [ ] PROBLEMA: ___` |
|7.2| **Administração** | Ajustar a **mensalidade de um hóspede** mudando o valor | **Motivo do ajuste é OBRIGATÓRIO** quando o valor muda; após salvar, o **Histórico de alterações** mostra a mudança (de→para, quem, quando, motivo) | `[ ] OK / [ ] PROBLEMA: ___` |
|7.3| **Administração** | **Demonstrativo** → **Exportar Excel**; **Custos de pessoal** → conferir a **PJ SIM-Patrícia** | Excel baixa. Para a PJ: **previsto 4 plantões × realizado 2** (os com check-in/out), e o pagamento calcula **pelo realizado** | `[ ] OK / [ ] PROBLEMA: ___` |
|7.4| **Master** | Percorrer **Painel estratégico**, **Painel operacional**, **Supervisão clínica** | Os números refletem a semana: pendências, aderência, alertas, divergência de grau (R4), IVCF de Therezinha, financeiro do mês | `[ ] OK / [ ] PROBLEMA: ___` |
|7.5| **Master** | **Visão do hóspede (360°)** → **SIM-Therezinha** | Mostra ficha + foto + plano + prescrições + IVCF + tudo que foi montado na semana | `[ ] OK / [ ] PROBLEMA: ___` |
|7.6| **Master** | **Camaleão** → "ver como" **SIM-Ana** → registrar algo (ex: marcar uma tarefa); depois "ver como" **SIM-Rosa (enfermagem)** → registrar uma administração | A barra do Camaleão aparece; as telas são as do perfil personificado. **O registro sai no nome do Master** (você continua logado como Master) — confirme em "Registrado por" | `[ ] OK / [ ] PROBLEMA: ___` |

---

## LIMPEZA (remover os dados SIM- depois)

Rode `SIMULACAO_LIMPEZA.sql` no Supabase (incluído junto ao seed). Ele apaga **apenas** o que foi criado pela simulação:
- Filhos primeiro (prescrições, planos, turnos, estoque, dispensações, administrações, registros, intercorrências, eliminações, solicitações, compromissos, chamados, inspeções, mensalidades, upselling, dietas, atividades, pendências/escalações, IVCF/evoluções) referenciando os hóspedes/usuários SIM-.
- Depois `cuidador_residente`, `usuarios` SIM- e `residentes` SIM-.
- Por fim os logins em `auth.users` (e `auth.identities`) com e-mail `sim.%@blue.local`.

> Identificação: hóspedes e usuários SIM- têm `id` começando com **`5eed00`** e nome com prefixo **`SIM-`** / e-mail `sim.*@blue.local`. Os dados do app que já existiam **não são tocados**.

---

## PONTOS MAIS PROVÁVEIS DE FALHA (atenção redobrada)

1. **RLS da família** (Dia 6.2): a família **só** pode ver o `residente_vinculado`. Teste com afinco — é o risco de privacidade mais grave. Confirme que nem o portal, nem uma URL "chutada", revelam outro hóspede.
2. **Baixa dupla de estoque** (Dia 4): dispensar e **desfazer**; dispensar **duas vezes** o mesmo período. O saldo tem de bater (estorno correto, sem baixar duas vezes nem deixar de estornar).
3. **Turno cruzando a meia-noite** (Dia 5.3): o plantão **noturno** (ex: 19:00–07:00) é o caso difícil da detecção de conflito — teste sobreposição que **cruza a meia-noite** (criar um turno 06:00–10:00 no dia seguinte deve conflitar com o noturno que termina 07:00).
4. **Cálculo do realizado da PJ** (Dia 7.3): previsto = nº de plantões escalados (4); realizado = nº com check-in **e** check-out (2). O pagamento deve usar o **realizado**, não o previsto. Confira diurno × noturno (valores diferentes).
5. **Alerta de alergia** (Dia 1.4): tem de **disparar e travar** o salvamento até a confirmação — e a confirmação tem de ficar registrada.
6. **Foto obrigatória na manutenção** (Dia 5.5): não pode ser possível "resolver" sem anexar a foto.
7. **Card "O dia de" sem dado sensível** (Dia 6.1): confirme que intercorrência/medicação/eliminação **nunca** vazam para a família, mesmo num dia que teve queda (Dia 2.5 foi em R2; o card de R1 não deve mostrar nada clínico).

---

### Ao final
Anote os passos marcados como **PROBLEMA** e me mande — eu trato cada um. Quando terminar a simulação, rode a limpeza para devolver o banco ao estado anterior.
