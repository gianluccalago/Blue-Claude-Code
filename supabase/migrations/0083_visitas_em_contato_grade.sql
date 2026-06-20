-- ===========================================================================
-- 0083 — Agenda de Visitas: estágio "em_contato", grade padrão (4 horários,
-- dias úteis) e RPC contando o novo estágio como ocupação. Idempotente.
-- ===========================================================================

-- 1) Novo estágio de qualificação no status.
alter table public.visita_agendamento drop constraint if exists visita_agendamento_status_check;
alter table public.visita_agendamento add constraint visita_agendamento_status_check
  check (status in ('pendente','em_contato','confirmada','remarcada','cancelada'));

-- 2) RPC pública de slots livres: "em_contato" também ocupa o slot (o lead já
--    reservou aquele horário enquanto é qualificado).
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
    where status in ('pendente','em_contato','confirmada','remarcada')
    group by data, hora
  ) a on a.data = d.data and a.hora = d.hora
  where d.bloqueada = false
    and d.data between p_de and p_ate
    and (d.capacidade - coalesce(a.usados, 0)) > 0
  order by d.data, d.hora;
$$;
grant execute on function public.visitas_slots_livres(date, date) to anon, authenticated;

-- 3) GRADE PADRÃO: só 10:00, 14:30, 16:00, 17:30 e só em dias úteis (seg–sex).
--    Remove a grade FUTURA fora do padrão (mantém bloqueios da gestão) e insere
--    os 4 horários padrão nos próximos 30 dias úteis. Marcação manual da gestão
--    (em qualquer data/horário) NÃO usa esta grade — entra direto como
--    agendamento, então não é afetada.
delete from public.visita_disponibilidade
 where data >= current_date
   and bloqueada = false
   and (extract(isodow from data) > 5 or hora not in ('10:00','14:30','16:00','17:30'));

insert into public.visita_disponibilidade (data, hora, capacidade)
select d::date, h::time, 1
from generate_series(current_date, current_date + interval '30 days', interval '1 day') d
cross join (values ('10:00'), ('14:30'), ('16:00'), ('17:30')) as horas(h)
where extract(isodow from d) between 1 and 5   -- segunda(1) … sexta(5)
on conflict (data, hora) do nothing;
