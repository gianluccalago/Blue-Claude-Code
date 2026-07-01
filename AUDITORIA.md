# Auditoria de Código e Segurança — Blue Senior Living (2026-07-01)

**Escopo:** RLS (penetração anon + escalonamento por perfil), lógica de negócio
(medicação/financeiro/datas/ciclo de vida/cálculos clínicos), segurança de
front (segredos/storage/validação) e robustez (erros silenciosos/race/tipos).
**Método:** análise estática das 92 migrations (RLS reconstruída por *override* —
estado efetivo = última migration que toca cada tabela) e do código-fonte. Sem
acesso a banco vivo. **Nenhuma funcionalidade nova. Sem refatoração de estilo.**

**Estado ao final:** `tsc -b --noEmit` limpo, `npm run build` verde.

> Uma auditoria técnica anterior (2026-06-11), por módulo/perfil, está preservada
> na **Parte B** ao final deste documento.

---

## 1. Sumário executivo

### CRÍTICO
1. **Fotos de idosos em buckets Storage PÚBLICOS (LGPD). — CORRIGIDO.**
   `residentes-fotos`, `usuarios-fotos`, `atividades-fotos`, `manutencao-fotos`,
   `upselling-comprovantes`, `custos-materiais-comprovantes` e o (inexistente)
   `intercorrencias-fotos` eram `public=true` → objeto servido **sem autenticação
   e sem expiração**. **Corrigido** (migration `0093` + refatoração de
   `src/lib/storage.ts`): buckets virados `public=false`, policies de
   `storage.objects` só `authenticated` (derrubadas as antigas de leitura pública),
   e a leitura migrada de `getPublicUrl` → **URL assinada temporária**
   (`createSignedUrl`) via `useUrlAssinada`/`FotoSegura`/`AnexoSeguro`. Uploads
   passam a gravar o **caminho** do objeto; o resolver aceita também as linhas
   legadas (URL pública antiga). Detalhe na seção 7.

### ALTO
2. **Família lê dado clínico cru de TODOS os hóspedes (RLS frouxa).**
   `administracao` (medicação), `eliminacao`, `eliminacao_tratamento`,
   `pendencia_tratamento`, `intercorrencia` ficaram com `auth_all` (qualquer
   autenticado) desde a 0030 e nunca foram reescopadas — um usuário-família
   autenticado lê, via API direta, esses dados de todos os residentes.
   **CORRIGIDO** (migration `0092`): `staff_only` nessas tabelas; `tarefa_registro`
   escopada ao próprio residente da família. O portal não consome essas tabelas →
   sem mudança de comportamento visível.
3. **Administração de medicação com erro silencioso.** `Medicacao.tsx`
   (`confirmarTodas`/`confirmarNao`) e `MedicacaoEnfermagem.tsx` (procedimento) não
   tratavam falha da mutação: em erro, nada aparecia e o registro não acontecia —
   no fluxo mais crítico do app. **CORRIGIDO** (try/catch + toast de erro).

### MÉDIO
4. Série "Evolução financeira" divergia da fonte única (não subtraía materiais).
   **CORRIGIDO** (`useIndicadoresGestao.ts`). Resta o 13º (nov/dez) — ver
   **REQUER DECISÃO #5**.
5. Datas persistidas gravadas em UTC → "viram o dia" às 21h BRT. `data_pagamento`
   de mensalidade e data do peso de admissão. **CORRIGIDO** (`hojeISO()`).
   Restam pontos de *display* (CRM/cobrança) e o *pinning* global em SP — ver
   **REQUER DECISÃO #6**.
6. `visita_agendamento` (insert anônimo do site) sem limite de tamanho.
   **CORRIGIDO** (migration `0092`: CHECK de tamanho por coluna). Rate-limit/formato
   ficam para o front público / gateway — **REQUER DECISÃO #2**.
7. Baixa de estoque na dispensação não é atômica nem idempotente. **NÃO corrigido**
   (exige RPC transacional). **REQUER DECISÃO #3**.
8. `sem_acesso` só barrado no cliente (não na RLS). **NÃO corrigido** (mexe na
   função de auth). **REQUER DECISÃO #4**.

