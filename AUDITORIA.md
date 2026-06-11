# AUDITORIA TÉCNICA — Blue Senior Living

Data: 2026-06-11 · Escopo: todos os módulos (10 perfis) + verificações transversais.
Método: leitura completa de código por módulo, verificação contra as regras de
negócio, análise de fluxos de borda e correção mínima dos defeitos confirmados.

Resultado: **13 correções aplicadas** · build e typecheck **verdes** · zero
casts `as never`/`as unknown` restantes.

---

## 1. Cuidador (checklist, medicação, eliminações, ponto/plantão)

**Nenhum defeito encontrado.** Verificado e conforme:
- Medicação binária (Sim/Não), e o "Sim, todas" conta **apenas as orais**
  (`Medicacao.tsx` filtra `via === "oral"`; injetável/insulina/sonda exibidas
  como "enfermagem" e fora da confirmação).
- 6 períodos com horários corretos (jejum 06:00 … noite 20:00).
- Sem baixa de estoque no cuidador (`baixa_farmacia: false`; baixa só na
  Dispensação da Farmácia).
- Checklist bloqueado fora do turno/sem check-in (tolerância 10 min), com
  **Intercorrência funcionando sempre** (sem PlantaoBar, proposital).
- Aceitação alimentar: 6 refeições; troca de nível é UPDATE (não duplica).
- Ponto: geolocalização (lat -25.4492655…, lng -49.3332183…, raio 150 m) só
  para `isento_ponto_app=false`; isentos com check-in simples; turno noturno
  19h–7h cruza meia-noite corretamente (`combinarDataHoraISO(..., +1 dia)`).
- Duplo clique protegido por `disabled={isPending}`; troca de hóspede remonta
  o componente (`key={hospedeId}`).

## 2. Coordenação

| Problema | Correção |
|---|---|
| **ALTA** — `Painel.tsx` usava o mapa de períodos ANTIGO (4 períodos: "Noite / jejum", `almoco`→"Após almoço"). Pendências de medicação exibiam rótulos errados e `jejum`/`apos_almoco` saíam em código bruto. | Mapa atualizado para os 6 períodos corretos (Jejum/Manhã/Almoço/Após almoço/Tarde/Noite). |
| **MÉDIA** — `useCoordenacao.ts` gravava `tratado_por: "Coordenação"` (autor fixo) em pendências e alertas de eliminação. | Passa a gravar `usuarioAtual.nome` (usuário logado), preservando rastreabilidade. |

Conforme: alertas de eliminação (urina = dia civil; evacuação = 72 h;
silenciado 24 h volta reincidente); pendências (resolvido encerra, escalado
não); intercorrências janela 7 dias; escalas com turnos vagos e noturno
cruzando meia-noite.

## 3. Médico (prescrições, evolução, IVCF)

| Problema | Correção |
|---|---|
| **MÉDIA** — `useMedico.ts` gravava `resolvido_por: "Médico"` fixo nas resoluções. | Grava `usuarioAtual.nome`. |
| **ALTA (clínico-legal)** — `exportPrescricao.ts` assinava TODA receita com médico fixo (`"Dr. Gianlucca Lagomarsino" / CRM-PR 54.260`), independente de quem estivesse logado. | A assinatura usa o **médico logado** (`usuarioAtual.nome` + `registro_profissional`). A identidade autenticada ganhou o campo `registro` (CRM/COREN/CRN), preenchido pelo AuthProvider. |
| **BAIXA** — Nome do arquivo de exportação usava data UTC (virava o dia às 21 h). | Usa `hojeISO()` (dia civil local). |
| Transversal — `Evolucao.tsx` usava `form as unknown as Record<string, unknown>`. | `IVCFForm` convertido de `interface` para `type` (atribuível a `Record<string, unknown>`); cast removido na origem. |

