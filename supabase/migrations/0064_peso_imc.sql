-- ===========================================================================
-- 0064 — Peso e IMC (Nutricionista, BLOCO N6)
-- ---------------------------------------------------------------------------
-- Pesagem mensal estruturada (era só uma tarefa de checklist sem número).
-- Guarda peso, altura (a do cadastro, atualizável), IMC e a data. Perda de peso
-- em idoso é sinal de risco — por isso vira dado clínico com tendência.
--
-- IMC = peso_kg / altura_m². CLASSIFICAÇÃO GERIÁTRICA (mais alta que a do
-- adulto jovem): baixo peso < 22; adequado 22–27; excesso > 27. (A faixa do
-- idoso é deslocada para cima; usamos esta.)
--
-- Leitura clínica: o peso/IMC aparece na ficha do hóspede, na Visão 360º e
-- para o Médico (sinal clínico). Idempotente.
-- ===========================================================================

-- Altura no cadastro do residente (muda pouco; o peso muda todo mês).
alter table public.residentes add column if not exists altura_m numeric;

create table if not exists public.registro_peso (
  id             uuid primary key default gen_random_uuid(),
  residente_id   uuid not null references residentes(id) on delete cascade,
  peso_kg        numeric not null check (peso_kg > 0),
  altura_m       numeric,
  imc            numeric,
  data           date not null default current_date,
  registrado_por text,
  observacao     text,
  registrado_em  timestamptz not null default now()
);

create index if not exists registro_peso_residente_idx on public.registro_peso (residente_id, data);

-- ─── RLS: escreve Nutri+Master; LÊ a equipe clínica (não família) ───────────
alter table public.registro_peso enable row level security;
drop policy if exists registro_peso_select on public.registro_peso;
drop policy if exists registro_peso_write on public.registro_peso;
create policy registro_peso_select on public.registro_peso for select to authenticated
  using (public.app_perfil() <> 'familia');
create policy registro_peso_write on public.registro_peso for all to authenticated
  using (public.app_perfil() in ('nutricionista','master'))
  with check (public.app_perfil() in ('nutricionista','master'));

-- ─── Seed: altura + 3 pesagens p/ 2 hóspedes (Alzira em queda, Otávio estável)
update public.residentes set altura_m = 1.55 where id = 'a0000000-0000-0000-0000-000000000001' and altura_m is null;
update public.residentes set altura_m = 1.70 where id = 'a0000000-0000-0000-0000-000000000002' and altura_m is null;

insert into public.registro_peso (id, residente_id, peso_kg, altura_m, imc, data, registrado_por) values
  -- Alzira (1,55 m) — tendência de PERDA (63 → 61,5 → 58; última queda ~−5,7%)
  ('db000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',63.0,1.55, round(63.0/(1.55*1.55),1),(current_date - interval '2 months')::date,'Camila Rocha'),
  ('db000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',61.5,1.55, round(61.5/(1.55*1.55),1),(current_date - interval '1 month')::date,'Camila Rocha'),
  ('db000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',58.0,1.55, round(58.0/(1.55*1.55),1),current_date,'Camila Rocha'),
  -- Otávio (1,70 m) — ESTÁVEL (70 → 70,5 → 71)
  ('db000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000002',70.0,1.70, round(70.0/(1.70*1.70),1),(current_date - interval '2 months')::date,'Camila Rocha'),
  ('db000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000002',70.5,1.70, round(70.5/(1.70*1.70),1),(current_date - interval '1 month')::date,'Camila Rocha'),
  ('db000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000002',71.0,1.70, round(71.0/(1.70*1.70),1),current_date,'Camila Rocha')
on conflict (id) do nothing;
