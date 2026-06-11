-- Estoque de resgate da casa (medicação de uso agudo)
create table if not exists estoque_resgate (
  id               uuid        primary key default gen_random_uuid(),
  medicamento      text        not null,
  quantidade_atual int         not null default 0,
  unidade          text        not null default 'unidade',
  criado_em        timestamptz not null default now()
);

-- Histórico de baixas do resgate
create table if not exists baixa_resgate (
  id                  uuid        primary key default gen_random_uuid(),
  estoque_resgate_id  uuid        not null references estoque_resgate(id) on delete cascade,
  residente_id        uuid        not null references residentes(id) on delete cascade,
  quantidade          int         not null check (quantidade > 0),
  motivo              text        not null,
  administrado_por    text        not null,
  -- TODO: travar via RLS/policy quando auth estiver implementado
  perfil_responsavel  text        not null check (perfil_responsavel in ('farmacia', 'coordenacao', 'medico')),
  registrado_em       timestamptz not null default now()
);

alter table estoque_resgate disable row level security;
alter table baixa_resgate   disable row level security;

-- Itens de resgate iniciais para testes
insert into estoque_resgate (medicamento, quantidade_atual, unidade) values
  ('Dipirona 500mg',     20, 'comprimido'),
  ('Ondansetrona 4mg',   10, 'comprimido'),
  ('Paracetamol 750mg',  15, 'comprimido')
on conflict do nothing;