Conforme: IVCF-20 com tetos exatos (AVD instrumental ≤ 4; capacidade aeróbica
≤ 2; morbidades ≤ 4); classificação 0–6 = I, 7–14 = II, ≥ 15 = III (bordas
6/7 e 14/15 verificadas); salvar atualiza `residentes.grau_dependencia` e
invalida o cache de residentes.

## 4. Farmácia / estoque / dispensação / resgate

| Problema | Correção |
|---|---|
| **ALTA** — `useResgate.ts` inseria item de resgate **sem MAIÚSCULAS** — como o casamento prescrição↔estoque↔dispensação é por nome, "Insulina" ≠ "INSULINA" quebraria a baixa. | Insert normaliza `trim().toUpperCase()`. |
| **ALTA** — `useDispensacao.ts` calculava a data com `toISOString().slice(0,10)` (**UTC**): dispensações feitas entre 21 h e meia-noite em SP eram gravadas/buscadas no **dia errado**. | `hojeISODate()` passou a delegar para `hojeISO()` (dia civil local). |
| **MÉDIA** — `dispensado_por` caía no fixo `"Farmácia"`. | Usa `usuarioAtual.nome`. |
| Transversal — `itens: args.itens as unknown as never`. | Cast removido (o tipo `ItemDispensacaoJson[]` já estava correto em `database.ts`). |

Conforme: baixa de estoque do hóspede ocorre na dispensação; **desfazer
estorna**; sem baixa dupla (cuidador não toca em estoque); travas do resgate
(reposição só Farmácia; baixa Farmácia/Coordenação/Médico; cuidador sem
acesso) na interface e no banco (RLS 0031); 6 períodos corretos; invalidações
de cache corretas.

## 5. Nutricionista / Multidisciplinar

**Nenhum defeito encontrado.** O acompanhamento nutricional lê exatamente o
formato que o checklist grava (`Aceitação <refeição>: <nível>`); dietas ativam
nova versão e desativam a anterior (sem duplicar); atividades com upload de
foto tolerante a falha (retorna `null`, não quebra o fluxo); `definida_por`/
`registrado_por` já usavam a identidade logada (via aliases sincronizados).

## 6. Hotelaria / Manutenção

| Problema | Correção |
|---|---|
| **ALTA** — `useHotelaria.ts` usava data **UTC** em "inspeções de hoje" (2 ocorrências): à noite, a inspeção era gravada/buscada no dia errado e a suíte aparecia "pendente de inspeção" indevidamente. | Ambas trocadas por `hojeISO()`. |
| **MÉDIA** — Chamados auto-criados por não-conformidade gravavam `aberto_por: "Hotelaria"` fixo. | Grava `usuarioAtual.nome`. |
| **MÉDIA** — `AbrirChamado.tsx` sugeria autor fixo por perfil ("Coordenação", "Cuidador(a)"…). | O padrão do formulário agora é o **usuário logado** (`usuarioEfetivo.nome`, editável). |

## 7. Administração (mensalidades, upselling, pagamento de pessoal, exports)

| Problema | Correção |
|---|---|
| **MÉDIA** — `formatarMoeda` exibia **"R$ NaN"** para valores não finitos (ex.: preço ausente na tabela × grau). | Guarda `Number.isFinite` → "Não informado". |

Conforme: pagamento PJ por plantão usa o **realizado** (turnos com `check_in`
E `check_out`), com previsto × realizado lado a lado; plantão noturno conta no
mês do dia de **início**; precedência mensalidade do residente > tabela de
preços; exports xlsx com colunas coerentes e datas formatadas.

## 8. Família

| Problema | Correção |
|---|---|
| **ALTA** — `useSolicitacoes.ts` congelava a queryKey no escopo do módulo (`KEY_FAMILIA` capturava `residenteId=""` na carga). Após o login/Camaleão, o cache **não acompanhava o usuário** — lista de solicitações vazia/estagnada. | Chave virou função `keyFamilia()` calculada a cada uso. |
| **MÉDIA** — Hooks da família consultavam com `residenteId=""` quando o usuário não tinha vínculo (erro de uuid inválido / estado ambíguo). | `enabled: !!residenteId` em `useSolicitacoesFamilia`, `useResidenteFamilia`, `useFotosResidente`, `useCompromissosResidente`. |

