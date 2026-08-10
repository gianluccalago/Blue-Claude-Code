-- ===========================================================================
-- 0125 — A CONSTRUTORA PLANEJA (edição do cronograma pelos dois lados).
-- ---------------------------------------------------------------------------
-- O engenheiro precisa amarrar atividades, ajustar datas/duração, informar a
-- equipe e o avanço SEM depender do Contratante. Como o RLS é por LINHA (não
-- por coluna), dar UPDATE direto na obra_disciplinas exporia valor, status e
-- marcos de pagamento. A RPC abaixo é o caminho seguro: SECURITY DEFINER,
-- valida o perfil e atualiza SOMENTE os campos de PLANEJAMENTO.
--   Editável por master/direção/obra_prestador:
--     data_base · prazo_dias · predecessora_id · recursos · progresso_pct
--   NUNCA tocado aqui: valor, marcos, ART, revisões, linha de base.
-- Mantém a regra de ouro do módulo: progresso 100% ⇒ Concluído + data;
-- abaixo de 100% saindo de Concluído ⇒ volta a Aprovado (sem "concluída
-- com 50%"). Ciclo de predecessora (A→B→A) é recusado.
-- Idempotente. Rode após a 0124.
-- ===========================================================================

create or replace function public.obra_planejar_atividade(
  p_id             uuid,
  p_data_base      date    default null,
  p_prazo_dias     int     default null,
  p_predecessora   uuid    default null,
  p_recursos       text    default null,
  p_progresso      int     default null,
  p_limpar_pred    boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil text := public.app_perfil();
  v_atual  record;
  v_cursor uuid;
  v_saltos int := 0;
begin
  if v_perfil not in ('master','direcao','obra_prestador') then
    raise exception 'Perfil sem permissão para planejar atividades.';
  end if;

  select * into v_atual from public.obra_disciplinas where id = p_id;
  if not found then raise exception 'Atividade não encontrada.'; end if;

  -- Predecessora: sem auto-referência e sem ciclo na cadeia.
  if p_predecessora is not null then
    if p_predecessora = p_id then
      raise exception 'Uma atividade não pode ser predecessora de si mesma.';
    end if;
    v_cursor := p_predecessora;
    while v_cursor is not null and v_saltos < 100 loop
      if v_cursor = p_id then
        raise exception 'Amarração circular: esta atividade já depende da escolhida.';
      end if;
      select predecessora_id into v_cursor from public.obra_disciplinas where id = v_cursor;
      v_saltos := v_saltos + 1;
    end loop;
  end if;

  update public.obra_disciplinas
     set data_base       = coalesce(p_data_base, data_base),
         prazo_dias      = coalesce(p_prazo_dias, prazo_dias),
         predecessora_id = case when p_limpar_pred then null
                                else coalesce(p_predecessora, predecessora_id) end,
         recursos        = coalesce(nullif(btrim(p_recursos), ''), recursos),
         progresso_pct   = coalesce(least(100, greatest(0, p_progresso)), progresso_pct),
         -- Sincronia progresso ⇄ status (regra do módulo).
         status          = case
                             when p_progresso is null then status
                             when p_progresso >= 100 then 'Concluído'
                             when status = 'Concluído' then 'Aprovado'
                             else status
                           end,
         data_conclusao  = case
                             when p_progresso is null then data_conclusao
                             when p_progresso >= 100 then coalesce(data_conclusao, current_date)
                             else null
                           end
   where id = p_id;

  -- Histórico do avanço (mesma trilha do apontamento semanal).
  if p_progresso is not null and p_progresso is distinct from v_atual.progresso_pct then
    insert into public.obra_disciplina_progresso (disciplina_id, progresso_pct, observacao, registrado_por)
    values (p_id, least(100, greatest(0, p_progresso)),
            case when v_perfil = 'obra_prestador' then 'Apontado pela construtora' else null end,
            null);
  end if;
end;
$$;

comment on function public.obra_planejar_atividade is
  'Planejamento da atividade (datas, duração, predecessora, equipe, avanço) por master/direção/construtora. Não altera valores, marcos nem linha de base.';

-- Fim.
