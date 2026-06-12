-- 0033 — Ficha do hóspede: campos que faltavam + bucket de fotos.
-- Idempotente: pode rodar mais de uma vez sem erro.

-- 1) Campos novos na tabela residentes -------------------------------------
alter table public.residentes
  add column if not exists foto_url text,
  add column if not exists celular_proprio text;

comment on column public.residentes.foto_url is 'URL pública da foto do hóspede (bucket residentes-fotos).';
comment on column public.residentes.celular_proprio is 'Celular do próprio idoso (quando houver).';

-- 2) Bucket de fotos do hóspede (Storage) ----------------------------------
-- Público para leitura (a foto aparece na ficha de vários perfis).
insert into storage.buckets (id, name, public)
values ('residentes-fotos', 'residentes-fotos', true)
on conflict (id) do nothing;

-- Políticas de Storage: leitura pública; escrita apenas para usuários
-- autenticados (a trava fina de QUEM pode editar é feita na interface +
-- pelas policies da tabela residentes). Recriadas de forma idempotente.
drop policy if exists "residentes_fotos_leitura_publica" on storage.objects;
create policy "residentes_fotos_leitura_publica"
  on storage.objects for select
  using (bucket_id = 'residentes-fotos');

drop policy if exists "residentes_fotos_escrita_autenticada" on storage.objects;
create policy "residentes_fotos_escrita_autenticada"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'residentes-fotos');

drop policy if exists "residentes_fotos_update_autenticada" on storage.objects;
create policy "residentes_fotos_update_autenticada"
  on storage.objects for update to authenticated
  using (bucket_id = 'residentes-fotos');