### BAIXO
9. "Meus hóspedes" do cuidador mostra designações fora do turno corrente (ações
   seguem bloqueadas). Documentado (REQUER DECISÃO #9).
10. Baixa de viagem cruzando virada de mês debita tudo no mês de origem.
    Documentado.

### OK (verificado, sem defeito)
Segredos/env limpos; buckets de saúde novos (vacinal/plano/cognitivo) privados +
signed URL; dupla-submissão guardada por `isPending`; isolamento do Camaleão e
autoria correta; casamento de nome de medicamento consistente; baixa de estoque
só na dispensação (nunca dobra com administração); estorno correto; consolidação
de faturamento sem dupla contagem; MEEM/MoCA/IVCF/IMC/proporção-RDC com tetos e
arredondamentos corretos; check-in ±10min imune a fuso; RDC "dia 15" e óbito sem
duplicação; day care não conta leito; parsing de quarto tolerante.

---

## 2. PRIORIDADE 1 — Penetração de RLS

### 2.1. Superfície anônima (chave pública do site)

O papel `anon` só aparece em duas políticas (migration `0080`), ambas legítimas:

| Tabela | anon SELECT | anon INSERT | anon UPDATE | anon DELETE | Resultado |
|---|---|---|---|---|---|
| `visita_disponibilidade` | ✅ só `bloqueada=false` | ❌ | ❌ | ❌ | **OK** — grade pública, sem dado pessoal |
| `visita_agendamento` | ❌ | ✅ só `status='pendente' AND origem='site' AND oportunidade_id IS NULL`, e **grant por coluna** (nome/whatsapp/email/data/hora/observacao) | ❌ | ❌ | **OK** — não lê agendamentos de terceiros |
| `visitas_slots_livres()` (RPC) | ✅ execute | — | — | — | **OK** — SECURITY DEFINER; devolve só agregado (data, hora, vagas) |
| **todas as demais** | ❌ | ❌ | ❌ | ❌ | **OK** — RLS `to authenticated`; anon negado por padrão |

**Testes de abuso da permissão legítima:**
- *anon lê nome/WhatsApp de outros agendamentos?* **Não** — sem policy de SELECT
  para anon; `revoke all` + só `grant select` na disponibilidade. A RPC não expõe
  a tabela de agendamentos, só a contagem de vagas.
- *anon confirma/bloqueia agenda (UPDATE)?* **Não** — sem policy de UPDATE +
  `revoke all` na `visita_agendamento` e `visita_disponibilidade`.
- *anon insere payload absurdo/flood?* **Parcialmente mitigado** — a RLS/grant não
  limitava tamanho; a migration `0092` adiciona CHECK de tamanho por coluna. Flood
  por volume (linhas ilimitadas / exaustão de capacidade via `pendente`) continua
  possível pela chave pública — mitigação (rate-limit/captcha) é do front público
  / gateway, fora deste repo (**REQUER DECISÃO #2**).

**Enumeração:** todas as 90+ tabelas têm RLS habilitada. Nenhuma policy residual
`to anon` além das duas acima. Nenhum `demo_all` sobreviveu (todos derrubados por
0030/0031/0032). Tabelas criadas após a 0032 (0036–0091) habilitam RLS e criam
policy `to authenticated` na própria migration — nenhuma exposição anônima nova.

### 2.2. Escalonamento por perfil (autenticado)

Matriz do estado **efetivo** (após 0092). "staff" = todos os perfis exceto família.

| Tabela | Leitura | Escrita | Família | Observação |
|---|---|---|---|---|
| `residentes` | staff; cuidador→designados; família→vinculado | master/coord/adm/direção | só o vinculado | 0058 |
| `prescricao` | `<> familia` | master/médico/coord/enfermagem | ❌ | 0030 |
| `administracao` (medicação) | staff | staff | ❌ **(corrigido 0092)** | era auth_all |
| `eliminacao` / `_tratamento` | staff | staff | ❌ **(corrigido 0092)** | era auth_all |
| `pendencia_tratamento` | staff | staff | ❌ **(corrigido 0092)** | era auth_all |
| `intercorrencia` | staff | staff | ❌ **(corrigido 0092)** | era auth_all |
| `tarefa_registro` | staff; família→só o seu | staff | só o seu **(corrigido 0092)** | portal usa aceitação de refeição |
| `plano_cuidado_item` | `<> familia` | **só master/coordenação** | ❌ | 0058 — enfermeira só LÊ ✅ |
| `registro_peso` | `<> familia` | nutri/master | ❌ | 0064 ✅ |
| `teste_cognitivo` | médico/coord/master | médico/master | ❌ | 0091 ✅ (bucket privado) |
| `patologia_residente` / `plano_atencao_saude` | coord/médico/master | idem / master | ❌ | 0088 ✅ |
| `avaliacao_ivcf`, `evolucao`, `evolucao_nutricional`, `dispensacao`, `dieta`, etc. | `<> familia` (staff_only) | staff | ❌ | 0032 ✅ |
| `estoque_resgate` / `baixa_resgate` | `not in (cuidador,familia)` | farmácia/(coord/médico/enfermeira)/master | ❌ | 0031/0058 ✅ |
| `tabela_preco`, `pagamento_mensalidade`, `pagamento_pessoal` | **admin/master** | idem | ❌ | 0032 — **coordenação NÃO vê financeiro** ✅ |
| `custo_material`, `tabela_diaria` | admin/direção/master | idem (tabela: direção/master) | ❌ | 0072/0076 ✅ |
| `cobranca_temporaria` | admin/direção/master; família→só o seu | admin/direção/master | só o seu | 0076 ✅ |
| `upselling` | admin/master; família→só o seu | admin/master | só o seu | 0032 ✅ |
| `compromisso_externo`, `solicitacao_familia` | staff; família→só o seu | idem (enfermeira não vê solicitação) | só o seu | 0032/0058 ✅ |
| `atividade_participacao` | staff; família→só o seu (LÊ) | staff (família não escreve) | lê o seu | 0032 ✅ |
| `turnos`, `modelo_rotina*` | `<> enfermeira` | idem | (não usa) | 0058 |
| `visita_*` (agenda) | master/direção | master/direção | ❌ | 0080 ✅ |

**Respostas diretas às perguntas do briefing:**
- *cuidadora lê financeiro?* **Não** (financeiro é admin/master).
- *família lê outro residente / hóspede inativo?* **Não** nas tabelas escopadas
  (residentes/upselling/cobrança/compromisso/solicitação/participação/tarefa).
- *enfermeira edita plano de cuidado?* **Não** — só leitura (write master/coord).
- *multidisciplinar vê valores?* **Não** — financeiro é admin/master.
- *coordenação vê financeiro?* **Não** — admin/master apenas.
- *família acessa dado clínico cru?* **Não mais** — corrigido em 0092 (antes: sim).
- *perfil `sem_acesso` loga?* Barrado no cliente; **não** na RLS — ver #8.

**Ressalva de escopo horizontal:** nas tabelas `staff_only`/`auth_all`, um membro
da equipe (ex.: cuidador) lê registros de **todos** os residentes, não só os seus
designados (o recorte "meus hóspedes" é de UI). Fechar isso por RLS mudaria
workflows de passagem de plantão — ver **REQUER DECISÃO #7**.

---

## 3. PRIORIDADE 2 — Lógica de negócio

- **[MÉDIO — corrigido] Série financeira ≠ fonte única.** `useEvolucaoFinanceira`
  (`useIndicadoresGestao.ts`) não subtraía `custo_material` do resultado (comentário
  dizia "sem módulo", mas o módulo existe e `useResumoMes` já subtrai). Corrigido:
  passa a subtrair materiais por `mes_referencia`. **O 13º (nov/dez) ainda não é
  somado na série** — divergência residual de 2 meses/ano (REQUER DECISÃO #5).
- **[BAIXO — documentado] Dispensação sem idempotência.** `useDispensacao.ts` sempre
  faz `insert` + decremento; sem unique `(residente_id, periodo, data)`. Dupla
  confirmação (só guardada por UI) grava 2x e decrementa 2x. REQUER DECISÃO #3.
- **[BAIXO — documentado] Baixa de viagem na virada de mês.** `useViagem.ts` usa um
  único `mes_referencia` para todos os dias; dias do mês seguinte debitam do mês de
  origem. Estorno espelha o mesmo mês (fecha em pares), mas o saldo por mês distorce
  durante a viagem.
- **OK:** medicação (baixa só na dispensação, nunca dobra; estorno correto;
  normalização de nome consistente prescrição→estoque→dispensação); faturamento sem
  dupla contagem; upselling de 3 origens somado uma vez; 13º proporcional
  (`decimoTerceiro.ts`); MEEM/MoCA (tetos, soma 30, ajuste trava em 30); IVCF (tetos
  de seção, cortes de grau); IMC geriátrico (<22 / 22–27 / >27); proporção RDC
  (`Math.ceil` por grau).

## 4. PRIORIDADE 3 — Segurança de front

- **Segredos/env: OK.** Nenhum `service_role`/secret/JWT em `src/`. `supabase.ts` só
  usa `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`. `.env*` no `.gitignore`;
  `render.yaml` com `sync:false`.
- **[CRÍTICO — corrigido] Storage público** (item 1) — buckets privados + signed
  URLs (migration `0093` + `storage.ts`).
- **[CRÍTICO — corrigido] `intercorrencias-fotos` nunca criado em migration** →
  `uploadFotoIntercorrencia` falhava e retornava `null` em silêncio. A `0093`
  **cria o bucket privado**; o upload passa a funcionar.
- **[MÉDIO — corrigido] Validação do insert anônimo** (item 6) — CHECK de tamanho na
  0092. Formato/rate-limit: REQUER DECISÃO #2.
- **Camaleão: OK.** `CamaleaoBar` retorna null se `!ehMaster`; `personificar`
  rechecha `perfil==='master'`. Autoria: identidade efetiva (`usuarioAtual`) grava o
  ator; autoria legal (prescritor) usa o Master real (`usuarioAutenticado`).
- **Auth/senha: pendência conhecida.** Senha padrão `"blue"` (migration 0030) é
  provisória de teste. REQUER DECISÃO #8.

## 5. PRIORIDADE 4 — Robustez

- **[ALTO — corrigido] Erro silencioso na medicação/procedimento** (item 3).
- **[MÉDIO — documentado] Datas em UTC de *display*** (CRM `crm.ts`/`CrmTarefas`/
  `useCrm`; cobrança `cobranca.ts`): "vencida"/"hoje"/"próximos 7 dias" deslocam 3h
  antes da meia-noite BRT. Persistidos já corrigidos (item 5). REQUER DECISÃO #6.
- **[MÉDIO — documentado] Fuso do device** (`utils.ts` `hojeISO/dataISO`,
  `cobertura.ts`, `useEliminacao.ts`, `Checklist.tsx`): correto em tablets SP;
  quebra em device fora de SP. `periodos.ts` já usa `Intl…America/Sao_Paulo` como
  referência. REQUER DECISÃO #6.
- **Dupla submissão: OK** (botões `disabled` por `isPending`).
- **`as any`/`as never`: OK** (2 ocorrências benignas).

---

## 6. REQUER DECISÃO

> Itens com impacto de comportamento visível ou regra de negócio — **não alterados**
> sem sua confirmação. Recomendação em cada um.

1. **[CRÍTICO] ~~Tornar privados os buckets com foto de idoso~~ — RESOLVIDO** na
   migration `0093` + refatoração de `src/lib/storage.ts` (buckets privados,
   storage RLS `authenticated`, leitura por URL assinada). Ação operacional
   pendente: **rodar a `0093` no Supabase** e conferir que as fotos carregam.
   Nota: a leitura de storage é liberada a qualquer autenticado (a família precisa
   da foto do seu hóspede); um recorte fino por perfil no `storage.objects` pode ser
   um próximo passo, mas o furo (acesso anônimo/internet) está fechado.
2. **[MÉDIO] Anti-flood/formato no agendamento anônimo.** Tamanho já limitado (0092).
   Falta: validação de formato (e-mail/WhatsApp), dedupe e rate-limit. **Recomendação:**
   validar formato no formulário público (fora deste repo) + rate-limit no gateway;
   opcional: um RPC `SECURITY DEFINER` de inserção que valide/normalize, revogando o
   INSERT direto do anon.
3. **[MÉDIO] Dispensação atômica + idempotente.** **Recomendação:** RPC transacional
   que insere a dispensação e decrementa o estoque na mesma transação, com unique
   `(residente_id, periodo, data)` (ou chave de idempotência) contra dupla baixa.
4. **[MÉDIO] Refletir `sem_acesso` na RLS.** Hoje inócuo (seeds têm `email=null`), mas
   é só o cliente que barra. **Recomendação:** `app_perfil()`/`app_usuario_id()`
   retornarem nulo para `sem_acesso=true` (defesa em profundidade). Não aplicado por
   tocar a função de auth central.
5. **[MÉDIO] 13º na série "Evolução financeira".** A série não soma a provisão de 13º
   em nov/dez (o card do painel soma). **Recomendação:** aplicar `decimoTerceiro.ts`
   por residente presente em nov/dez, como no `useResumoMes`, para o gráfico bater
   com o card.
6. **[MÉDIO] Fuso horário.** Persistidos corrigidos. **Recomendação:** (a) trocar os
   `new Date().toISOString().slice(0,10)` de *display* restantes por `hojeISO()`
   (CRM/cobrança); (b) para robustez fora de SP, reimplementar `hojeISO()/dataISO()`
   sobre `Intl…America/Sao_Paulo` (como `periodos.ts`). É mudança transversal — decida
   se quer pinar tudo em SP ou seguir device-local.
7. **[BAIXO] Escopo horizontal por residente na equipe.** Fechar por RLS (cuidador só
   designados, etc.) as tabelas assistenciais mudaria passagem de plantão. **Recom.:**
   manter recorte de UI; avaliar RLS por designação caso a caso.
8. **[ALTO operacional] Senha padrão `"blue"`.** **Recomendação:** senha individual
   forte + troca obrigatória no 1º acesso antes de produção.
9. **[BAIXO] "Meus hóspedes" fora do turno.** `useHospedes.ts` (`escolherTurno`) cai
   em turno passado/futuro fora do plantão, listando hóspedes fora do turno corrente
   (ações seguem bloqueadas por `usePlantao.liberado`). **Recom.:** para cuidador,
   retornar vazio quando não há turno corrente.

---

## 7. Correções aplicadas nesta auditoria

**SQL — novas migrations (rode após as demais, em ordem):**
`supabase/migrations/0092_rls_familia_clinico_e_agenda.sql`
- `staff_only` (exclui família) em `administracao`, `eliminacao`,
  `eliminacao_tratamento`, `pendencia_tratamento`, `intercorrencia`.
- `tarefa_registro` escopada ao próprio residente da família (portal preservado).
- CHECK de tamanho por coluna em `visita_agendamento` (anti-payload gigante).

`supabase/migrations/0093_storage_privado_lgpd.sql`
- Buckets de foto/comprovante → `public=false` (cria `intercorrencias-fotos`).
- Derruba as policies legadas de **leitura pública** e cria policies de
  `storage.objects` só para `authenticated`.

**Código:**
- `src/lib/storage.ts` — uploads gravam o **caminho** (não URL pública); novo
  resolver `urlAssinadaStorage(bucket, valor)` (aceita caminho novo e URL legada).
- `src/components/AnexoSeguro.tsx` (novo) — `useUrlAssinada`, `<FotoSegura>`,
  `<AnexoSeguro>` (URL assinada temporária na exibição).
- `src/components/FotoUploader.tsx` — exibição por URL assinada (prop `bucket`) +
  prévia local imediata após enviar.
- Sites de exibição migrados: `FotoUploader` (ficha do hóspede/master),
  `HospedeIdentidade`, `Sidebar` (avatar), `useFamilia` (fotos de atividade),
  `Manutencao`, `InspecaoSuites`, `Atividades`, `Upselling`, `CustosMateriais`.
- `src/routes/cuidador/Medicacao.tsx` — try/catch + toast de erro em
  `confirmarTodas`/`confirmarNao`.
- `src/routes/coordenacao/MedicacaoEnfermagem.tsx` — idem no registro de procedimento.
- `src/hooks/useIndicadoresGestao.ts` — série financeira subtrai `custo_material`.
- `src/hooks/useMensalidades.ts` — `data_pagamento` via `hojeISO()` (3 pontos).
- `src/hooks/useEvolucaoAdmissao.ts` — data do peso de admissão via `hojeISO()`.

**Validação final:** `tsc -b --noEmit` limpo · `npm run build` verde.

---

## 8. Não coberto (limite de tempo/contexto)

- Sem banco vivo: a RLS foi reconstruída por leitura das migrations (estado efetivo
  por *override*). Recomenda-se um teste de penetração real contra o Supabase (anon
  key + JWTs de cada perfil) para confirmar em runtime.
- Não auditado a fundo: RH/escala/cozinha/insumos/NPS (RLS conferida como
  `to authenticated`, regras de negócio não esmiuçadas) e os PDFs (jsPDF) além da
  assinatura honesta já conhecida.
- Front público de marketing (formulário de visitas) **não está neste repositório** —
  a validação de formato/rate-limit vive lá e não pôde ser auditada.
- Concorrência real (race conditions) analisada por leitura de código, não sob carga.

---
---

# PARTE B — Auditoria técnica anterior (2026-06-11)

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
   `manutencao-fotos`, `upselling-comprovantes` e — novo — `intercorrencias-fotos`
   para a foto da intercorrência do cuidador): o código tolera a falha (retorna
   `null`), mas se o bucket não existir no projeto, a foto simplesmente não é
   salva. Conferir/criar no painel Storage.
