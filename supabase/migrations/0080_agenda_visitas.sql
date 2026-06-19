-- ===========================================================================
-- 0080 — AGENDA DE VISITAS COMERCIAIS (fonte única, compartilhada com o site)
-- ---------------------------------------------------------------------------
-- Duas tabelas:
--   • visita_disponibilidade — a GRADE de slots (datas/horários) que o site
--     pode oferecer. Bloquear = bloqueada=true (+ motivo).
--   • visita_agendamento     — as solicitações de visita (do site ou do app).
--
-- SEGURANÇA (CRÍTICO — o site usa a CHAVE ANÔNIMA pública):
--   O papel `anon` recebe acesso MÍNIMO e EXCLUSIVO:
--     (a) LER visita_disponibilidade apenas dos slots NÃO bloqueados;
--     (b) INSERIR em visita_agendamento apenas como status 'pendente'/origem
--         'site' e SOMENTE nas colunas do formulário (grant por coluna);
--     (c) EXECUTAR a função visitas_slots_livres (slots com vaga real, já
--         descontando ocupações — sem expor a tabela de agendamentos).
--   O `anon` NÃO lê agendamentos, NÃO atualiza/confirma e não toca em
--   nenhuma outra tabela (todas já estão sob RLS `to authenticated`).
--   A gestão (autenticado: Master/Direção) tem acesso completo.
--
-- Idempotente. Rode DEPOIS da 0038 (CRM) — há FK para crm_oportunidade.
-- ===========================================================================

-- 1) TABELAS ----------------------------------------------------------------
create table if not exists public.visita_disponibilidade (
  id              uuid primary key default gen_random_uuid(),
  data            date not null,
  hora            time not null,
  capacidade      int  not null default 1,
  bloqueada       boolean not null default false,
  motivo_bloqueio text,
  unique (data, hora)
);
comment on table public.visita_disponibilidade is
  'Grade de slots de visita (datas/horários ofertáveis pelo site). bloqueada=true some do site.';

create table if not exists public.visita_agendamento (
  id             uuid primary key default gen_random_uuid(),
  nome_completo  text not null,
  whatsapp       text not null,
  email          text,
  data           date not null,
  hora           time not null,
  origem         text not null default 'site' check (origem in ('site','app')),
  status         text not null default 'pendente'
                 check (status in ('pendente','confirmada','remarcada','cancelada')),
  observacao     text,
  -- Integração com o CRM: a visita pode ser vinculada a uma oportunidade do
  -- funil (preenchido só pela gestão; o site sempre insere null).
  oportunidade_id uuid references public.crm_oportunidade(id) on delete set null,
  criado_em      timestamptz not null default now(),
  confirmado_em  timestamptz,
  atualizado_por text
);
comment on table public.visita_agendamento is
  'Solicitações de visita (origem site|app). Gerenciadas pela gestão (confirmar/remarcar/cancelar).';

create index if not exists idx_visita_disp_data on public.visita_disponibilidade (data, hora);
create index if not exists idx_visita_agend_data on public.visita_agendamento (data, hora);
create index if not exists idx_visita_agend_status on public.visita_agendamento (status);

-- 2) RLS --------------------------------------------------------------------
alter table public.visita_disponibilidade enable row level security;
alter table public.visita_agendamento     enable row level security;

-- 2a. GESTÃO (autenticada): acesso completo, restrito a Master/Direção
--     (são os únicos perfis com o módulo comercial/CRM).
drop policy if exists visita_disp_gestao on public.visita_disponibilidade;
create policy visita_disp_gestao on public.visita_disponibilidade for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

drop policy if exists visita_agend_gestao on public.visita_agendamento;
create policy visita_agend_gestao on public.visita_agendamento for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- 2b. SITE (anônimo): SOMENTE ler slots livres + inserir solicitação pendente.
drop policy if exists visita_disp_anon_select on public.visita_disponibilidade;
create policy visita_disp_anon_select on public.visita_disponibilidade for select to anon
  using (bloqueada = false);

