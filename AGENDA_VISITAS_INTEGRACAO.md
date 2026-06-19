# Agenda de Visitas — Integração com o site institucional

O **app Blue Senior Living** é a **fonte única** da agenda de visitas. O site
institucional (projeto separado) **grava e lê o MESMO Supabase** do app. Este
documento descreve como o site se conecta com segurança.

## 1. Conexão (as mesmas credenciais do app)

O site usa a **URL** e a **CHAVE ANÔNIMA (anon/public)** deste Supabase — as
mesmas que o app já usa nas variáveis:

```
VITE_SUPABASE_URL       = https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY  = <anon public key>
```

> A chave anônima é pública por natureza (vai no front do site). **A segurança
> NÃO depende de esconder a chave — depende da RLS** (migração `0080`), que
> restringe o papel `anon` a exatamente dois usos. Revisar a RLS é o que
> garante que nada além disso fica exposto.

## 2. O que o site PODE fazer (e só isso)

| Ação | Como | Observação |
|------|------|------------|
| Ler horários livres | RPC `visitas_slots_livres(p_de, p_ate)` | **Recomendado.** Já desconta bloqueios **e** ocupações. |
| Ler a grade publicável | `select` em `visita_disponibilidade` | A RLS só deixa ver slots `bloqueada = false` (não enxerga ocupação). |
| Criar solicitação | `insert` em `visita_agendamento` | Entra como `status='pendente'`, `origem='site'`. |

### Ler slots realmente livres (recomendado)

```js
const { data, error } = await supabase.rpc("visitas_slots_livres", {
  p_de: "2026-06-16",
  p_ate: "2026-06-30",
});
// data: [{ data: "2026-06-16", hora: "09:00:00", vagas: 1 }, ...]
```

### Criar a solicitação de visita

```js
// IMPORTANTE: NÃO encadear .select() — o anônimo não tem permissão de LEITURA
// em visita_agendamento (retorno deve ser "minimal"). status/origem usam o
// default do banco (pendente/site).
const { error } = await supabase.from("visita_agendamento").insert({
  nome_completo: "Fulana de Tal",
  whatsapp: "5541999990000",
  email: "fulana@email.com", // opcional
  data: "2026-06-16",
  hora: "09:00",
  observacao: "Tenho interesse na suíte Long Stay", // opcional
});
```

## 3. O que o site NÃO pode (garantido pela RLS)

- ❌ Ler agendamentos (de ninguém) — sem policy de `select` para `anon`.
- ❌ Confirmar / remarcar / cancelar — sem `update`/`delete` para `anon`.
- ❌ Definir `status`, `origem`, `confirmado_em`, `atualizado_por` ou
  `oportunidade_id` — **bloqueado por privilégio de coluna** (o `anon` só pode
  inserir `nome_completo, whatsapp, email, data, hora, observacao`).
- ❌ Acessar QUALQUER outra tabela (hóspedes, financeiro, CRM, usuários…) —
  todas estão sob RLS `to authenticated` e **nenhuma** concede acesso ao `anon`.

## 4. Gestão (no app)

Direção e Master gerenciam tudo em **CRM → Agenda de Visitas**: calendário
semanal (disponível/ocupado/bloqueado), bloquear/liberar dia ou horário, editar
a grade, e confirmar/remarcar/cancelar solicitações — com **mensagem de
WhatsApp/e-mail pronta** (envio manual pelo atendente; a automação via WhatsApp
Business API é evolução futura e só precisará consumir as funções de mensagem
já isoladas em `src/lib/visitas.ts`).

## 5. Checklist de segurança (revisar ao publicar)

1. Migração `0080_agenda_visitas.sql` aplicada.
2. No Supabase, confirmar as policies de `anon`:
   - `visita_disponibilidade`: apenas `select` com `bloqueada = false`.
   - `visita_agendamento`: apenas `insert` com `status='pendente' and origem='site' and oportunidade_id is null`.
3. Confirmar os privilégios de coluna do `anon` em `visita_agendamento`
   (`\dp public.visita_agendamento` → INSERT só nas 6 colunas do formulário).
4. Conferir que nenhuma outra tabela tem policy/grant para `anon`.
