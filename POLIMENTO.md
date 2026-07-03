# Polimento visual e de interação — Blue Senior Living

**Escopo:** só UI/interação (animação, consistência visual). **Nenhuma**
funcionalidade, lógica, dado, permissão ou fluxo foi alterado. Build verde e
typecheck limpo ao final.

**Princípios aplicados (invioláveis):**
- Durações 150–250ms, easing `ease-out`.
- Só `transform` e `opacity` (GPU-friendly; roda em tablets modestos). Sem animar
  `blur`/`box-shadow`/`height`/`width` em px. Exceção sancionada pela spec: o
  acordeão usa `grid-template-rows` (0fr→1fr), método permitido.
- **`prefers-reduced-motion` respeitado** — desliga tudo (era o furo principal).
- **Ações críticas repetitivas ficam INSTANTÂNEAS** — nada de entrada/stagger em
  confirmar medicação, checklist, dispensação, check-in. O route-transition ocorre
  só ao NAVEGAR até a tela, nunca no clique de confirmar (a confirmação é uma
  mutação que não remonta a rota → sem reanimação).
- Sem bibliotecas novas (não há framer-motion no projeto; tudo em CSS/Tailwind).

---

## 1. O que já existia (aproveitado, não recriado)

O app já tinha base sólida: tokens no `tailwind.config.js` (raio 1rem, escala de
sombra `xs/card/soft/lifted/cinematic`, `transitionDuration` 200ms), `Skeleton`
com shimmer (translateX, GPU), `LoadingState` já em skeleton, `Toaster` do sonner
**único** (`top-right`, `richColors`, 3000ms), `animate-route-in` no `AppShell` e
`active:scale-[0.98]` no `Button`. O trabalho foi **fechar lacunas e unificar**, não
reconstruir.

## 2. Inconsistências encontradas × correção

| # | Inconsistência | Correção |
|---|---|---|
| 1 | **`prefers-reduced-motion` inexistente** — nenhuma animação era desligada | Bloco global no `index.css` zera animações/transições |
| 2 | Route-transition longa (340ms + `scale`) e fora da faixa | `route-in` afinado: fade + `translateY(8px)`, **180ms**, ease-out, sem scale |
| 3 | Modais com entrada divergente: uns `fade-in-up`, outros **sem animação** (Turno/Turno recorrente), backdrops uns com fade outros sem | Keyframe único `modal-in` (scale 0.97→1 + fade, 180ms) em **todas** as caixas; backdrop sempre `animate-fade-in` |
| 4 | Backdrop de modal com cor crua `bg-black/40` (CrmContatos) fora do token | Trocado por `bg-secondary/40 backdrop-blur-sm` (padrão dos demais) |
| 5 | Sombra de modal divergente (`shadow-soft` em Turno/Turno recorrente vs `shadow-lifted`) | Modais padronizados em `shadow-lifted` |
| 6 | Acordeão da sidebar abria/fechava **seco** (`{aberto && …}`) | Transição suave via `grid-template-rows` (0fr→1fr, 200ms) + `overflow-hidden` |
| 7 | Título da tela trocava sem transição | `key={titulo}` + `animate-fade-in` no `<h1>` da Topbar (micro-fade na troca) |
| 8 | Sem stagger no 1º carregamento das listas | Utilitário `.stagger-in` (delays 0→280ms, cap em 8) aplicado ao `LoadingState` |
| 9 | `Button` sem estado de loading padronizado (cada tela fazia manual) | Prop **opt-in** `loading` (spinner inline + desabilita). Retrocompatível: quem já faz manual não muda |

## 3. Tarefas da spec × estado

- **A1 Route-transition** ✅ afinada para a faixa (fade+translateY, 180ms).
- **A2 Sidebar ativa + hover** ✅ item ativo com barra de acento + fundo e hover
  discreto (já existiam, mantidos e suavizados). **Nota:** um indicador que
  *desliza* entre itens (shared-element) exigiria medir posições/`layoutId` — sem
  lib nova e com o menu em acordeão (itens montam/desmontam), o risco não compensa;
  o estado ativo transiciona suave em 200ms.
- **A3 Título micro-fade** ✅ Topbar.
- **B4 Botões** ✅ `active:scale-[0.98]` (pré-existente) + prop `loading` inline.
- **B5 Toasts unificados** ✅ já havia um `Toaster` único (top-right/3000ms/richColors);
  confirmado que não há segunda instância nem configs divergentes.
