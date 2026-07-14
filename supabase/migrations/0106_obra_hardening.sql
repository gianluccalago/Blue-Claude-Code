-- ===========================================================================
-- 0106 — MÓDULO OBRA · Hardening (auditoria de segurança pós-Fase 7).
-- ---------------------------------------------------------------------------
-- Corrige os furos apontados na auditoria de RLS/RPC:
--  1. [MÉDIA→ALTA] Storage: o prestador lia/listava TODO o bucket `obra`
--     (inclusive PDFs de aditivos, apólices e laudos que o RLS de tabela
--     esconde dele). Agora o SELECT/INSERT do prestador é escopado por
--     PREFIXO DE PASTA — só as categorias que são dele:
--       checklist/ (fotos de vistoria), documentos/ (guias mensais),
--       entregas/ (marcos de projeto), bim/ (rodadas), nf/ (as próprias NFs).
--     Pastas exclusivas do Contratante (aditivos/, documentos-obra/, ensaios/,
--     diario/, nc/, recebimentos/, art/) ficam ocultas ao prestador.
--  2. [MÉDIA] BIM: o prestador podia inserir rodada `final=true` com IFC e
--     anular o gate do marco Retido (10%). Agora o prestador só insere rodadas
--     NÃO-finais; a rodada final (que destrava o Retido) é ato do master/direção
--     após conferir a compatibilização.
--  3. [BAIXA] TOCTOU: NC aberta ENTRE a aprovação e o pagamento da medição não
--     era reavaliada. obra_pagar_medicao agora repete a checagem de NC.
--
-- Idempotente. Rode após a 0105.
-- ===========================================================================

-- ── 1 · Storage escopado por prefixo de pasta ───────────────────────────────
drop policy if exists obra_storage_select on storage.objects;
create policy obra_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'obra' and (
      public.app_perfil() in ('master','direcao')
      or (
        public.app_perfil() = 'obra_prestador'
        and (storage.foldername(name))[1] in ('checklist','documentos','entregas','bim','nf')
      )
    )
  );

drop policy if exists obra_storage_insert on storage.objects;
create policy obra_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'obra' and (
      public.app_perfil() in ('master','direcao')
      or (
        public.app_perfil() = 'obra_prestador'
        and (storage.foldername(name))[1] in ('documentos','entregas','bim')
      )
    )
  );
-- (update/delete seguem master/direção — 0099; o prestador não sobrescreve nada)

-- ── 2 · BIM: prestador só registra rodadas NÃO-finais ───────────────────────
drop policy if exists obra_bim_prestador_ins on public.obra_bim_rodadas;
create policy obra_bim_prestador_ins on public.obra_bim_rodadas for insert to authenticated
  with check (public.app_perfil() = 'obra_prestador' and final = false);

-- ── 3 · Pagar medição reavalia NC aberta (fecha o TOCTOU) ───────────────────
create or replace function public.obra_pagar_medicao(p_medicao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m       public.obra_medicoes%rowtype;
  n_docs  int;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a aprovar pagamentos.';
  end if;

  select * into m from public.obra_medicoes where id = p_medicao_id;
  if not found then raise exception 'Medição não encontrada.'; end if;
  if m.status <> 'Aprovado' then
    raise exception 'A medição precisa estar Aprovada antes do pagamento (status atual: %).', m.status;
  end if;
  if coalesce(m.nf_url, '') = '' then
    raise exception 'Anexe a NF da medição antes de aprovar o pagamento.';
  end if;

  -- GATE: os 4 documentos mensais do mês da medição.
  select count(distinct tipo) into n_docs
  from public.obra_documentos_mensais where mes = m.mes;
  if n_docs < 4 then
    raise exception 'Faltam documentos do mês % (INSS, FGTS, ISS e folha) — % de 4 anexados.', m.mes, n_docs;
  end if;

  -- GATE (hardening): NC aberta em etapa desta medição bloqueia o pagamento,
  -- mesmo que tenha sido aberta DEPOIS da aprovação.
  if exists (
    select 1
    from public.obra_medicao_etapas me
    join public.obra_nao_conformidades nc on nc.etapa_id = me.etapa_id
    where me.medicao_id = p_medicao_id and nc.status <> 'encerrada'
  ) then
    raise exception 'Há não-conformidade aberta em etapa desta medição — encerre a NC antes de pagar.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('obra_ledger:' || m.fase_id::text, 0));
  update public.obra_medicoes
     set status = 'Pago', data_pagamento = current_date
   where id = p_medicao_id;
  insert into public.obra_retencoes_ledger (fase_id, medicao_id, tipo, valor, observacao, registrado_por)
  values (m.fase_id, m.id, 'retido', m.retencao_valor,
          'Retenção 5% da medição ' || m.mes, public.app_perfil());
end;
$$;
grant execute on function public.obra_pagar_medicao(uuid) to authenticated;

-- Fim.
