# ESTÉTICA — Sistema visual Blue Senior Living

Data: 2026-06-11 · Escopo: camada visual completa (zero mudança de
funcionalidade). Este documento é a referência para manter o padrão em
telas futuras.

> **Direção 2026 (redesign ousado):** o app é um SaaS de saúde premium.
> Navy e celeste deixam de ser tinta e viram protagonistas — gradientes,
> profundidade com luz (glass + halos), medalhões de gradiente e números
> de cockpit. Reconhecível numa captura a 3 metros. Veja a seção 10.

---

## 1. Princípios

1. **A ponta manda**: telas do Cuidador são para tablet em movimento —
   alvos de toque ≥ 44px, alto contraste, textos legíveis. Modernizar
   nunca significa miniaturizar.
2. **Tokens antes de classes**: toda cor, sombra e raio vem dos tokens
   centrais (`src/index.css` + `tailwind.config.js`). **Proibido** usar
   cores cruas da paleta Tailwind (`green-500`, `amber-100`, `purple-600`…)
   — use os tokens semânticos.
3. **Hierarquia por peso, não por ruído**: menos bordas e fundos
   competindo; títulos em navy pesado, dados grandes, labels discretos.
4. **Microinterações de 200ms ou menos**: hover/active/entrada de conteúdo
   suaves; nada exagerado.

## 2. Paleta (tokens em `src/index.css`)

| Token | Uso | Valor base |
|---|---|---|
| `primary` | Ação/destaque — azul celeste da marca | `#5CBFE5` (197 72% 63%) |
| `primary-strong` | Hover/active de elementos primários; ícones primários sobre branco (AA) | 197 65% 52% |
| `secondary` | Estrutura: títulos, texto forte, sidebar — navy | 206 58% 28% |
| `background` | Fundo do app — claro com tom celeste | `#F2F8FC` |
| `card` | Superfícies | branco |
| `muted` / `muted-foreground` | Fundos neutros / texto de apoio | — |
| `accent` | Fundo celeste suave (hover, medalhões) | 197 70% 91% |
| `destructive` | **Vermelho = crítico** (alergia, NÃO administrada, vencido) | 0 68% 50% |
| `warning` / `warning-foreground` | **Âmbar = atenção** (pendente, prazo). Texto âmbar SEMPRE em `warning-foreground` (AA) | 38 92% 50% |
| `success` | **Verde = ok** (feito, pago, conforme) | 152 55% 38% |
| `nursing` | **Roxo = enfermagem** (procedimentos exclusivos) | 262 60% 56% |
| `sidebar*` | Navy profundo da navegação | 208 58% 22% |

Receitas de uso das semânticas:
- Selo/badge: `bg-{cor}/10` a `/20` + `text-{cor}` (âmbar: `text-warning-foreground`).
- Faixa de alerta: `border-{cor}/40 bg-{cor}/10`.
- Card com filete: `border-l-4 border-l-{cor}`.
- Opacidades só em passos de 5 (`/5 /10 /15 /20…`) — outros valores não geram CSS no Tailwind v3.

## 3. Tipografia

Fonte: **Plus Jakarta Sans** (400–800, carregada no `index.html`).

| Papel | Receita |
|---|---|
| Título de página (Topbar) | `text-xl font-extrabold tracking-tight text-secondary` |
| Título de seção/painel | `text-2xl font-extrabold tracking-tight text-secondary` |
| Título de card | `CardTitle` (text-lg font-bold, navy — já no componente) |
| **Número de KPI** | `text-2xl`/`text-3xl` `font-extrabold tracking-tight tabular-nums text-secondary` |
| **Label de KPI** | `text-[11px] font-semibold uppercase tracking-wide text-muted-foreground` |
| Texto de apoio | `text-sm text-muted-foreground` |
| Dados numéricos em geral | sempre `tabular-nums` |

## 4. Forma e elevação

