# MELHORIAS — Análise de Usabilidade e Funcionalidade

**Blue Senior Living** · Data: 2026-06-11 · Método: percurso de cada perfil como
usuário real (fluxos do dia de trabalho), com evidência no código.
**Nada foi implementado** — este é um relatório de propostas para decisão item a item.

Contexto que guiou o julgamento: ILPI 40 leitos (meta 200), maioria grau III;
princípio nº 1 = aderência da equipe de ponta (tablet, toque, segundos);
perfis letrados exigem agilidade; Família usa celular.

Legenda de esforço: **B** baixo · **M** médio · **A** alto.

---

## 1. CUIDADOR (o perfil mais crítico)

### 1.1 ⚠️ Alergias invisíveis na tela de Medicação — RISCO CLÍNICO
- **Onde:** `cuidador/Medicacao.tsx` (mostra medicamento/dose/via, nunca `residentes.alergias`).
- **Problema:** o cuidador confirma a medicação sem ver que o hóspede é alérgico (ex.: Penicilina). A informação existe no banco, mas está 2 telas de distância (Meus hóspedes).
- **Impacto:** risco de evento adverso grave; uso diário, 6 períodos × N hóspedes.
- **Proposta:** banner vermelho fixo no topo do período: "⚠️ ALÉRGICO A: PENICILINA" (o `residenteId` já está na tela; é 1 query + 1 banner).
- **Esforço:** **B**

### 1.2 ⚠️ Dieta/restrições invisíveis na hora da refeição — RISCO CLÍNICO
- **Onde:** `cuidador/Checklist.tsx` (seção "Aceitação alimentar"); `DietaResumo` só existe em Meus hóspedes.
- **Problema:** ao registrar aceitação, o cuidador não vê consistência ("pastosa") nem restrições ("sem açúcar") definidas pela Nutricionista — pode ofertar comida errada a disfágico/diabético.
- **Impacto:** risco de broncoaspiração/descompensação; 6 refeições/dia/hóspede.
- **Proposta:** linha compacta acima da aceitação: "Dieta: Pastosa · Sem açúcar, sem leite" (`useDietaAtiva` já existe).
- **Esforço:** **B**

### 1.3 Nome do hóspede some durante o registro — risco de registrar no hóspede errado
- **Onde:** `Checklist.tsx` (tela de ~1.200–1.400px de altura; o seletor fica no topo e sai da vista no scroll).
- **Problema:** no meio das eliminações/refeições, nada na tela diz EM QUEM se está registrando.
- **Impacto:** registro no hóspede errado = prontuário contaminado; centenas de registros/dia.
- **Proposta:** header **sticky** com "Nome — Quarto X" (e alergias) sempre visível durante a ação.
- **Esforço:** **B/M**

### 1.4 Checklist com scroll excessivo (tarefas + 6 refeições + eliminações numa coluna)
- **Problema:** achar a tarefa das 14h exige 2–3 scrolls em tablet portrait; layout linear sem priorização.
- **Impacto:** segundos perdidos × centenas de vezes/dia → burla.
- **Proposta:** seções como abas/acordeão (Tarefas | Refeições | Eliminações | Sob demanda), com Tarefas+Eliminações abertas por padrão; ou âncoras fixas no topo.
- **Esforço:** **M**

### 1.5 Intercorrência exige digitação em situação de urgência
- **Onde:** `Intercorrencia.tsx` (tipo por toque ✔, mas descrição é textarea livre; sem foto apesar de `foto_url` existir no banco).
- **Problema:** numa queda, parar para digitar = não registrar (burla) ou atrasar atendimento.
- **Impacto:** subnotificação do evento mais importante clinicamente.
- **Proposta:** sub-opções por toque após o tipo (Queda → sem ferimento / hematoma / sangramento; Lesão → local + tamanho por botões) gerando texto automático; botão 📷 usando a câmera do tablet (campo `foto_url` já existe e hoje é órfão).
- **Esforço:** **M** (sub-tipos) + **M** (foto/bucket)
- **Nota boa:** o restante já é exemplar — eliminações com botões h-20 e 1 toque, medicação binária com status persistente, check-in com 1 toque.

### 1.6 Botões de nível de refeição pequenos para dedo (px-2 py-3 text-xs)
- **Proposta:** subir para ~44px de altura (`py-4 text-sm`). **Esforço: B**

### 1.7 Sem spinner ao salvar tarefa (botão só desabilita)
- **Problema:** cuidador acha que não clicou e toca de novo.
- **Proposta:** spinner no botão enquanto `isPending`. **Esforço: B**

---

