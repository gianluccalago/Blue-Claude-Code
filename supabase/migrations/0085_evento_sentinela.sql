-- ===========================================================================
-- 0085 — VIGILÂNCIA SANITÁRIA · Eventos sentinela e notificação compulsória
-- ---------------------------------------------------------------------------
-- RDC 502/2021: a ILPI notifica IMEDIATAMENTE a autoridade sanitária a
-- ocorrência de eventos sentinela (queda com lesão e tentativa de suicídio —
-- Art. 55) e a vigilância epidemiológica em caso de doença de notificação
-- compulsória (Art. 54). Coordenação/Médico REGISTRAM; o Master (RT) fiscaliza
-- e registra a NOTIFICAÇÃO à vigilância.
--
-- IMPORTANTE: o registro da notificação AQUI é a DOCUMENTAÇÃO do cumprimento —
-- NÃO substitui a notificação real à autoridade sanitária.
--
-- Idempotente. Rode DEPOIS da 0030 (app_perfil) e da 0001 (intercorrencia).
-- ===========================================================================

create table if not exists public.evento_sentinela (
  id                    uuid primary key default gen_random_uuid(),
  residente_id          uuid not null references public.residentes(id) on delete cascade,
  -- Vínculo opcional com a intercorrência de origem (queda → evento sentinela).
  intercorrencia_id     uuid references public.intercorrencia(id) on delete set null,
  tipo                  text not null
                        check (tipo in ('queda_com_lesao','tentativa_suicidio','doenca_notificacao_compulsoria')),
  descricao_doenca      text,          -- qual doença (quando notificação compulsória)
  data_ocorrencia       timestamptz not null default now(),
  descricao             text,
  registrado_por        text,
  perfil_registrador    text,
  gravidade             text,
  -- Notificação à vigilância (preenchida pelo RT/Master).
  notificado            boolean not null default false,
  notificado_em         timestamptz,
  notificado_por        text,
  orgao_notificado      text,
  protocolo_notificacao text,
  observacao_notificacao text,
  criado_em             timestamptz not null default now()
);
comment on table public.evento_sentinela is
  'RDC 502/2021: eventos sentinela (queda c/ lesão, tentativa de suicídio) e doença de notificação compulsória. notificado* = documentação da notificação à vigilância (não substitui a notificação real).';

create index if not exists idx_sentinela_pendente on public.evento_sentinela (notificado, data_ocorrencia desc);
create index if not exists idx_sentinela_interc on public.evento_sentinela (intercorrencia_id);

-- RLS: Coordenação, Médico e Master leem/registram; a notificação (campos
-- notificado*) é ação do RT/Master via a tela de Vigilância (UI), mas a policy
-- mantém os três perfis para o ciclo do registro.
alter table public.evento_sentinela enable row level security;

drop policy if exists sentinela_select on public.evento_sentinela;
create policy sentinela_select on public.evento_sentinela for select to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'));

drop policy if exists sentinela_write on public.evento_sentinela;
create policy sentinela_write on public.evento_sentinela for all to authenticated
  using (public.app_perfil() in ('coordenacao','medico','master'))
  with check (public.app_perfil() in ('coordenacao','medico','master'));

-- ---------------------------------------------------------------------------
-- INTEGRAÇÃO COM INTERCORRÊNCIAS: queda COM lesão gera automaticamente um
-- evento sentinela (vinculado à intercorrência). Trigger SECURITY DEFINER —
-- funciona mesmo quando quem registra é o cuidador (que não escreve direto na
-- evento_sentinela). "Sem ferimento" NÃO gera. A classificação/avaliação de
-- casos não detectados e a NOTIFICAÇÃO seguem com Coordenação/Médico/RT.
-- ---------------------------------------------------------------------------
create or replace function public.fn_queda_evento_sentinela()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.tipo = 'Queda'
     and NEW.observacao is not null
     and lower(NEW.observacao) !~ 'sem ferimento'
     and lower(NEW.observacao) ~ '(hematoma|sangramento|contus|ferimento|fratura|les[aã]o|corte)'
  then
    insert into public.evento_sentinela
      (residente_id, intercorrencia_id, tipo, data_ocorrencia, descricao, registrado_por, perfil_registrador)
    values
      (NEW.residente_id, NEW.id, 'queda_com_lesao', NEW.registrado_em, NEW.observacao,
       NEW.registrado_por, 'automático (queda)');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_queda_evento_sentinela on public.intercorrencia;
create trigger trg_queda_evento_sentinela
  after insert on public.intercorrencia
  for each row execute function public.fn_queda_evento_sentinela();
