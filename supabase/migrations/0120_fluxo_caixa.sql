-- ===========================================================================
-- 0120 — FLUXO DE CAIXA do empreendimento (visão do diretor: SEMPRE caixa).
-- ---------------------------------------------------------------------------
-- Substitui a planilha CustoBlue: TODO desembolso do empreendimento, por DATA
-- DE PAGAMENTO (nunca competência), com centro de custo, fornecedor, pagador
-- (Seniors Care / PHT / Ernesto) e correção IPCA mensal do acumulado.
-- a) fc_lancamentos: um lançamento por pagamento. origem+origem_id linkam os
--    pagamentos feitos no módulo Obra (marcos, medições, OCs, indiretos) —
--    a tela sincroniza sozinha e TUDO segue editável (controle interno).
-- b) fc_ipca: IPCA mensal (fórmula da planilha:
--    corrigido = (anterior + desembolso do mês) × (1 + IPCA do mês)).
-- c) Seed: os 144 lançamentos da planilha (fev/2023 → jul/2026). O histórico
--    só tinha o MÊS; os DIAS foram assumidos de forma plausível por
--    fornecedor (parcela do terreno dia 10, Bacoccini dia 5, contas dia 20…)
--    e são livremente editáveis.
-- Acesso: master, direção e administração (financeiro). Construtora NÃO vê.
-- Idempotente (o seed só roda com a tabela vazia). Rode após a 0119.
-- ===========================================================================