## 2. FARMÁCIA

### 2.1 Dispensação sem fluxo "próximo hóspede" — 240 dispensações/dia recomeçando do zero
- **Onde:** `farmacia/Dispensacao.tsx` (seleciona hóspede → dispensa → volta ao seletor manualmente).
- **Impacto:** 6 períodos × 40 hóspedes/dia; com 200 leitos inviabiliza.
- **Proposta:** botão "Confirmar e próximo ▸" após cada dispensação, percorrendo a lista em ordem de quarto; no Mapa do período, exibir também hóspedes sem itens (badge "sem prescrição oral") para a farmacêutica saber que não pulou ninguém.
- **Esforço:** **B/M**

### 2.2 Provisionamento mensal sem "copiar mês anterior"
- **Onde:** `EstoqueHospede.tsx` (sugere pela prescrição ativa ✔, mas mudanças recentes obrigam redigitação).
- **Proposta:** botão "Copiar quantidades de {mês anterior}" + diff visual do que mudou.
- **Esforço:** **M**

### 2.3 Lembrete do dia 20 só aparece se abrir o painel
- **Onde:** `PainelFarmacia.tsx` (aviso âmbar correto, mas passivo).
- **Proposta:** aviso no topo de TODAS as telas da farmácia a partir do dia 20 com pendência; futuramente notificação.
- **Esforço:** **B**

### 2.4 Alertas do painel sem link direto para resolver
- **Problema:** "estoque baixo do hóspede X" → tela de estoque → selecionar X de novo.
- **Proposta:** link com hóspede pré-selecionado (`?hospede=id`). **Esforço: B**

---

## 3. MÉDICO

### 3.1 Prescrição sem autocomplete de medicamentos
- **Onde:** `medico/Prescricoes.tsx` (digita "LOSARTANA" toda vez; a casa já tem o histórico em `prescricao`).
- **Impacto:** médico passa todo dia; morosidade = sistema desatualizado (princípio do produto).
- **Proposta:** autocomplete com medicamentos já usados na casa (distinct de `prescricao`), preenchendo via/dose mais comuns.
- **Esforço:** **M**

### 3.2 Evolução sem contexto do dia na mesma tela
- **Onde:** `medico/Evolucao.tsx` (textarea vazio; sinais/intercorrências/eliminações em outras telas).
- **Proposta:** painel lateral read-only com o resumo do dia do hóspede (intercorrências, eliminações, aceitação, últimas administrações) ao lado do textarea.
- **Esforço:** **M**

### 3.3 Escalados sem contexto completo para decidir
- **Onde:** `EscaladosMedico.tsx` (tipo + observação; faltam horário de início, ações já tomadas).
- **Proposta:** expandir o card com linha do tempo mínima (registrado às → escalado às → últimas medicações do dia).
- **Esforço:** **M**

### 3.4 IVCF sem rascunho
- **Problema:** interrompeu no item 15, perdeu tudo.
- **Proposta:** rascunho em localStorage por hóspede. **Esforço: B**
- **Nota boa:** IVCF com radios grandes + barra de progresso está ótimo.

---

## 4. COORDENAÇÃO

### 4.1 Pendências sem ordenação por gravidade
- **Onde:** `coordenacao/Painel.tsx` (ordem do banco; "NÃO administrada" se mistura com "parcial").
- **Proposta:** ordenar: medicação NÃO administrada → parcial → intercorrência aberta → reincidente; cor por severidade.
- **Esforço:** **B**

### 4.2 Pendência de medicação sem dizer QUAL medicamento
- **Onde:** `Painel.tsx` PendenciaCard (mostra período, não o fármaco/via — insulina faltante parece igual a vitamina).
- **Proposta:** juntar a prescrição no card (medicamento, dose, via).
- **Esforço:** **M**

### 4.3 Medicação de enfermagem com navegação repetitiva
- **Problema:** insulina das 6h em 5 hóspedes = voltar ao seletor 5 vezes.
- **Proposta:** "◂ anterior | próximo ▸" no cabeçalho do hóspede (mesmo padrão da Dispensação 2.1).
- **Esforço:** **B/M**

### 4.4 Solicitações da família sem aviso — SLA invisível
- **Onde:** menu da coordenação (sem badge); a inbox só conta dentro da tela.
- **Proposta:** badge com contador de abertas no item de menu (coordenação, médico e administração) + destaque se >24h.
- **Esforço:** **M**

### 4.5 Furos de escala sem visão dedicada
- **Onde:** `Escalas.tsx` (célula "1 vago" pequena na visão mensal).
- **Proposta:** faixa no topo "Próximos 7 dias: 3 turnos vagos →" com clique direto no turno (o Painel Operacional do Master já tem esse dado — reusar).
- **Esforço:** **M**

