-- ===========================================================================
-- 0104 — MÓDULO OBRA · Fase 6: portal do prestador (construtora).
-- ---------------------------------------------------------------------------
-- Dá ao perfil obra_prestador ESCRITA restrita, sempre server-side/auditada:
--   • submeter BM do mês (RPC obra_submeter_bm — valores calculados no servidor,
--     entra como Pendente);
--   • subir os 4 documentos mensais (RLS insert/update do próprio prestador);
--   • subir entregas de projeto (RPC obra_submeter_entrega) e rodadas BIM (RLS);
--   • ver seu cronograma (disciplinas), status e motivos de reprovação.
-- NADA de financeiro do Contratante (cotações, OCs, ledger, baseline, glosa).
--
-- Notificações: fila obra_notificacoes (BM reprovado via trigger). O ENVIO por
-- e-mail depende de uma Edge Function/provedor (fora deste repo) — a fila e o
-- feed in-app já ficam prontos. Idempotente. Rode após a 0103.
-- ===========================================================================

-- Prestador enxerga o cronograma das disciplinas (prazos/status do que entrega).
drop policy if exists obra_disciplinas_all on public.obra_disciplinas;
drop policy if exists obra_disciplinas_select on public.obra_disciplinas;
create policy obra_disciplinas_select on public.obra_disciplinas for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_disciplinas_write on public.obra_disciplinas;
create policy obra_disciplinas_write on public.obra_disciplinas for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- Documentos mensais: prestador insere/atualiza os do próprio (upsert por mês/tipo).
drop policy if exists obra_docmes_prestador_ins on public.obra_documentos_mensais;
create policy obra_docmes_prestador_ins on public.obra_documentos_mensais for insert to authenticated
  with check (public.app_perfil() = 'obra_prestador');
drop policy if exists obra_docmes_prestador_upd on public.obra_documentos_mensais;
create policy obra_docmes_prestador_upd on public.obra_documentos_mensais for update to authenticated
  using (public.app_perfil() = 'obra_prestador')
  with check (public.app_perfil() = 'obra_prestador');

-- Rodadas BIM: prestador registra (compatibilização é entrega dele).
drop policy if exists obra_bim_prestador_ins on public.obra_bim_rodadas;
create policy obra_bim_prestador_ins on public.obra_bim_rodadas for insert to authenticated
  with check (public.app_perfil() = 'obra_prestador');

