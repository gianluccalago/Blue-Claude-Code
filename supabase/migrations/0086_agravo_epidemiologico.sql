-- ===========================================================================
-- 0086 — VIGILÂNCIA SANITÁRIA · Indicadores obrigatórios da RDC 502/2021 (Anexo)
-- ---------------------------------------------------------------------------
-- Registro dos AGRAVOS que alimentam os 6 indicadores mensais (Art. 58-60 +
-- Anexo): óbito, diarreia aguda, escabiose, desidratação (incidência) e úlcera
-- de decúbito, desnutrição (prevalência). O cálculo é feito no app a partir
-- destes agravos e da população de referência (residentes ativos no dia 15).
--
-- O ÓBITO é conciliado com a saída por falecimento (ciclo de inativação): ao
-- registrar o agravo de óbito, o app também inativa o residente (motivo
-- "Falecimento"); a taxa de mortalidade deduplica as duas fontes.
--
-- Coordenação/Médico registram; o RT/Master consolida e exporta. NÃO exposto à
-- família. Idempotente. Rode DEPOIS da 0030 (app_perfil) e da 0001 (residentes).
-- ===========================================================================

create table if not exists public.agravo_epidemiologico (
  id                  uuid primary key default gen_random_uuid(),
  residente_id        uuid not null references public.residentes(id) on delete cascade,
  tipo                text not null
                      check (tipo in ('obito','diarreia_aguda','escabiose','desidratacao','ulcera_decubito','desnutricao')),
  data_ocorrencia     date not null,
  tipo_registro       text not null check (tipo_registro in ('incidencia','prevalencia')),
  descricao           text,
  registrado_por      text,
  perfil_registrador  text,
  criado_em           timestamptz not null default now()
);
comment on table public.agravo_epidemiologico is
  'RDC 502/2021 (Anexo): agravos que alimentam os 6 indicadores mensais. Óbito conciliado com a saída por falecimento (ciclo de inativação).';

create index if not exists idx_agravo_data on public.agravo_epidemiologico (data_ocorrencia);
create index if not exists idx_agravo_tipo on public.agravo_epidemiologico (tipo);

-- RLS: Coordenação/Médico/Master leem e registram. Não exposto à família.
alter table public.agravo_epidemiologico enable row level security;

drop policy if exists agravo_select on public.agravo_epidemiologico;
create policy agravo_select on public.agravo_epidemiologico for select to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'));

drop policy if exists agravo_write on public.agravo_epidemiologico;
create policy agravo_write on public.agravo_epidemiologico for all to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'))
  with check (public.app_perfil() in ('coordenacao','medico','master'));

-- ---------------------------------------------------------------------------
-- CONCILIAÇÃO ÓBITO ↔ SAÍDA POR FALECIMENTO: ao registrar um agravo de óbito,
-- inativa o residente (motivo "Falecimento") se ainda estiver ativo. Trigger
-- SECURITY DEFINER → funciona mesmo quando quem registra é o Médico (que não
-- escreve direto em residentes). Não duplica: só age sobre residente ativo. A
-- taxa de mortalidade deduplica agravo + saída no cálculo (app).
-- ---------------------------------------------------------------------------
create or replace function public.fn_obito_inativa_residente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.tipo = 'obito' then
    update public.residentes
       set status_hospede = 'inativo',
           data_saida = NEW.data_ocorrencia,
           motivo_saida = 'Falecimento'
     where id = NEW.residente_id and status_hospede = 'ativo';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_obito_inativa on public.agravo_epidemiologico;
create trigger trg_obito_inativa
  after insert on public.agravo_epidemiologico
  for each row execute function public.fn_obito_inativa_residente();