- **B6 Skeletons** ✅ `LoadingState` já é skeleton; nenhum spinner de página inteira
  no app (os `animate-spin` restantes são todos inline em botões — desejável).
- **C7 Stagger 1º load** ✅ `.stagger-in` (CSS dispara na montagem; re-render não
  reexecuta) no `LoadingState`; utilitário disponível para outras listas.
- **C8 Modais/drawers scale+fade** ✅ `modal-in` + backdrop fade em todos.
- **C9 Acordeão suave** ✅ `grid-template-rows` na sidebar.
- **D10 Tokens/espaçamento/raio/sombra** ✅ backdrops e sombras de modal unificados;
  `rounded-2xl` restante é só em medalhões/avatares decorativos (correto, não são
  cards). Cards seguem o `Card` central (`rounded-lg` 16px, `shadow-card`, `p-6`).
- **D11 Estados vazios** ✅ `EmptyState` já é o padrão único (79 arquivos o usam);
  `LoadingState`/`ErrorState` idem. Sem divergência relevante.
- **D12 Tipografia** ✅ hierarquia já consistente via componentes centrais
  (`CardTitle` = `text-lg font-bold`; título de página = `text-2xl font-extrabold`
  na Topbar; corpo `text-sm`). Documentada abaixo.

## 4. Tokens / padrões definidos

**Animação (todos em `src/index.css`, só transform/opacity):**
- `.animate-route-in` — entrada de rota: fade + `translateY(8px)`, 180ms.
- `.animate-modal-in` — entrada de modal: `scale(0.97→1)` + fade, 180ms.
- `.animate-fade-in` / `.animate-fade-in-up` — micro-entradas (título, backdrop, popovers/dropdowns).
- `.stagger-in` — container de lista: filhos entram escalonados (40ms/step, cap 8), só na montagem.
- Acordeão: `grid-rows-[0fr]`↔`grid-rows-[1fr]` + `transition-[grid-template-rows] duration-200`.
- Global: `@media (prefers-reduced-motion: reduce)` desliga tudo.

**Elevação (já no tailwind.config):** `shadow-xs` (item de lista) · `shadow-card`
(card padrão) · `shadow-lifted` (modais/drawers) · `shadow-cinematic` (hero/login).

**Raio:** `rounded-lg` = 16px (assinatura da marca; cards/modais) · `rounded-md`
(inputs/botões) · full (avatares/medalhões).

**Backdrop de modal (padrão):** `bg-secondary/40 backdrop-blur-sm animate-fade-in`.

**Tipografia por nível:** página `text-2xl font-extrabold` (Topbar) · seção/card
`text-lg font-bold` (`CardTitle`) · rótulo `text-sm font-semibold` · corpo `text-sm`
· auxiliar `text-xs text-muted-foreground` · números `tabular-nums`.

## 5. Onde deliberadamente NÃO se animou

- Ações críticas repetitivas (medicação, checklist, dispensação, ponto): sem
  entrada/stagger; feedback é o spinner inline no botão durante a mutação (loading
  real, não decorativo) e o `active:scale` tátil (<150ms).
- Indicador da sidebar “deslizante” (shared-element): fora de escopo sem lib de
  layout; o estado ativo transiciona suave sem risco de quebra.

## 6. Arquivos tocados (só UI)

`src/index.css` (keyframes/utilitários + reduced-motion) · `src/components/layout/`
`Topbar.tsx`+`Sidebar.tsx` · `src/components/ui/button.tsx` (prop `loading`) ·
`src/components/states.tsx` (stagger no LoadingState) · modais unificados:
`ConfirmDialog.tsx`, `EditarPerfilDialog.tsx`, `MapaSuites.tsx`, `DayCare.tsx`,
`crm/CrmOportunidade.tsx`, `crm/CrmContatos.tsx`, `vigilancia/RegistrarAgravoModal.tsx`,
`vigilancia/RegistrarEventoSentinelaModal.tsx`, `escala/TurnoModal.tsx`,
`escala/TurnoRecorrenteModal.tsx`, `master/VigilanciaPlano.tsx`,
`master/VigilanciaSentinela.tsx`.

**Validação:** `tsc -b --noEmit` limpo · `npm run build` verde.
