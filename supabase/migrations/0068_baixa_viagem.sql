-- ===========================================================================
-- 0068 — Baixa de estoque por VIAGEM (Farmácia)
-- ---------------------------------------------------------------------------
-- Caso EVENTUAL: o hóspede viaja X dias e leva a medicação. Em vez de
-- "dispensação de rotina" dia a dia, registra-se UMA baixa só, calculada a
-- partir das prescrições ATIVAS de via oral (dose diária × dias da viagem),
-- editável pela farmácia. A baixa decrementa o estoque_hospede de uma vez e
-- fica RASTREÁVEL aqui (motivo claro = viagem, não dispensação normal).
--
-- Durante os dias da viagem NÃO se espera dispensação diária (o hóspede está
-- fora): a tela de Dispensação passa a marcar esses hóspedes como "Em viagem"
-- em vez de "pendente" (não bloqueia nada — ver Dispensacao.tsx / MapaPeriodo).
--
-- Estorno: marca `estornado` e devolve as quantidades ao estoque (lançamento
-- por engano). O registro permanece como histórico. Idempotente.
--
-- AJUSTE 1 (entrada no meio do mês) NÃO precisa de schema novo: usa o campo
-- residentes.data_admissao (já existente) para sinalizar "aguardando primeiro
-- ciclo" e, opcionalmente, gravar provisionamento proporcional no
-- estoque_hospede (mesma tabela do ciclo mensal).
-- ===========================================================================

create table if not exists public.baixa_viagem (
  id             uuid primary key default gen_random_uuid(),
  residente_id   uuid not null references residentes(id) on delete cascade,
  dias           int not null check (dias > 0),
  -- Mês do estoque debitado ("YYYY-MM") — o mesmo saldo que a farmácia enxerga.
  mes_referencia text not null,
  -- [{ medicamento, quantidade, unidade }] — o que saiu para a viagem.
  itens          jsonb not null default '[]'::jsonb,
  data           date not null default current_date,  -- início da viagem
  observacao     text,
  registrado_por text,
  registrado_em  timestamptz not null default now(),
  -- Estorno (devolução ao estoque). Mantém a linha como trilha.
  estornado      boolean not null default false,
  estornado_por  text,
  estornado_em   timestamptz
);

create index if not exists baixa_viagem_residente_idx on public.baixa_viagem (residente_id, data);
create index if not exists baixa_viagem_data_idx on public.baixa_viagem (data);

-- ─── RLS: registra/estorna Farmácia+Master; LÊ a equipe clínica (não família) ─
alter table public.baixa_viagem enable row level security;
drop policy if exists baixa_viagem_select on public.baixa_viagem;
drop policy if exists baixa_viagem_write on public.baixa_viagem;
create policy baixa_viagem_select on public.baixa_viagem for select to authenticated
  using (public.app_perfil() <> 'familia');
create policy baixa_viagem_write on public.baixa_viagem for all to authenticated
  using (public.app_perfil() in ('farmacia','master'))
  with check (public.app_perfil() in ('farmacia','master'));
