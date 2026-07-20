-- ===========================================================================
-- 0112 — MÓDULO OBRA · Cronograma REAL de projetos (TRÍADE, 16/07/26–18/04/27).
-- ---------------------------------------------------------------------------
-- Substitui as disciplinas genéricas do Anexo III (seed da 0099/0101) pelo
-- cronograma físico-financeiro ENTREGUE pela construtora:
--   · 21 atividades PAGAS somando exatamente R$ 500.000 (integra o total do
--     contrato — 0111), cada uma com início (data_base), duração (prazo_dias)
--     e marcos de pagamento reais: ENTRADA 50% na data de início + R00 25% na
--     entrega + R01 25%. Sondagem: entrega única de 100% (já 100% concluída).
--   · 10 itens SEM desembolso do cronograma físico (IFC arquitetônico,
--     estudos de tráfego/elevadores, HVAC e luminotécnico por módulo) —
--     entram com valor 0 e sem marcos, só para a linha do tempo.
-- Fonte: "Cronograma de Projetos_ Financeiro.xlsx" + "Cronograma Físico_
-- Desenvolvimento de Projetos.pdf". Divergência corrigida: Hidrossanitário
-- Módulos 1 e 2 = 12/10/26 (PDF); o Excel trazia 12/10/27 (erro de digitação —
-- estouraria a data final de 18/04/27).
-- Idempotente (sentinela). ABORTA se houver marco PAGO (não reescreve dinheiro).
-- Rode após a 0111.
-- ===========================================================================

do $$
declare
  r record;
  v_id uuid;
begin
  -- Sentinela: já semeado? (nome exato do cronograma real)
  if exists (select 1 from public.obra_disciplinas where nome = 'Sondagem SPT + Laudo Geotécnico') then
    raise notice 'Cronograma TRÍADE já semeado — nada a fazer.';
    return;
  end if;
  -- Segurança: não substitui se já houve pagamento nas disciplinas atuais.
  if exists (select 1 from public.obra_disciplina_marcos where status = 'Pago') then
    raise exception 'Há marcos PAGOS nas disciplinas atuais — substituição abortada. Trate manualmente.';
  end if;

  delete from public.obra_disciplinas;  -- marcos caem por cascade

  -- ── Atividades PAGAS (entrada 50% + R00 25% + R01 25%) ────────────────────
  for r in
    select * from (values
      ( 2, 'Projeto de Terraplanagem Geral',                                          20000.00, 45, date '2026-07-27'),
      ( 3, 'Projeto Estrutural - Módulo 5',                                           19760.00, 45, date '2026-07-31'),
      ( 4, 'Projeto PPCI Completo',                                                   55000.00, 45, date '2026-07-31'),
      ( 5, 'Projeto de Acessibilidade Completo - Validação NBR 9050',                  8500.00, 30, date '2026-07-31'),
      ( 6, 'PBA Vigilância Sanitária - Completo',                                     15800.00, 90, date '2026-07-31'),
      ( 7, 'PGRSS Completo',                                                           3500.00, 45, date '2026-08-03'),
      ( 8, 'Projeto Elétrico Completo',                                               65000.00, 90, date '2026-08-03'),
      ( 9, 'Projeto Hidrossanitário e Pluvial - Módulo 5',                            16000.00, 20, date '2026-08-03'),
      (10, 'Projeto de Instalações de Tecnologia e Segurança Eletrônica - Módulo 5',  50000.00, 60, date '2026-08-03'),
      (11, 'Projeto Hidrossanitário e Pluvial - Módulos 3 e 4',                       32000.00, 30, date '2026-08-31'),
      (12, 'Projeto de Contenções',                                                   12000.00, 45, date '2026-10-02'),
      (13, 'Projeto de Fundações - Módulo 5',                                          7400.00, 20, date '2026-10-02'),
      (14, 'Protocolos de Licenciamento Ambiental e Movimentação de Terra',            4200.00, 45, date '2026-10-02'),
      (15, 'Projeto Hidrossanitário e Pluvial - Módulos 1 e 2',                       32000.00, 30, date '2026-10-12'),
      (16, 'Projeto Estrutural - Módulos 3 e 4',                                      39520.00, 30, date '2026-10-30'),
      (17, 'Projeto de Impermeabilização de Elementos',                               20000.00, 30, date '2026-12-04'),
      (18, 'Projeto de Fundações - Módulos 3 e 4',                                    14800.00, 20, date '2026-12-11'),
      (19, 'Projeto Estrutural - Módulos 1 e 2',                                      39520.00, 30, date '2027-01-08'),
      (20, 'Projeto de Fundações - Módulos 1 e 2',                                    14800.00, 20, date '2027-02-19'),
      (21, 'Compatibilização BIM Total',                                              23400.00, 30, date '2027-03-19')
    ) as t(ordem, nome, valor, prazo, base)
  loop
    insert into public.obra_disciplinas (ordem, nome, valor, prazo_dias, revisoes_max, data_base, observacao)
    values (r.ordem, r.nome, r.valor, r.prazo, 2, r.base,
            'Cronograma TRÍADE: entrada 50% no início (' || to_char(r.base, 'DD/MM/YY') || ') + R00 25% + R01 25%.')
    returning id into v_id;

    insert into public.obra_disciplina_marcos (disciplina_id, ordem, chave, rotulo, percentual, valor, exige_entrega) values
      (v_id, 1, 'inicio', 'Entrada (50%)', 50, round(r.valor * 0.50, 2), false),
      (v_id, 2, 'r00',    'R00 (25%)',     25, round(r.valor * 0.25, 2), true),
      (v_id, 3, 'r01',    'R01 (25%)',     25, round(r.valor * 0.25, 2), true);
  end loop;

  -- ── Sondagem: entrega única de 100% — já concluída (progresso 100%) ───────
  insert into public.obra_disciplinas (ordem, nome, valor, prazo_dias, revisoes_max, data_base, status, data_conclusao, observacao)
  values (1, 'Sondagem SPT + Laudo Geotécnico', 6800.00, 6, 0, date '2026-07-16', 'Concluído', date '2026-07-22',
          'Cronograma TRÍADE: pagamento único de 100% na entrega. Concluída (progresso 100% no cronograma).')
  returning id into v_id;
  insert into public.obra_disciplina_marcos (disciplina_id, ordem, chave, rotulo, percentual, valor, exige_entrega)
  values (v_id, 1, 'entrega', 'Entrega única (100%)', 100, 6800.00, true);

  -- ── Itens SEM desembolso (só cronograma físico / linha do tempo) ──────────
  for r in
    select * from (values
      (31, 'Conclusão Modelo IFC Arquitetônico',                       10, date '2026-07-20'),
      (32, 'Estudo de Tráfego e Demanda de Elevadores - Módulo 5',     10, date '2026-08-03'),
      (33, 'Estudo de Tráfego e Demanda de Elevadores - Módulos 3 e 4',20, date '2026-08-17'),
      (34, 'Estudo de Tráfego e Demanda de Elevadores - Módulos 1 e 2',20, date '2026-09-14'),
      (35, 'Projeto de Instalações HVAC e Exaustão - Módulo 5',        30, date '2026-08-03'),
      (36, 'Projeto Luminotécnico - Módulo 5',                         45, date '2026-08-03'),
      (37, 'Projeto de Instalações HVAC e Exaustão - Módulos 3 e 4',   30, date '2026-09-14'),
      (38, 'Projeto Luminotécnico - Módulos 3 e 4',                    30, date '2026-10-05'),
      (39, 'Projeto de Instalações HVAC e Exaustão - Módulos 1 e 2',   30, date '2026-10-26'),
      (40, 'Projeto Luminotécnico - Módulos 1 e 2',                    30, date '2026-11-16')
    ) as t(ordem, nome, prazo, base)
  loop
    insert into public.obra_disciplinas (ordem, nome, valor, prazo_dias, revisoes_max, data_base, observacao)
    values (r.ordem, r.nome, 0, r.prazo, 0, r.base, 'Sem desembolso direto — item do cronograma físico (acompanhamento).');
  end loop;

  raise notice 'Cronograma TRÍADE semeado: 21 atividades pagas (R$ 500.000) + 10 itens físicos.';
