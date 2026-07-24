-- ===========================================================================
-- 0115 — MÓDULO OBRA · Contrato assinado (27/07/26) + repositório de arquivos.
-- ---------------------------------------------------------------------------
-- A) Parâmetros que o contrato ASSINADO acrescenta (as demais cláusulas já
--    batem com o módulo: R$914,66/m², áreas, 500k 50/25/25, multa fase
--    0,05%/d teto 5%, bônus 1%/30d teto 2%, multa projeto 0,15%/d teto 10%,
--    retenção 5% com 50% TRP/50% TRD, reposição 3%, consumíveis 1,5%, IPCA
--    assinatura→início da fase):
--    · 4.7.1  Taxa de administração de 5% sobre a terraplenagem medida/paga
--             (fiscalização dedicada — única exceção de fornecedor direto);
--    · 6.4    Indenização por desmobilização: R$2.000/evento (>5 dias úteis
--             parado por falta de material, 1×/frente/30d);
--    · 14.3.1 Multa por ocorrência: R$3.000;
--    · 8.1.2  Pagamento do BM em até 15 dias corridos após a aprovação
--             (o front passa a projetar o vencimento assim).
-- B) Obrigações da TRÍADE a cobrar (semeadas em insumos críticos):
--    · 5.5   Cronograma Executivo (MS Project) do Módulo 5 em 15 dias da
--            assinatura → prazo 11/08/26; demais fases 60 dias antes;
--    · 8.2.2 Seguro-garantia/fiança de 5% da fase (condição da 1ª medição);
--    · 11.x  Apólices (risco engenharia, RC ≥ R$200 mil, vida em grupo).
-- C) obra_arquivos: repositório interno do empreendimento — contrato
--    assinado, DWG/PDF de projetos (por atividade) e arquivos gerais.
--    master/direção apenas (privado; storage no bucket obra, pasta arquivos/,
--    que o prestador NÃO lê — política da 0106 continua valendo).
-- Idempotente. Rode após a 0114.
-- ===========================================================================

-- ── A · Parâmetros do contrato assinado ─────────────────────────────────────
insert into public.obra_config (chave, valor, descricao) values
  ('data_assinatura_contrato',      '2026-07-27', 'Data de assinatura do contrato TRÍADE (base do IPCA das fases 2–4).'),
  ('taxa_adm_terraplenagem_pct',    '5',    'Cláusula 4.7.1: taxa de administração sobre o valor medido/pago da terraplenagem (fornecedor direto).'),
  ('prazo_pagamento_bm_dias',       '15',   'Cláusula 8.1.2: pagamento do BM em até 15 dias corridos após a aprovação.'),
  ('indenizacao_desmobilizacao',    '2000', 'Cláusula 6.4: R$/evento por frente parada >5 dias úteis por falta de material (1×/frente/30d).'),
  ('multa_ocorrencia',              '3000', 'Cláusula 14.3.1: multa por ocorrência (EPI, documentação >15d etc.).')
on conflict (chave) do nothing;

-- ── B · Obrigações da TRÍADE a cobrar (aparecem no painel/cronograma) ───────
insert into public.obra_insumos_criticos (nome, dependencia, responsavel, prazo_limite, status)
select v.nome, v.dependencia, v.responsavel, v.prazo, 'pendente'
from (values
  ('Cronograma Executivo (MS Project) — Módulo 5',
   'Cláusula 5.5: entrega em 15 dias da assinatura; demais fases 60 dias antes do início.',
   'TRÍADE', date '2026-08-11'),
  ('Seguro-garantia / fiança de 5% da fase',
   'Cláusula 8.2.2: condição para o pagamento da 1ª medição de cada fase; recompor em 10 dias úteis se utilizada.',
   'TRÍADE', null),
  ('Apólices de seguro (risco engenharia · RC ≥ R$200 mil · vida em grupo)',
   'Cláusula 11: manter vigentes durante toda a obra (Anexo VII).',
   'TRÍADE', null)
) as v(nome, dependencia, responsavel, prazo)
where not exists (select 1 from public.obra_insumos_criticos i where i.nome = v.nome);

-- ── C · Repositório de arquivos do empreendimento ───────────────────────────
create table if not exists public.obra_arquivos (
  id             uuid primary key default gen_random_uuid(),
  categoria      text not null check (categoria in ('contrato','projeto','geral')),
  disciplina_id  uuid references public.obra_disciplinas(id) on delete set null,
  nome           text not null,               -- nome de exibição (ex.: "Contrato assinado 27/07/26")
  arquivo_url    text not null,               -- caminho no bucket obra (pasta arquivos/)
  observacao     text,
  registrado_por text,
  criado_em      timestamptz not null default now()
);
comment on table public.obra_arquivos is
  'Repositório interno do empreendimento: contrato assinado, DWG/PDF de projetos (por atividade) e arquivos gerais. master/direção.';
create index if not exists idx_obra_arquivos_disc on public.obra_arquivos (disciplina_id);
create index if not exists idx_obra_arquivos_cat on public.obra_arquivos (categoria);

drop trigger if exists trg_audit_obra_arquivos on public.obra_arquivos;
create trigger trg_audit_obra_arquivos after insert or update or delete on public.obra_arquivos
  for each row execute function public.fn_obra_audit();

alter table public.obra_arquivos enable row level security;
drop policy if exists obra_arquivos_all on public.obra_arquivos;
create policy obra_arquivos_all on public.obra_arquivos for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- Fim.