### 4.6 Menu com 10 itens fora da ordem de uso
- **Proposta:** reordenar por frequência (Visão geral, Medicação enfermagem, Escalas, Planos…). **Esforço: B**

### 4.7 Para 200 leitos: painel vira paredão de cards
- **Proposta:** seções colapsáveis com contador + "ver todas", cards mais compactos. **Esforço: M/A**

---

## 5. ADMINISTRAÇÃO

### 5.1 Marcar 40 mensalidades pagas uma a uma
- **Onde:** `Mensalidades.tsx` (1 card + 1 toque por residente; sem lote).
- **Proposta:** seleção múltipla + "Marcar selecionadas como pagas" (com confirmação única).
- **Esforço:** **M**

### 5.2 Upselling recorrente redigitado todo mês
- **Problema:** fralda/fisioterapia se repetem; 7 campos por lançamento.
- **Proposta:** "repetir do mês anterior" por hóspede + últimos valores sugeridos por categoria.
- **Esforço:** **M**

### 5.3 Excel do demonstrativo sem subtotais por categoria
- **Proposta:** 3ª aba "Upselling por categoria" com subtotais (mantenedor não precisa de tabela dinâmica).
- **Esforço:** **B**

---

## 6. FAMÍLIA (celular)

### 6.1 Resposta da solicitação não gera aviso
- **Problema:** coordenação responde, família só descobre se entrar e abrir o card.
- **Proposta:** flag "lida" + badge na aba Solicitações ("1 resposta nova").
- **Esforço:** **M**

### 6.2 "Câmera do quarto" e "Sinais vitais" parecem recurso quebrado
- **Onde:** atalhos do Início levam a "Em desenvolvimento".
- **Impacto:** frustração logo na 1ª semana de uso → família abandona o portal.
- **Proposta:** remover dos atalhos (ou selo "em breve" sem clique) até existirem.
- **Esforço:** **B**

### 6.3 Atalhos do Início achatados em 375px
- **Proposta:** 1 coluna no mobile com alvo ≥44px. **Esforço: B**

---

## 7. HOTELARIA

### 7.1 Inspeção volta ao menu a cada suíte (40×/dia)
- **Onde:** `InspecaoSuites.tsx` (`onSalvo={voltarLista}`).
- **Proposta:** "Salvar e próxima suíte ▸" percorrendo por quarto, com progresso (12/40).
- **Esforço:** **M**

### 7.2 Rouparia exige redigitar número
- **Proposta:** botões − / + ao lado do saldo (toque, não teclado). **Esforço: B**

---

## 8. NUTRICIONISTA

### 8.1 Visão geral mostra todos em vez de priorizar risco
- **Proposta:** filtro padrão "apenas com risco" + toggle "todos". **Esforço: B**

### 8.2 Dieta sem "copiar de outra/última"
- **Proposta:** botão "copiar última dieta definida" pré-marcando botões. **Esforço: B/M**

### 8.3 Peso, aceitação e evolução em 3 lugares
- **Proposta:** consolidar no Acompanhamento (cards na mesma tela do hóspede). **Esforço: M**

---

## 9. MASTER

### 9.1 Lacunas de decisão do Painel Estratégico (o que o CEO ainda não vê)
1. **Tendências** — ocupação/receita/resultado mês a mês (hoje é fotografia, não filme).
2. **Taxa de ocupação real** — falta cadastro do total de suítes da casa (único "sem dados" restante).
3. **Vencimentos** — IVCF a vencer no mês, documentos de equipe (COREN), aniversários de contrato.
4. **Rotatividade de equipe** — entradas/saídas e custo de turnover.
5. **Pipeline de grau** — hóspedes com IVCF tendendo a subir de grau (impacto de receita).
- **Esforço:** **A** (exige histórico/séries) — exceto o item 2, que é **B** (cadastro simples + 1 divisão).

### 9.2 Supervisão clínica sem busca/ordenação (200 linhas)
- **Proposta:** busca por nome/quarto + ordenação por coluna + paginação.
- **Esforço:** **M**

### 9.3 Camaleão com `<select>` simples
- **Proposta:** combobox com busca; destaque maior do "Voltar ao Master".
- **Esforço:** **M**

---

## 10. TRANSVERSAL

