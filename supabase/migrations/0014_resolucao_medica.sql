-- Resoluções médicas: grava quando o médico resolve um item que foi escalado.
-- tipo_origem = "intercorrencia"  →  referencia_id = intercorrencia.id
-- tipo_origem = "eliminacao"      →  referencia_id = eliminacao_tratamento.id
--                                    (o registro do escalamento específico)
create table if not exists resolucao_medica (
  id            uuid        primary key default gen_random_uuid(),
  tipo_origem   text        not null check (tipo_origem in ('intercorrencia', 'eliminacao')),
  referencia_id uuid        not null,
  observacao    text,
  resolvido_por text        not null default 'Médico',
  resolvido_em  timestamptz not null default now()
);

-- Índice para lookup rápido ao checar se um item já foi resolvido.
create index if not exists idx_resolucao_medica_ref
  on resolucao_medica (tipo_origem, referencia_id);