drop policy if exists visita_agend_anon_insert on public.visita_agendamento;
create policy visita_agend_anon_insert on public.visita_agendamento for insert to anon
  with check (status = 'pendente' and origem = 'site' and oportunidade_id is null);
-- (sem policies de select/update/delete para anon → negado por padrão)

-- 3) PRIVILÉGIOS POR COLUNA (defesa em profundidade p/ o anônimo) -----------
-- Mesmo com a policy acima, travamos QUAIS colunas o site pode gravar: nada de
-- status/origem/confirmado_em/atualizado_por/oportunidade_id (usam o default).
revoke all on public.visita_agendamento from anon;
grant insert (nome_completo, whatsapp, email, data, hora, observacao)
  on public.visita_agendamento to anon;
-- visita_disponibilidade: o site só lê (a RLS filtra as linhas bloqueadas).
revoke all on public.visita_disponibilidade from anon;
grant select on public.visita_disponibilidade to anon;

-- 4) FUNÇÃO PÚBLICA: slots com VAGA REAL (desconta ocupações) ---------------
-- O site usa esta função para nunca oferecer slot bloqueado NEM ocupado, sem
-- precisar ler a tabela de agendamentos. SECURITY DEFINER: lê as duas tabelas
-- internamente e devolve só o agregado seguro (data, hora, vagas).
create or replace function public.visitas_slots_livres(p_de date, p_ate date)
returns table (data date, hora time, vagas int)
language sql
stable
security definer
set search_path = public
as $$
  select d.data, d.hora, (d.capacidade - coalesce(a.usados, 0))::int as vagas
  from public.visita_disponibilidade d
  left join (
    select data, hora, count(*) as usados
    from public.visita_agendamento
    where status in ('pendente','confirmada','remarcada')
    group by data, hora
  ) a on a.data = d.data and a.hora = d.hora
  where d.bloqueada = false
    and d.data between p_de and p_ate
    and (d.capacidade - coalesce(a.usados, 0)) > 0
  order by d.data, d.hora;
$$;
grant execute on function public.visitas_slots_livres(date, date) to anon, authenticated;

-- 5) SEED DE TESTE ----------------------------------------------------------
-- Grade das próximas 2 semanas, seg–sáb, 09h–17h de hora em hora (capacidade 1).
insert into public.visita_disponibilidade (data, hora, capacidade)
select d::date, h::time, 1
from generate_series(current_date, current_date + interval '13 days', interval '1 day') d
cross join generate_series(timestamp '2000-01-01 09:00', timestamp '2000-01-01 17:00', interval '1 hour') h
where extract(isodow from d) <= 6   -- segunda(1) … sábado(6); exclui domingo
on conflict (data, hora) do nothing;

-- Bloqueios de exemplo: um dia inteiro e um horário específico.
update public.visita_disponibilidade
   set bloqueada = true, motivo_bloqueio = 'Treinamento da equipe'
 where data = current_date + 3;
update public.visita_disponibilidade
   set bloqueada = true, motivo_bloqueio = 'Reservado para manutenção'
 where data = current_date + 1 and hora = '14:00';

-- Agendamentos de exemplo: 1 PENDENTE (vindo do site) + 2 confirmados.
insert into public.visita_agendamento
  (nome_completo, whatsapp, email, data, hora, origem, status, observacao, confirmado_em, atualizado_por)
values
  ('Mariana Souza (teste)',  '5541999990001', 'mariana.teste@example.com',
   current_date + 1, '10:00', 'site', 'pendente',
   'Quer conhecer a suíte Long Stay para a mãe.', null, null),
  ('Carlos Henrique (teste)','5541999990002', 'carlos.teste@example.com',
   current_date + 2, '11:00', 'site', 'confirmada',
   'Confirmada por telefone.', now(), 'Recepção'),
  ('Família Antunes (teste)','5541999990003', null,
   current_date + 4, '15:00', 'app',  'confirmada',
   'Agendado pela direção.', now(), 'Direção')
on conflict do nothing;
