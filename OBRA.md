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
3. **Testes de cálculo**: o projeto não tem framework de teste; Fases 0–1 não
   têm cálculo não-trivial (avanço = soma de pesos). Vitest entra na Fase 2
   junto com medição/retenção/multa/IPCA — com os números do contrato como
   casos de teste, como pede o prompt.
4. **Trava dos pesos**: a condição "trava após a 1ª medição" referencia
   `obra_medicoes` (Fase 2) — o guard definitivo (trigger) entra lá; hoje a
   edição é restrita a master/direção e 100% auditada.
5. **Disciplinas semeadas na Fase 0** (dados fixos), mas leitura restrita a
   master/direção até a Fase 3 definir o que o prestador vê do próprio fluxo.

## Próximas fases (aguardando "execute a Fase N")
- **Fase 2** — Medições (BM), gates de documentos mensais, retenções (ledger
  TRP/TRD), multa/bônus, memória de cálculo + vitest dos cálculos.
- **Fase 3** — Projetos complementares (marcos 25/40/25/10, revisões, ART, BIM).
- **Fase 4** — Materiais (planejamento → cotações → OC → recebimento → consumo
  → perdas/glosa → estoque reposição, curva ABC).
- **Fase 5** — Financeiro consolidado (baseline, curva S, contas a pagar, CSV).
- **Fase 6** — Portal do prestador (submissão de BM/documentos/entregas).
- **Fase 7** — Transversais (insumos críticos, ensaios, diário, NCs,
  documentos da obra, aditivos, dashboard executivo).

**Para ativar:** rode a migration `0099` no Supabase (após a 0098). Crie o
usuário da construtora com perfil `obra_prestador` em Equipe e Acessos.
