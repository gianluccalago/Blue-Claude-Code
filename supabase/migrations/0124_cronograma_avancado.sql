-- ===========================================================================
-- 0124 — CRONOGRAMA AVANÇADO (sugestões do engenheiro da TRÍADE).
-- ---------------------------------------------------------------------------
-- a) PREDECESSORAS: obra_disciplinas.predecessora_id — amarra atividades;
--    o Gantt empurra automaticamente o início quando a predecessora termina
--    depois da data-base (agendamento automático) e desenha o vínculo.
-- b) LINHA DE BASE: baseline_inicio/baseline_fim — snapshot do plano para
--    medir desvios (barra cinza sob a barra atual; desvio em dias na
--    tabela de controle). Semeada com o plano vigente; master/direção pode
--    recapturar ("Redefinir linha de base").
-- c) RECURSOS: obra_disciplinas.recursos — equipe/recursos humanos da
--    atividade (texto livre, ex.: "2 projetistas"), agregada no resumo de
--    recursos da tabela de controle.
-- Sem mudança de RLS: prestador já LÊ obra_disciplinas (0114) — nada de
-- custos nossos é exposto (valores exibidos são os do contrato DELES).
-- Idempotente. Rode após a 0123.
-- ===========================================================================

alter table public.obra_disciplinas
  add column if not exists predecessora_id uuid references public.obra_disciplinas(id) on delete set null,
  add column if not exists baseline_inicio date,
  add column if not exists baseline_fim date,
  add column if not exists recursos text;

comment on column public.obra_disciplinas.predecessora_id is
  'Atividade que precisa terminar antes desta começar — o cronograma empurra o início automaticamente.';
comment on column public.obra_disciplinas.baseline_inicio is
  'Linha de base (plano congelado) — início. Desvios são medidos contra ela.';

-- Linha de base inicial = plano vigente (só onde ainda não existe).
update public.obra_disciplinas
   set baseline_inicio = data_base,
       baseline_fim    = case when prazo_dias is not null then data_base + prazo_dias else null end
 where baseline_inicio is null and data_base is not null;

-- Fim.
