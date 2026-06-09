-- Módulo de Manutenção — chamados (BLOCO H2)

create table if not exists chamado_manutencao (
  id                 uuid primary key default gen_random_uuid(),
  local              text not null,                                  -- suíte (quarto) ou área comum
  residente_id       uuid references residentes(id),                 -- null para áreas comuns
  problema           text not null,
  urgencia           text not null default 'media' check (urgencia in ('baixa','media','alta','emergencia')),
  status             text not null default 'aberto' check (status in ('aberto','em_andamento','resolvido')),
  aberto_por         text not null,
  perfil_solicitante text not null check (perfil_solicitante in ('hotelaria','cuidador','coordenacao','master')),
  responsavel        text,                                            -- atribuído pela Hotelaria
  prazo              date,
  foto_url           text,                                            -- foto de evidência no encerramento
  inspecao_item_id   uuid references inspecao_item(id),               -- vínculo se veio de inspeção
  criado_em          timestamptz not null default now(),
  resolvido_em       timestamptz
);

alter table chamado_manutencao disable row level security;

create index if not exists chamado_manutencao_status_idx          on chamado_manutencao (status);
create index if not exists chamado_manutencao_urgencia_idx        on chamado_manutencao (urgencia);
create index if not exists chamado_manutencao_inspecao_item_idx   on chamado_manutencao (inspecao_item_id);

-- ─── Storage — bucket para fotos de evidência de manutenção ──────────────────

insert into storage.buckets (id, name, public)
values ('manutencao-fotos', 'manutencao-fotos', true)
on conflict (id) do nothing;

drop policy if exists "manutencao_fotos_select" on storage.objects;
create policy "manutencao_fotos_select"
  on storage.objects for select
  using (bucket_id = 'manutencao-fotos');

drop policy if exists "manutencao_fotos_insert" on storage.objects;
create policy "manutencao_fotos_insert"
  on storage.objects for insert
  with check (bucket_id = 'manutencao-fotos');

drop policy if exists "manutencao_fotos_update" on storage.objects;
create policy "manutencao_fotos_update"
  on storage.objects for update
  using (bucket_id = 'manutencao-fotos');

drop policy if exists "manutencao_fotos_delete" on storage.objects;
create policy "manutencao_fotos_delete"
  on storage.objects for delete
  using (bucket_id = 'manutencao-fotos');