- **Raio**: `--radius: 1rem` (assinatura da marca). `rounded-lg` = 16px
  (cards, modais), `rounded-md` = 12px (botões, inputs), `rounded-sm` = 8px.
- **Sombras** (escala única, navy translúcido — nunca preto):
  - `shadow-xs` — repouso de itens pequenos/inputs
  - `shadow-card` — cards em repouso, botões
  - `shadow-soft` — hover de cards clicáveis, botões em hover
  - `shadow-lifted` — dropdowns, modais, drawer
  - `shadow-glow-primary` — destaque pontual da marca (avatar da sidebar)
- Bordas de card: `border-border/70` (mais suaves que o default).

## 5. Movimento

| Utilitário | Uso |
|---|---|
| `animate-fade-in` | aparição simples (erros, overlays) |
| `animate-fade-in-up` | entrada de conteúdo (troca de rota, dropdowns, modais, TabsContent) |
| `active:scale-[0.98]` | feedback de toque (já embutido no Button) |
| shimmer | embutido no `Skeleton` |

Transição padrão: 200ms. Drawer da sidebar: 300ms ease-out.

## 6. Estados de tela

- **Loading**: `LoadingState` = skeleton de lista com shimmer (3 cards
  fantasma + rótulo para leitor de tela). Para estruturas específicas, usar
  `Skeleton` (`ui/skeleton.tsx`) compondo a forma real da tela.
- **Vazio**: `EmptyState` = medalhão celeste + frase amigável.
- **Erro**: `ErrorState` = card destrutivo suave com medalhão, claro sem
  ser alarmista.
- **Salvando**: spinner `Loader2` DENTRO do botão + `disabled` (nunca só
  desabilitar) + toast de sucesso/erro (sonner, top-right, 3s).

## 7. Componentes-chave

- **Button**: variantes `default/secondary/success/warning/destructive/
  outline/ghost`; tamanhos `sm/default/lg/xl/icon` (default já tem 44px).
  Hover escurece (`primary-strong`) e eleva; active comprime 2%.
- **Badge**: `purple` = selo de enfermagem (token `nursing`).
- **HospedeSelector**: ≤6 hóspedes vira grade de cards (alvo 44px, anel no
  ativo); >6 vira combobox com busca.
- **Sidebar**: navy, avatar com iniciais + glow, item ativo celeste com
  filete branco; em <1024px vira drawer com overlay.
- **Login**: halos celestes em blur no fundo, cartão `shadow-lifted` com
  `backdrop-blur`, selo de acesso restrito.

## 8. Acessibilidade

- Texto âmbar: sempre `text-warning-foreground` (contraste AA sobre branco).
- Ícones primários sobre branco: `text-primary-strong` (o celeste puro é
  decorativo, não informativo).
- Foco visível: `focus-visible:ring-2 ring-ring` em tudo que é interativo.
- Alvos de toque ≥ 44px nas telas de ponta (Cuidador/Hotelaria/Farmácia).

## 9. Checklist para telas novas

1. Cores APENAS via tokens (`primary/secondary/success/warning/destructive/nursing/muted/accent`).
2. KPI = número grande navy + label caps discreto (receita da seção 3).
3. Estados: `LoadingState`/`EmptyState`/`ErrorState` + toast nas mutações.
4. Card clicável ganha `hover:shadow-soft hover:border-primary/...`.
5. Botões de ação da ponta: `size="lg"` no mínimo.
6. Conferir o trio: raio `rounded-md/lg`, sombra da escala, transição 200ms.

---

## 10. Linguagem do redesign ousado (2026)

### 10.1 Superfícies e luz (utilitários em `index.css`)
- `.bg-app-mesh` — fundo do app: celeste→branco com halos radiais quase
  imperceptíveis. Aplicado no `AppShell`.
- `.glass` / `.glass-dark` — vidro (blur + translucidez). Usar em topbar,
  barras fixas e overlays. Topbar e CamaleaoBar usam `.glass`.