end $$;

-- ── Gate de pagamento ajustado ao contrato real ─────────────────────────────
-- A ENTRADA (50%) vence na DATA DE INÍCIO — antes de existir entrega/ART.
-- ART passa a ser exigida só nos marcos com entrega (R00/R01/entrega única).
create or replace function public.obra_pagar_marco(p_marco_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  mk record;
  d  record;
  n_marcos int;
  n_pagos  int;
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Perfil não autorizado a pagar marcos de projeto.';
  end if;
  select * into mk from public.obra_disciplina_marcos where id = p_marco_id;
  if not found then raise exception 'Marco não encontrado.'; end if;
  select * into d from public.obra_disciplinas where id = mk.disciplina_id;

  if mk.status <> 'Aprovado' then
    raise exception 'O marco precisa estar Aprovado antes do pagamento (status: %).', mk.status;
  end if;
  if mk.exige_entrega and coalesce(d.art_url, '') = '' then
    raise exception 'Anexe a ART da disciplina "%" antes de pagar este marco de entrega.', d.nome;
  end if;
  if mk.chave = 'retido' and not exists (
    select 1 from public.obra_bim_rodadas where final and coalesce(ifc_url,'') <> ''
  ) then
    raise exception 'O valor retido só é liberado após a compatibilização final do BIM (rodada final com IFC).';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('obra_marco:' || d.id::text, 0));
  update public.obra_disciplina_marcos
     set status = 'Pago', data_pagamento = current_date
   where id = p_marco_id;

  select count(*), count(*) filter (where status = 'Pago')
    into n_marcos, n_pagos
  from public.obra_disciplina_marcos where disciplina_id = d.id;
  if n_marcos = n_pagos then
    update public.obra_disciplinas
       set status = 'Concluído', data_conclusao = coalesce(data_conclusao, current_date)
     where id = d.id;
  end if;
end;
$$;
grant execute on function public.obra_pagar_marco(uuid) to authenticated;

-- Fim.
