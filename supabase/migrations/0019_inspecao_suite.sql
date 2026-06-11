-- Módulo de Hotelaria — inspeção de suítes (BLOCO H1)
-- ATENÇÃO: ao adicionar o perfil "hotelaria" na aplicação,
-- atualizar o check constraint de usuarios.perfil se necessário.

create table if not exists inspecao_suite (
  id                   uuid primary key default gen_random_uuid(),
  residente_id         uuid references residentes(id),          -- null possível se suíte vazia
  quarto               text,
  tipo                 text not null check (tipo in ('diaria','preventiva')),
  data                 date not null default current_date,
  inspecionado_por     text not null default 'Hotelaria',
  inspecionado_em      timestamptz not null default now(),
  tem_nao_conformidade boolean not null default false
);

create table if not exists inspecao_item (
  id          uuid primary key default gen_random_uuid(),
  inspecao_id uuid not null references inspecao_suite(id) on delete cascade,
  item        text not null,
  status      text not null check (status in ('conforme','nao_conforme')),
  observacao  text
);

alter table inspecao_suite disable row level security;
alter table inspecao_item  disable row level security;

create index if not exists inspecao_suite_residente_idx on inspecao_suite (residente_id);
create index if not exists inspecao_suite_data_idx      on inspecao_suite (data);
create index if not exists inspecao_item_inspecao_idx   on inspecao_item  (inspecao_id);

-- ─── Dados de teste ───────────────────────────────────────────────────────────
-- Residente IDs (definidos em 0001_init.sql):
--   a0000000-…-0001  Profª Alzira   quarto 1-2-04
--   a0000000-…-0002  Sr. Otávio     quarto 1-2-06
--   a0000000-…-0003  Dona Iracema   quarto 1-1-02
--   a0000000-…-0004  Sr. Benedito   quarto 2-1-08
--   a0000000-…-0005  Dona Cecília   quarto 2-2-03
--   a0000000-…-0006  Sr. Walter     quarto 1-1-05

-- Ontem — três inspeções diárias conformes
with ins1 as (
  insert into inspecao_suite (id, residente_id, quarto, tipo, data, inspecionado_por, tem_nao_conformidade)
  values
    ('c0000001-0000-0000-0000-000000000001',
     'a0000000-0000-0000-0000-000000000001', '1-2-04', 'diaria', current_date - 1, 'Maria Hotelaria', false),
    ('c0000001-0000-0000-0000-000000000002',
     'a0000000-0000-0000-0000-000000000002', '1-2-06', 'diaria', current_date - 1, 'Maria Hotelaria', false),
    ('c0000001-0000-0000-0000-000000000003',
     'a0000000-0000-0000-0000-000000000003', '1-1-02', 'diaria', current_date - 1, 'Maria Hotelaria', false)
  returning id, quarto
)
insert into inspecao_item (inspecao_id, item, status)
select id, unnested.item, 'conforme'
from ins1
cross join unnest(array[
  'Arrumação','Limpeza geral','Lixo recolhido','Banheiro higienizado',
  'Roupa de cama trocada','Iluminação funcionando','Climatização funcionando',
  'Botão/chamada de emergência testado'
]) as unnested(item);

-- Hoje — inspeção conforme para Sr. Benedito
with ins2 as (
  insert into inspecao_suite (id, residente_id, quarto, tipo, data, inspecionado_por, tem_nao_conformidade)
  values (
    'c0000001-0000-0000-0000-000000000004',
    'a0000000-0000-0000-0000-000000000004', '2-1-08', 'diaria', current_date, 'Maria Hotelaria', false
  )
  returning id
)
insert into inspecao_item (inspecao_id, item, status)
select id, unnested.item, 'conforme'
from ins2
cross join unnest(array[
  'Arrumação','Limpeza geral','Lixo recolhido','Banheiro higienizado',
  'Roupa de cama trocada','Iluminação funcionando','Climatização funcionando',
  'Botão/chamada de emergência testado'
]) as unnested(item);

-- Hoje — inspeção com não-conformidade para Dona Cecília (climatização e botão com problema)
with ins3 as (
  insert into inspecao_suite (id, residente_id, quarto, tipo, data, inspecionado_por, tem_nao_conformidade)
  values (
    'c0000001-0000-0000-0000-000000000005',
    'a0000000-0000-0000-0000-000000000005', '2-2-03', 'diaria', current_date, 'Maria Hotelaria', true
  )
  returning id
)
insert into inspecao_item (inspecao_id, item, status, observacao)
values
  ((select id from ins3), 'Arrumação',                           'conforme',     null),
  ((select id from ins3), 'Limpeza geral',                       'conforme',     null),
  ((select id from ins3), 'Lixo recolhido',                      'conforme',     null),
  ((select id from ins3), 'Banheiro higienizado',                'conforme',     null),
  ((select id from ins3), 'Roupa de cama trocada',               'conforme',     null),
  ((select id from ins3), 'Iluminação funcionando',              'conforme',     null),
  ((select id from ins3), 'Climatização funcionando',            'nao_conforme', 'Ar-condicionado fazendo barulho, requer manutenção'),
  ((select id from ins3), 'Botão/chamada de emergência testado', 'nao_conforme', 'Sem resposta ao acionamento — verificar urgente');

-- Preventiva de Sr. Walter (ontem)
with ins4 as (
  insert into inspecao_suite (id, residente_id, quarto, tipo, data, inspecionado_por, tem_nao_conformidade)
  values (
    'c0000001-0000-0000-0000-000000000006',
    'a0000000-0000-0000-0000-000000000006', '1-1-05', 'preventiva', current_date - 1, 'Maria Hotelaria', true
  )
  returning id
)
insert into inspecao_item (inspecao_id, item, status, observacao)
values
  ((select id from ins4), 'TV',                    'conforme',     null),
  ((select id from ins4), 'Ar-condicionado (revisão)', 'conforme', null),
  ((select id from ins4), 'Tomadas e elétrica',    'conforme',     null),
  ((select id from ins4), 'Sinais de infiltração', 'nao_conforme', 'Mancha de umidade no canto superior esquerdo da parede'),
  ((select id from ins4), 'Mobiliário',            'conforme',     null),
  ((select id from ins4), 'Fechaduras/portas',     'conforme',     null),
  ((select id from ins4), 'Janelas',               'conforme',     null);