- `.bg-navy-gradient` — navy profundo em gradiente (sidebar, medalhões
  secundários, banners de identidade da ponta).
- `.bg-brand-gradient` — celeste→azul (medalhões primários, avatares,
  itens ativos, botões de destaque da ponta).
- `.bg-hero-navy` — navy com halo celeste: **cabeçalhos HERO** dos painéis
  e telas de entrada (Estratégico, Operacional, Administração, Família).
- `.text-gradient-brand` — número/título em gradiente da marca.
- `.ring-brand` / `shadow-glow-primary` — glow da marca em elementos ativos.

### 10.2 Cabeçalho HERO (padrão dos dashboards e telas de entrada)
Bloco `rounded-lg bg-hero-navy p-6 text-white shadow-cinematic` com:
- halo decorativo (`absolute … bg-primary/20 blur-3xl`),
- pílula de contexto (selo `border-white/20 bg-white/10 backdrop-blur-sm`),
- título `text-3xl font-extrabold tracking-tight`,
- controles (ex.: seletor de mês) em vidro `bg-white/10`.

### 10.3 Cockpit — primitivas (`components/dashboard/primitives.tsx`)
Componentes APENAS de apresentação (recebem dados prontos via props):
- `Medalhao` — ícone em gradiente por `tom`
  (`primary/secondary/success/warning/destructive/nursing`).
- `HeroStat` — indicador principal: número `text-5xl` + medalhão + glow +
  `apoio` e `children` (ex.: `Sparkbars`).
- `StatCard` — KPI secundário: medalhão no canto, número `text-3xl`,
  `apoio` opcional, hover eleva.
- `ProgressBar` — barra 0–100 com gradiente por tom (dado real, ex.: %
  recebido).
- `Sparkbars` — micro-barras decorativas de uma série real (distribuição).
Regra: **o tom comunica severidade** (destructive=crítico, warning=atenção,
success=ok). Hero usa `alerta` para virar vermelho.

### 10.4 Sidebar de produto
Navy em gradiente (`.bg-navy-gradient`) + halo no topo; cada item tem
**ícone em medalhão** (mapa rota→ícone no próprio componente, sem tocar
`data/`); item ativo = medalhão em `.bg-brand-gradient` + pílula lateral
com glow; rodapé com avatar do usuário em gradiente. Mobile: drawer.

### 10.5 Movimento adicional
- `.animate-route-in` — transição de rota (slide+fade+scale), no `AppShell`.
- `.animate-aurora` / `.animate-aurora-slow` — auroras do login.
- `.animate-glow-pulse` — pulso de glow para alerta crítico (faixa de
  alergia do Cuidador).

### 10.6 Telas da ponta (Cuidador) no redesign
Mais identidade, **sem** miniaturizar: banner de hóspede em
`.bg-navy-gradient` com avatar e selos sólidos de alergia/dieta; níveis de
refeição com `.bg-brand-gradient` + glow no ativo (≥48px, `active:scale`);
eliminação em `h-24` com ícone em medalhão; faixa de alergia com medalhão
pulsante. Mesma quantidade de passos e ações.

### 10.7 Login cinematográfico
Split-screen: painel navy (`.bg-hero-navy`) com auroras, headline com
`.text-gradient-brand`, feature pills; cartão de vidro `shadow-cinematic`
com `backdrop-blur` sobre `.bg-app-mesh`. Mobile cai para coluna única.

### Checklist adicional para telas de gestão novas
7. Cabeçalho de entrada = HERO navy (10.2) quando a tela for um painel.
8. Indicadores = primitivas de cockpit (10.3); nunca cards de número
   "pelado". Hero para o KPI principal, StatCard para os demais.
9. Barras/sparklines só a partir de dado já carregado (decorativo, sem
   eixos) — nunca número inventado.
