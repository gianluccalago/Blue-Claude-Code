-- ===========================================================================
-- 0066 — Escala da cozinha (Nutricionista, BLOCO N5)
-- ---------------------------------------------------------------------------
-- Escala PRÓPRIA da cozinha (CLT), INDEPENDENTE do módulo de Escalas
-- assistenciais (cuidadores) e SEM ponto. É controle interno da Nutricionista,
-- apenas visual — o campo `presente` é opcional e NÃO é ponto CLT.
--
-- Operação: 10 pessoas em dois grupos por paridade do dia (pares × ímpares),
-- 5 por dia, em turnos fixos:
--   06:30–18:30 → 1 cozinheiro + 1 auxiliar
--   09:30–21:30 → 1 cozinheiro + 1 auxiliar
--   08:00–20:00 → 1 cozinheiro
-- Como turno e grupo são fixos por pessoa, a escala se monta sozinha a partir
-- do cadastro (geração automática). Idempotente.
-- ===========================================================================

-- ─── Equipe da cozinha (cadastro) ───────────────────────────────────────────
create table if not exists public.cozinha_funcionario (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  funcao       text not null check (funcao in ('cozinheiro','auxiliar')),
  grupo        text not null check (grupo in ('par','impar')),
  turno_padrao text not null check (turno_padrao in ('06:30-18:30','09:30-21:30','08:00-20:00')),
  ativo        boolean not null default true,
  observacao   text
);

-- ─── Escala gerada (1 linha por pessoa por dia) ─────────────────────────────
create table if not exists public.cozinha_escala (
  id             uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references cozinha_funcionario(id) on delete cascade,
  data           date not null,
  inicio         text not null,
  fim            text not null,
  -- Controle visual opcional da Nutri (presença/falta). NÃO é ponto CLT.
  presente       boolean,
  observacao     text,
  -- Uma pessoa não pode ter dois turnos no mesmo dia (e torna a geração idempotente).
  unique (funcionario_id, data)
);

create index if not exists cozinha_escala_data_idx on public.cozinha_escala (data);

-- ─── RLS: a escala é da cozinha → Nutricionista + Master (leitura e escrita) ─
alter table public.cozinha_funcionario enable row level security;
alter table public.cozinha_escala enable row level security;
drop policy if exists cozinha_funcionario_all on public.cozinha_funcionario;
drop policy if exists cozinha_escala_all on public.cozinha_escala;
create policy cozinha_funcionario_all on public.cozinha_funcionario for all to authenticated
  using (public.app_perfil() in ('nutricionista','master'))
  with check (public.app_perfil() in ('nutricionista','master'));
create policy cozinha_escala_all on public.cozinha_escala for all to authenticated
  using (public.app_perfil() in ('nutricionista','master'))
  with check (public.app_perfil() in ('nutricionista','master'));

-- ─── Seed: 10 funcionários (5 pares, 5 ímpares) nos turnos do padrão ────────
insert into public.cozinha_funcionario (id, nome, funcao, grupo, turno_padrao) values
  -- Grupo PAR (trabalha nos dias pares)
  ('cf000000-0000-0000-0000-000000000001','Marcos Lima','cozinheiro','par','06:30-18:30'),
  ('cf000000-0000-0000-0000-000000000002','Paulo Souza','cozinheiro','par','09:30-21:30'),
  ('cf000000-0000-0000-0000-000000000003','Rita Alves','cozinheiro','par','08:00-20:00'),
  ('cf000000-0000-0000-0000-000000000004','João Pedro','auxiliar','par','06:30-18:30'),
  ('cf000000-0000-0000-0000-000000000005','Ana Clara','auxiliar','par','09:30-21:30'),
  -- Grupo ÍMPAR (trabalha nos dias ímpares)
  ('cf000000-0000-0000-0000-000000000006','Sandra Reis','cozinheiro','impar','06:30-18:30'),
  ('cf000000-0000-0000-0000-000000000007','Carlos Nunes','cozinheiro','impar','09:30-21:30'),
  ('cf000000-0000-0000-0000-000000000008','Beatriz Gomes','cozinheiro','impar','08:00-20:00'),
  ('cf000000-0000-0000-0000-000000000009','Tiago Melo','auxiliar','impar','06:30-18:30'),
  ('cf000000-0000-0000-0000-00000000000a','Luana Dias','auxiliar','impar','09:30-21:30')
on conflict (id) do nothing;

-- ─── Seed: gera a escala da SEMANA ATUAL (domingo→sábado) ───────────────────
-- Para cada dia, escala o grupo cuja paridade casa com o dia do mês, cada um no
-- seu turno padrão (início/fim derivados de turno_padrao). Idempotente.
insert into public.cozinha_escala (funcionario_id, data, inicio, fim, presente)
select f.id,
       g.d::date,
       split_part(f.turno_padrao, '-', 1),
       split_part(f.turno_padrao, '-', 2),
       null
from public.cozinha_funcionario f
cross join generate_series(
  -- Semana com início no DOMINGO (igual ao inicioDaSemana() da UI).
  current_date - extract(dow from current_date)::int,        -- domingo desta semana
  current_date - extract(dow from current_date)::int + 6,    -- sábado
  interval '1 day'
) as g(d)
where f.ativo
  and f.grupo = case when extract(day from g.d)::int % 2 = 0 then 'par' else 'impar' end
on conflict (funcionario_id, data) do nothing;