-- ── 6.1 · RPC: submeter BM (prestador). Valores calculados NO SERVIDOR. ──────
create or replace function public.obra_submeter_bm(
  p_fase_id uuid,
  p_mes     text,
  p_etapa_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  f          public.obra_fases%rowtype;
  v_perfil   text := public.app_perfil();
  v_preco    numeric := coalesce((select valor::numeric from public.obra_config where chave = 'preco_m2_mo'), 914.66);
  v_ret      numeric := coalesce((select valor::numeric from public.obra_config where chave = 'retencao_mo_pct'), 5);
  v_inss     numeric := coalesce((select percentual from public.obra_aliquotas where chave = 'inss' and ativa), 0);
  v_iss      numeric := coalesce((select percentual from public.obra_aliquotas where chave = 'iss' and ativa), 0);
  v_outras   numeric := coalesce((select sum(percentual) from public.obra_aliquotas where ativa and chave not in ('inss','iss')), 0);
  v_preco_ap numeric;
  v_pct      numeric;
  v_bruto    numeric; v_retv numeric; v_inssv numeric; v_issv numeric; v_outrasv numeric; v_liq numeric;
  v_id       uuid;
  eid        uuid;
begin
  if v_perfil not in ('obra_prestador','master','direcao') then
    raise exception 'Perfil não autorizado a submeter medição.';
  end if;
  select * into f from public.obra_fases where id = p_fase_id;
  if not found then raise exception 'Fase não encontrada.'; end if;
  if f.status <> 'em_andamento' then raise exception 'A fase precisa estar em andamento.'; end if;
  if array_length(p_etapa_ids, 1) is null then raise exception 'Selecione ao menos uma etapa concluída.'; end if;

  -- Valida cada etapa: pertence à fase, está CONCLUÍDA e ainda não foi medida.
  foreach eid in array p_etapa_ids loop
    if not exists (select 1 from public.obra_etapas e where e.id = eid and e.fase_id = p_fase_id) then
      raise exception 'Etapa fora desta fase.';
    end if;
    if coalesce((select c.concluido from public.obra_checklist_execucao c
                 where c.etapa_id = eid order by c.registrado_em desc limit 1), false) = false then
      raise exception 'Há etapa não verificada como concluída.';
    end if;
    if exists (select 1 from public.obra_medicao_etapas me
               join public.obra_medicoes m on m.id = me.medicao_id
               where me.etapa_id = eid and m.status <> 'Reprovado') then
      raise exception 'Há etapa já medida em outro BM.';
    end if;
  end loop;

  v_preco_ap := round(case when f.reajustavel and f.ipca_pct is not null then v_preco * (1 + f.ipca_pct/100) else v_preco end, 2);
  select coalesce(sum(peso_pct), 0) into v_pct from public.obra_etapas where id = any(p_etapa_ids);
  v_bruto  := round((v_pct/100) * f.area_m2 * v_preco_ap, 2);
  v_retv   := round(v_bruto * v_ret/100, 2);
  v_inssv  := round(v_bruto * v_inss/100, 2);
  v_issv   := round(v_bruto * v_iss/100, 2);
  v_outrasv:= round(v_bruto * v_outras/100, 2);
  v_liq    := v_bruto - v_retv - v_inssv - v_issv - v_outrasv;

  insert into public.obra_medicoes
    (fase_id, mes, percentual_medido, preco_m2_aplicado, valor_bruto, retencao_pct, retencao_valor,
     inss_pct, inss_valor, iss_pct, iss_valor, outras_valor, valor_liquido, status, registrado_por)
  values
    (p_fase_id, p_mes, v_pct, v_preco_ap, v_bruto, v_ret, v_retv,
     v_inss, v_inssv, v_iss, v_issv, v_outrasv, v_liq, 'Pendente',
     coalesce(auth.jwt() ->> 'email', 'prestador'))
  returning id into v_id;

  foreach eid in array p_etapa_ids loop
    insert into public.obra_medicao_etapas (medicao_id, etapa_id) values (v_id, eid);
  end loop;
  return v_id;
end;
$$;
grant execute on function public.obra_submeter_bm(uuid, text, uuid[]) to authenticated;

-- ── 6.2 · RPC: submeter entrega de um marco de projeto (prestador) ──────────
create or replace function public.obra_submeter_entrega(p_marco_id uuid, p_arquivo_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare mk public.obra_disciplina_marcos%rowtype;
begin
  if public.app_perfil() not in ('obra_prestador','master','direcao') then
    raise exception 'Perfil não autorizado.';
  end if;
  select * into mk from public.obra_disciplina_marcos where id = p_marco_id;
  if not found then raise exception 'Marco não encontrado.'; end if;
  if not mk.exige_entrega then raise exception 'Este marco (início) não recebe entrega.'; end if;
  if mk.status not in ('Pendente','Reprovado') then
    raise exception 'Marco não está aberto para nova entrega (status: %).', mk.status;
  end if;
  update public.obra_disciplina_marcos
     set entrega_url = p_arquivo_url, status = 'Em análise', motivo = null
   where id = p_marco_id;
end;
$$;
grant execute on function public.obra_submeter_entrega(uuid, text) to authenticated;

-- ── 6.3 · Notificações (fila; e-mail via Edge Function futura) ──────────────
create table if not exists public.obra_notificacoes (
  id              uuid primary key default gen_random_uuid(),
  destinatario    text not null default 'obra_prestador',  -- perfil destino
  tipo            text not null,          -- bm_reprovado / doc_vencendo / marco_proximo
  titulo          text not null,
  corpo           text,
  referencia_id   uuid,
  lida            boolean not null default false,
  criado_em       timestamptz not null default now()
);
comment on table public.obra_notificacoes is
  'Fila de notificações do módulo Obra (feed in-app + base para envio de e-mail por Edge Function). BM reprovado é enfileirado por trigger.';
create index if not exists idx_obra_notif_dest on public.obra_notificacoes (destinatario, lida, criado_em desc);

create or replace function public.fn_obra_notif_bm_reprovado()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if NEW.status = 'Reprovado' and OLD.status is distinct from 'Reprovado' then
    insert into public.obra_notificacoes (destinatario, tipo, titulo, corpo, referencia_id)
    values ('obra_prestador', 'bm_reprovado',
            'Medição ' || NEW.mes || ' reprovada',
            coalesce(NEW.motivo, 'Sem motivo informado.'), NEW.id);
  end if;
  return NEW;
end $$;
drop trigger if exists trg_obra_notif_bm on public.obra_medicoes;
create trigger trg_obra_notif_bm after update on public.obra_medicoes
  for each row execute function public.fn_obra_notif_bm_reprovado();

alter table public.obra_notificacoes enable row level security;
drop policy if exists obra_notif_select on public.obra_notificacoes;
create policy obra_notif_select on public.obra_notificacoes for select to authenticated
  using (public.app_perfil() in ('master','direcao') or public.app_perfil() = destinatario);
drop policy if exists obra_notif_update on public.obra_notificacoes;
create policy obra_notif_update on public.obra_notificacoes for update to authenticated
  using (public.app_perfil() in ('master','direcao') or public.app_perfil() = destinatario)
  with check (public.app_perfil() in ('master','direcao') or public.app_perfil() = destinatario);

-- Fim.
