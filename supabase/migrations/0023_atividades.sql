-- Equipe Multidisciplinar — Atividades de grupo (BLOCO M1)
-- Agenda de atividades (pontuais ou recorrentes), registro de execução
-- (com foto de evidência) e participação dos residentes.

create table atividade (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descricao   text,
  data        date,                 -- atividade pontual; null quando recorrente
  horario     text not null,        -- "HH:MM"
  recorrente  boolean not null default false,
  dias_semana text[],               -- '0'..'6' (domingo..sábado), apenas para recorrentes
  criada_por  text not null,
  criado_em   timestamptz not null default now(),
  constraint atividade_data_ou_recorrencia check (
    (recorrente = false and data is not null and dias_semana is null)
    or
    (recorrente = true and data is null and dias_semana is not null)
  )
);

alter table atividade disable row level security;

-- Registro de que a atividade aconteceu numa data: descrição geral + foto.
-- A foto (foto_url) é o registro visual da atividade e poderá futuramente
-- alimentar o portal da família (BLOCO Família).
create table atividade_execucao (
  id              uuid primary key default gen_random_uuid(),
  atividade_id    uuid not null references atividade(id),
  data            date not null,
  descricao_geral text,
  foto_url        text,
  realizada_por   text not null,
  realizada_em    timestamptz not null default now(),
  unique (atividade_id, data)
);

alter table atividade_execucao disable row level security;

-- Participação dos residentes numa execução: apenas quem participou é
-- registrado (ausência é implícita).
create table atividade_participacao (
  id             uuid primary key default gen_random_uuid(),
  atividade_id   uuid not null references atividade(id),
  data           date not null,
  residente_id   uuid not null references residentes(id),
  presente       boolean not null default true,
  registrado_por text not null,
  registrado_em  timestamptz not null default now(),
  unique (atividade_id, data, residente_id)
);

alter table atividade_participacao disable row level security;

create index if not exists atividade_participacao_residente_idx on atividade_participacao (residente_id);
create index if not exists atividade_execucao_data_idx on atividade_execucao (data);

-- ─── Storage — bucket para fotos de execução de atividades ───────────────────

insert into storage.buckets (id, name, public)
values ('atividades-fotos', 'atividades-fotos', true)
on conflict (id) do nothing;

drop policy if exists "atividades_fotos_select" on storage.objects;
create policy "atividades_fotos_select"
  on storage.objects for select
  using (bucket_id = 'atividades-fotos');

drop policy if exists "atividades_fotos_insert" on storage.objects;
create policy "atividades_fotos_insert"
  on storage.objects for insert
  with check (bucket_id = 'atividades-fotos');

drop policy if exists "atividades_fotos_update" on storage.objects;
create policy "atividades_fotos_update"
  on storage.objects for update
  using (bucket_id = 'atividades-fotos');

drop policy if exists "atividades_fotos_delete" on storage.objects;
create policy "atividades_fotos_delete"
  on storage.objects for delete
  using (bucket_id = 'atividades-fotos');

-- ─── Atividades de teste ──────────────────────────────────────────────────────

insert into atividade (titulo, descricao, horario, recorrente, dias_semana, criada_por) values
  ('Fisioterapia em grupo', 'Alongamento e mobilidade em grupo no salão.', '10:00', true, '{1,2,3,4,5}', 'Equipe Multi'),
  ('Oficina de música', 'Roda de música com instrumentos de percussão.', '14:00', true, '{2,4}', 'Equipe Multi');
