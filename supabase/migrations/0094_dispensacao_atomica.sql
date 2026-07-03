-- ===========================================================================
-- 0094 — Dispensação ATÔMICA e IDEMPOTENTE (auditoria, REQUER DECISÃO #3).
-- ---------------------------------------------------------------------------
-- Antes o app fazia: insert da dispensação + N updates de estoque, SEM transação
-- e SEM guarda de duplicidade. Dupla confirmação (duplo clique/reenvio) gravava
-- dois registros e decrementava o estoque duas vezes; e uma falha no meio deixava
-- registro sem baixa (ou vice-versa).
--
-- Estas funções fazem tudo numa ÚNICA transação (função = transação):
--   • dispensar_medicamentos: trava por (hóspede, período, dia) com advisory
--     lock; se já existe dispensação nesse período/dia, NÃO duplica (idempotente);
--     senão insere e dá baixa no estoque do mês.
--   • estornar_dispensacao: estorna o saldo e remove o registro, atômico.
--
-- SECURITY INVOKER (padrão): a RLS de dispensacao/estoque_hospede continua
-- valendo (só a equipe escreve). Idempotente. Rode depois da 0018/0016.
-- ===========================================================================

create or replace function public.dispensar_medicamentos(
  p_residente_id uuid,
  p_periodo      text,
  p_data         date,
  p_itens        jsonb,
  p_dispensado_por text
) returns uuid
language plpgsql
as $$
declare
  v_id   uuid;
  v_item jsonb;
  v_mes  text := to_char(p_data, 'YYYY-MM');
begin
  -- Serializa concorrentes do mesmo (hóspede, período, dia) até o fim da transação.
  perform pg_advisory_xact_lock(
    hashtextextended(p_residente_id::text || '|' || p_periodo || '|' || p_data::text, 0));

  -- Idempotência: já existe dispensação desse período/dia? Não duplica.
  select id into v_id
  from public.dispensacao
  where residente_id = p_residente_id and periodo = p_periodo and data = p_data
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.dispensacao (residente_id, periodo, data, itens, dispensado_por)
  values (p_residente_id, p_periodo, p_data, p_itens, p_dispensado_por)
  returning id into v_id;

  -- Baixa de estoque de cada item (mesma transação).
  for v_item in select * from jsonb_array_elements(p_itens) loop
    update public.estoque_hospede
       set quantidade_atual = quantidade_atual - coalesce((v_item->>'quantidade')::numeric, 0)
     where residente_id = p_residente_id
       and medicamento  = (v_item->>'medicamento')
       and mes_referencia = v_mes;
  end loop;

  return v_id;
end $$;

create or replace function public.estornar_dispensacao(p_id uuid)
returns void
language plpgsql
as $$
declare
  v_rec  public.dispensacao%rowtype;
  v_item jsonb;
  v_mes  text;
begin
  select * into v_rec from public.dispensacao where id = p_id;
  if not found then
    return; -- já removida (idempotente)
  end if;
  v_mes := to_char(v_rec.data, 'YYYY-MM');

  for v_item in select * from jsonb_array_elements(v_rec.itens) loop
    update public.estoque_hospede
       set quantidade_atual = quantidade_atual + coalesce((v_item->>'quantidade')::numeric, 0)
     where residente_id = v_rec.residente_id
       and medicamento  = (v_item->>'medicamento')
       and mes_referencia = v_mes;
  end loop;

  delete from public.dispensacao where id = p_id;
end $$;

grant execute on function public.dispensar_medicamentos(uuid, text, date, jsonb, text) to authenticated;
grant execute on function public.estornar_dispensacao(uuid) to authenticated;

-- Fim.