create table if not exists public.fc_lancamentos (
  id             uuid primary key default gen_random_uuid(),
  data           date not null,                -- data do PAGAMENTO (caixa)
  valor          numeric not null check (valor > 0),
  centro_custo   text not null,                -- terreno · projetos · complementares · construtora · materiais · indiretos (ou livre)
  fornecedor     text not null,
  descricao      text,
  pagador        text not null default 'seniors' check (pagador in ('seniors','pht','ernesto')),
  origem         text not null default 'manual' check (origem in ('planilha','manual','marco','medicao','oc','indireto')),
  origem_id      uuid,                         -- id do registro no módulo Obra (dedup da sincronização)
  observacao     text,
  registrado_por text,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_fc_lanc_data on public.fc_lancamentos (data);
create unique index if not exists uq_fc_lanc_origem on public.fc_lancamentos (origem, origem_id);

create table if not exists public.fc_ipca (
  mes text primary key,                        -- 'YYYY-MM'
  pct numeric not null                         -- fração (0.0084 = 0,84%)
);

drop trigger if exists trg_audit_fc_lancamentos on public.fc_lancamentos;
create trigger trg_audit_fc_lancamentos
  after insert or update or delete on public.fc_lancamentos
  for each row execute function public.fn_obra_audit();

alter table public.fc_lancamentos enable row level security;
alter table public.fc_ipca enable row level security;

drop policy if exists fc_lanc_all on public.fc_lancamentos;
create policy fc_lanc_all on public.fc_lancamentos for all to authenticated
  using (public.app_perfil() in ('master','direcao','administracao'))
  with check (public.app_perfil() in ('master','direcao','administracao'));
drop policy if exists fc_ipca_all on public.fc_ipca;
create policy fc_ipca_all on public.fc_ipca for all to authenticated
  using (public.app_perfil() in ('master','direcao','administracao'))
  with check (public.app_perfil() in ('master','direcao','administracao'));

-- ── Seed da planilha (só se a tabela estiver vazia) ─────────────────────────
insert into public.fc_lancamentos (data, valor, centro_custo, fornecedor, origem, pagador)
select v.data::date, v.valor, v.centro, v.fornecedor, 'planilha', 'seniors'
from (values
('2023-02-10', 150000, 'terreno', 'Vendedores'),
  ('2023-03-10', 150000, 'terreno', 'Vendedores'),
  ('2023-04-10', 99000, 'terreno', 'Vendedores'),
  ('2023-04-10', 23100, 'terreno', 'Corretor'),
  ('2023-04-08', 1350, 'terreno', 'Cartorio'),
  ('2023-05-10', 481500, 'terreno', 'Vendedores'),
  ('2023-05-10', 23100, 'terreno', 'Corretor'),
  ('2023-05-15', 8806, 'terreno', 'IPTU'),
  ('2023-06-10', 170400, 'terreno', 'Vendedores'),
  ('2023-06-10', 23100, 'terreno', 'Corretor'),
  ('2023-06-12', 5500, 'projetos', 'Topografo'),
  ('2023-07-10', 99000, 'terreno', 'Vendedores'),
  ('2023-07-08', 86751, 'terreno', 'ITBI'),
  ('2023-07-10', 23100, 'terreno', 'Corretor'),
  ('2023-07-18', 806, 'terreno', 'Corte árvores'),
  ('2023-08-10', 170400, 'terreno', 'Vendedores'),
  ('2023-08-10', 23100, 'terreno', 'Corretor'),
  ('2023-08-18', 1315, 'terreno', 'Corte árvores'),
  ('2023-09-10', 170400, 'terreno', 'Vendedores'),
  ('2023-09-10', 23100, 'terreno', 'Corretor'),
  ('2023-09-18', 590, 'terreno', 'Corte árvores'),
  ('2023-10-10', 170400, 'terreno', 'Vendedores'),
  ('2023-10-10', 23100, 'terreno', 'Corretor'),
  ('2023-10-12', 3000, 'projetos', 'Topografo'),
  ('2023-10-20', 90, 'terreno', 'Copel / Sanepar'),
  ('2023-11-10', 213301, 'terreno', 'Vendedores'),
  ('2023-11-10', 23100, 'terreno', 'Corretor'),
  ('2023-11-05', 9385, 'projetos', 'Bacoccini'),
  ('2023-11-20', 256, 'terreno', 'Copel / Sanepar'),
  ('2023-12-10', 218073, 'terreno', 'Vendedores'),
  ('2023-12-10', 23100, 'terreno', 'Corretor'),
  ('2023-12-05', 2500, 'projetos', 'Bacoccini'),
  ('2023-12-08', 1168, 'terreno', 'Cartorio'),
  ('2023-12-20', 235, 'terreno', 'Copel / Sanepar'),
  ('2024-01-10', 218073, 'terreno', 'Vendedores'),
  ('2024-01-10', 23100, 'terreno', 'Corretor'),
  ('2024-01-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-01-08', 124, 'terreno', 'Cartorio'),
  ('2024-01-18', 50, 'terreno', 'Corte árvores'),
  ('2024-02-10', 218073, 'terreno', 'Vendedores'),
  ('2024-02-10', 23100, 'terreno', 'Corretor'),
  ('2024-02-05', 4692, 'projetos', 'Bacoccini'),
  ('2024-02-20', 61, 'terreno', 'Copel / Sanepar'),
  ('2024-03-10', 218073, 'terreno', 'Vendedores'),
  ('2024-03-10', 23100, 'terreno', 'Corretor'),
  ('2024-03-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-03-15', 26043, 'terreno', 'IPTU'),
  ('2024-03-18', 50, 'terreno', 'Corte árvores'),
  ('2024-03-20', 54, 'terreno', 'Copel / Sanepar'),
  ('2024-04-10', 218073, 'terreno', 'Vendedores'),
  ('2024-04-10', 23100, 'terreno', 'Corretor'),
  ('2024-04-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-04-20', 54, 'terreno', 'Copel / Sanepar'),
  ('2024-05-10', 218073, 'terreno', 'Vendedores'),
  ('2024-05-10', 23100, 'terreno', 'Corretor'),
  ('2024-05-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-05-20', 54, 'terreno', 'Copel / Sanepar'),
  ('2024-06-10', 218073, 'terreno', 'Vendedores'),
  ('2024-06-10', 23100, 'terreno', 'Corretor'),
  ('2024-06-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-06-18', 797, 'terreno', 'Corte árvores'),
  ('2024-07-10', 218073, 'terreno', 'Vendedores'),
  ('2024-07-10', 23100, 'terreno', 'Corretor'),
  ('2024-07-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-07-20', 411, 'terreno', 'Copel / Sanepar'),
  ('2024-08-10', 221093, 'terreno', 'Vendedores'),
  ('2024-08-10', 23100, 'terreno', 'Corretor'),
  ('2024-08-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-08-20', 313, 'terreno', 'Copel / Sanepar'),
  ('2024-09-10', 221214, 'terreno', 'Vendedores'),
  ('2024-09-10', 23100, 'terreno', 'Corretor'),
  ('2024-09-18', 461, 'terreno', 'Corte árvores'),
  ('2024-09-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-10-10', 221154, 'terreno', 'Vendedores'),
  ('2024-10-10', 23100, 'terreno', 'Corretor'),
  ('2024-10-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-11-10', 223052, 'terreno', 'Vendedores'),
  ('2024-11-10', 23100, 'terreno', 'Corretor'),
  ('2024-11-05', 2500, 'projetos', 'Bacoccini'),
  ('2024-12-10', 223052, 'terreno', 'Vendedores'),
  ('2024-12-10', 23100, 'terreno', 'Corretor'),
  ('2024-12-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-01-10', 232927, 'terreno', 'Vendedores'),
  ('2025-01-10', 23100, 'terreno', 'Corretor'),
  ('2025-01-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-02-10', 227989, 'terreno', 'Vendedores'),
  ('2025-02-10', 23100, 'terreno', 'Corretor'),
  ('2025-02-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-02-18', 100, 'terreno', 'Corte árvores'),
  ('2025-03-10', 227989, 'terreno', 'Vendedores'),
  ('2025-03-10', 23100, 'terreno', 'Corretor'),
  ('2025-03-15', 31006, 'terreno', 'IPTU'),
  ('2025-03-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-04-10', 227989, 'terreno', 'Vendedores'),
  ('2025-04-10', 3680, 'terreno', 'Corretor'),
  ('2025-04-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-05-10', 227989, 'terreno', 'Vendedores'),
  ('2025-05-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-06-10', 287989, 'terreno', 'Vendedores'),
  ('2025-06-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-07-10', 228789, 'terreno', 'Vendedores'),
  ('2025-07-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-08-10', 231878, 'terreno', 'Vendedores'),
  ('2025-08-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-09-10', 231878, 'terreno', 'Vendedores'),
  ('2025-09-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-10-10', 178575, 'terreno', 'Vendedores'),
  ('2025-10-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-11-10', 125523, 'terreno', 'Vendedores'),
  ('2025-11-10', 10000, 'terreno', 'Corretor'),
  ('2025-11-05', 2500, 'projetos', 'Bacoccini'),
  ('2025-12-10', 125523, 'terreno', 'Vendedores'),
  ('2025-12-10', 10000, 'terreno', 'Corretor'),
  ('2025-12-05', 2500, 'projetos', 'Bacoccini'),
  ('2026-01-10', 125523, 'terreno', 'Vendedores'),
  ('2026-01-10', 10000, 'terreno', 'Corretor'),
  ('2026-01-05', 5000, 'projetos', 'Bacoccini'),
  ('2026-02-10', 125523, 'terreno', 'Vendedores'),
  ('2026-02-10', 10000, 'terreno', 'Corretor'),
  ('2026-02-05', 5000, 'projetos', 'Bacoccini'),
  ('2026-03-10', 125523, 'terreno', 'Vendedores'),
  ('2026-03-15', 37403, 'terreno', 'IPTU'),
  ('2026-03-10', 10000, 'terreno', 'Corretor'),
  ('2026-03-05', 5000, 'projetos', 'Bacoccini'),
  ('2026-03-12', 300, 'projetos', 'Topografo'),
  ('2026-04-10', 125523, 'terreno', 'Vendedores'),
  ('2026-04-10', 10000, 'terreno', 'Corretor'),
  ('2026-04-05', 5000, 'projetos', 'Bacoccini'),
  ('2026-04-12', 5000, 'projetos', 'Topografo'),
  ('2026-05-10', 179619, 'terreno', 'Vendedores'),
  ('2026-05-18', 496, 'terreno', 'Corte árvores'),
  ('2026-05-10', 10000, 'terreno', 'Corretor'),
  ('2026-05-05', 5000, 'projetos', 'Bacoccini'),
  ('2026-05-14', 9055, 'terreno', 'Edvaldo'),
  ('2026-06-10', 179619, 'terreno', 'Vendedores'),
  ('2026-06-18', 7200, 'terreno', 'Corte árvores'),
  ('2026-06-05', 5000, 'projetos', 'Bacoccini'),
  ('2026-06-10', 10000, 'terreno', 'Corretor'),
  ('2026-07-10', 179619, 'terreno', 'Vendedores'),
  ('2026-07-08', 76140, 'terreno', 'ITBI'),
  ('2026-07-18', 11000, 'terreno', 'Corte árvores'),
  ('2026-07-14', 2350, 'terreno', 'Edvaldo'),
  ('2026-07-05', 5000, 'projetos', 'Bacoccini'),
  ('2026-07-10', 10000, 'terreno', 'Corretor')
) as v(data, valor, centro, fornecedor)
where not exists (select 1 from public.fc_lancamentos limit 1);

insert into public.fc_ipca (mes, pct) values
('2023-02', 0.0084),
  ('2023-03', 0.0071),
  ('2023-04', 0.0061),
  ('2023-05', 0.0023),
  ('2023-06', -0.0008),
  ('2023-07', 0.0012),
  ('2023-08', 0.0023),
  ('2023-09', 0.0026),
  ('2023-10', 0.0024),
  ('2023-11', 0.0028),
  ('2023-12', 0.0056),
  ('2024-01', 0.0042),
  ('2024-02', 0.0083),
  ('2024-03', 0.0016),
  ('2024-04', 0.0038),
  ('2024-05', 0.0046),
  ('2024-06', 0.0021),
  ('2024-07', 0.0038),
  ('2024-08', -0.0002),
  ('2024-09', 0.0044),
  ('2024-10', 0.0056),
  ('2024-11', 0.0039),
  ('2024-12', 0.0052),
  ('2025-01', 0.0016),
  ('2025-02', 0.0131),
  ('2025-03', 0.0056),
  ('2025-04', 0.0043),
  ('2025-05', 0.0026),
  ('2025-06', 0.0024),
  ('2025-07', 0.0026),
  ('2025-08', -0.0011),
  ('2025-09', 0.0048),
  ('2025-10', 0.0009),
  ('2025-11', 0.0018),
  ('2025-12', 0.0033),
  ('2026-01', 0.0033),
  ('2026-02', 0.007),
  ('2026-03', 0.0088),
  ('2026-04', 0.0067),
  ('2026-05', 0.0058),
  ('2026-06', 0.0016)
on conflict (mes) do nothing;

-- Fim.