### 10.1 🔍 Seleção de hóspede sem busca — bloqueante para 200 leitos
- **Onde:** `HospedeSelector.tsx` (botões para TODOS os residentes) usado em Checklist, Medicação, Dispensação, Planos, 360°… + `<select>` longos em Evolução/Inspeção (inconsistência).
- **Proposta:** um único **combobox com busca por nome/quarto** (e atalho "últimos 3") substituindo os dois padrões em todas as telas.
- **Esforço:** **M/A** (componente único, troca em ~10 telas) — **pré-requisito da expansão**.

### 10.2 Sem sistema de feedback global (toast)
- **Problema:** dezenas de mutações sem confirmação visual de sucesso; erros viram tela inteira vermelha; cada tela resolve diferente (faixa de 4s na intercorrência, banner na medicação, nada em residentes).
- **Proposta:** adotar toast global (ex.: sonner): sucesso discreto, erro não-bloqueante, padrão único nos `onSuccess/onError`.
- **Esforço:** **M**

### 10.3 Sidebar fixa de 288px — sem modo mobile
- **Problema:** em celular sobra ~70px de conteúdo; a Família usa celular e o Master também (emergência).
- **Proposta:** drawer/hambúrguer < 768px; sidebar colapsável em tablet.
- **Esforço:** **M**

### 10.4 Loading de tela inteira a cada navegação
- **Proposta:** skeletons por seção e carregamento parcial (os painéis do Master esperam TODAS as queries hoje).
- **Esforço:** **M**

### 10.5 "Hóspede" vs "Residente" misturados na interface
- **Proposta:** padronizar o rótulo visível ("hóspede" — linguagem da casa) mantendo código/banco como está.
- **Esforço:** **B**

### 10.6 Dados coletados que ninguém consome (auditar)
- `intercorrencia.foto_url` (sem captura nem exibição — ver 1.5), `residentes.cpf` (gravado, nunca exibido), geolocalização do ponto (gravada; sem tela de conferência para a coordenação validar check-ins fora do raio).
- **Proposta:** decidir por campo: exibir, ou documentar como futuro, ou remover.
- **Esforço:** **B** (auditoria) 

---

# TOP 10 — prioridade por (impacto na operação ÷ esforço)

| # | Melhoria | Esforço | Justificativa de uma linha |
|---|----------|---------|----------------------------|
| 1 | **Alergias no topo da Medicação do cuidador** (1.1) | B | Risco clínico direto evitado com 1 banner — maior retorno por linha de código do app. |
| 2 | **Dieta/restrições na Aceitação alimentar** (1.2) | B | Mesmo padrão: previne broncoaspiração/dieta errada usando dado que já existe. |
| 3 | **Header sticky com hóspede ativo (nome/quarto/alergia)** (1.3) | B/M | Elimina o erro mais caro da operação: registrar no hóspede errado. |
| 4 | **"Confirmar e próximo" nos fluxos seriais** — Dispensação, Inspeção, Medicação enfermagem (2.1/7.1/4.3) | B/M | Corta pela metade os 3 fluxos mais repetidos do dia (240 dispensações + 40 inspeções). |
| 5 | **Combobox de hóspede com busca, único para o app** (10.1) | M/A | Pré-requisito dos 200 leitos; hoje cada tela escala para o muro de 200 botões. |
| 6 | **Toast global de sucesso/erro** (10.2) | M | "Salvou ou não salvou?" desaparece de TODAS as telas de uma vez; reduz toques duplicados. |
| 7 | **Ordenação por gravidade + medicamento visível nas pendências da Coordenação** (4.1/4.2) | B/M | A enfermeira-chefe decide na ordem certa e com contexto clínico, sem custo estrutural. |
| 8 | **Mensalidades em lote** (5.1) | M | 40 toques mensais viram 2; primeira dor declarada da Administração. |
| 9 | **Badges de solicitações da família (menu) + aviso de resposta no portal** (4.4/6.1) | M | SLA com a família vira visível dos dois lados — confiança do mantenedor. |
| 10 | **Intercorrência por toques (sub-tipos) + foto** (1.5) | M | O registro mais crítico clinicamente passa a ser viável em urgência (e o campo foto_url deixa de ser órfão). |

**Menções honrosas** (logo abaixo do corte): autocomplete de medicamentos (3.1),
"copiar mês anterior" no provisionamento (2.2), sidebar mobile (10.3),
remover placeholders do portal da família (6.2 — esforço quase nulo),
cadastro de total de suítes para fechar a taxa de ocupação (9.1.2).

---

*Validação: cada achado foi conferido contra o código (arquivo/linha citados nos
itens); achados de auditoria que se mostraram falsos (ex.: supostos bugs de
timezone em helpers corretos) foram descartados e não constam deste relatório.*