Conforme: todas as queries filtram pelo `residente_vinculado`; trava REAL no
banco (RLS 0032 — família só enxerga o próprio residente); solicitações
direcionadas com resposta e reencaminhamento; inbox por destino.

## 9. Master / Autenticação / Camaleão

**Nenhum defeito encontrado.** Guard de rota correto (cada perfil só nas suas
telas; Master em todas); usuário inativo é derrubado no login; logout limpa
estado; Camaleão troca a identidade efetiva e os hooks/registros acompanham;
cálculos do painel protegidos contra divisão por zero; estados vazios com
"sem dados"/"Não informado".

## 10. Verificações transversais

- **Tipos Supabase**: todas as tabelas tipadas; **zero** `as never`/`as
  unknown` no código (dois removidos nesta auditoria, corrigidos na origem).
- **Timezone**: helpers de `utils.ts` corretos (dia civil local). Os 4 usos de
  `toISOString().slice(0,10)` (UTC) fora deles foram corrigidos. Nenhum
  restante.
- **Identidade**: nenhum autor fixo restante ("Ana Paula", "Coordenação",
  "Médico", "Farmácia", "Hotelaria", médico do PDF) — tudo sai do usuário
  logado (ou personificado no Camaleão).
- **React Query**: invalidações conferidas nas mutações dos módulos; corrigida
  a única chave congelada (solicitações da família).
- **Build/typecheck**: `tsc -b` e `vite build` verdes.

---

## PROBLEMAS NÃO CORRIGIDOS (decisão humana)

1. ~~Master ainda mostra "sem dados"…~~ **RESOLVIDO** (integração feita após a
   auditoria): os 4 painéis do Master foram ligados às tabelas reais —
   - Visão 360°: IVCF, dieta ativa, evoluções médica/nutricional, atividades
     multidisciplinares e financeiro (mensalidade + upselling do mês).
   - Supervisão Clínica: status do IVCF (atualizado / vencido > 6m / sem
     avaliação) e divergência de grau (atual da última IVCF × contratual).
   - Painel Estratégico: financeiro do mês (receita prevista, custo de pessoal,
     resultado bruto, inadimplência, recebido), tipo de suíte real, manutenção,
     hotelaria e clínico (IVCF/divergência).
   - Painel Operacional: solicitações da família por destino, farmácia
     (estoque/provisionamento/resgate) e hotelaria/manutenção.
   Único "sem dados" remanescente proposital: **taxa de ocupação** (depende de
   um cadastro de total de suítes da casa, que ainda não existe).
2. **Falsos positivos descartados na auditoria** (analisados e considerados
   comportamento CORRETO — documentados para não "corrigirem" no futuro):
   - `inicioDoDiaISO()` e `combinarDataHoraISO()` retornam meia-noite/hora
     LOCAL convertida para UTC — é o desejado para comparar com `timestamptz`.
   - Resolução médica de item escalado **não** encerra o alerta de eliminação
     da Coordenação (que é recalculado de `eliminacao`/`eliminacao_tratamento`
     e só "resolve de verdade" quando o evento é registrado); ela apenas limpa
     a fila do médico.
   - Comparações de medicamento com `toLowerCase()` no Painel da Farmácia são
     defensivas (dados já estão em MAIÚSCULAS) — sem efeito visível.
3. **Senha provisória "blue" e troca obrigatória no 1º acesso** — pendência já
   documentada na migration 0030; exige decisão de fluxo (e-mail de convite ou
   troca forçada).
4. **Uploads dependem de buckets criados no Supabase** (`atividades-fotos`,
   manutenção): o código tolera a falha (retorna `null`), mas se o bucket não
   existir no projeto, a foto simplesmente não é salva. Conferir no painel
   Storage.
