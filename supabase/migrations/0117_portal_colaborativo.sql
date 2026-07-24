-- ===========================================================================
-- 0117 — MÓDULO OBRA · Portal COLABORATIVO da construtora.
-- ---------------------------------------------------------------------------
-- O portal deixa de ser vitrine e vira canal de trabalho em parceria:
-- A) PEDIDOS DE INSUMOS (o mais importante): a TRÍADE solicita materiais com
--    DATA NECESSÁRIA (cláusula 6.1 — planejamento com 45/60 dias); nós
--    respondemos com DATA PROMETIDA e status (programado/comprado/negado);
--    ela marca o RECEBIMENTO em obra e dá BAIXA DE USO (obra_consumo), que
--    alimenta nosso controle de perdas/glosa automaticamente.
--    → obra_planejamento_materiais ganha origem/status/datas/resposta e o
--      prestador volta a LER + passa a INSERIR e ATUALIZAR (sem preços:
--      cotações/OCs/recebimentos continuam só master/direção).
-- B) FOTOS DE ANDAMENTO: a TRÍADE anexa fotos do canteiro (com fase e
--    descrição) — visíveis na nossa Central e no portal dela.
-- C) SOLICITAÇÕES GERAIS: pedidos avulsos (medição antecipada, acordo,
--    dúvida) com resposta nossa registrada.
-- D) Adicional acordado visível: "Supervisão da terraplanagem (taxa adm. 5%)"
--    entra como atividade sem valor fixo (cláusula 4.7.1).
-- Idempotente. Rode após a 0116.
-- ===========================================================================

-- ── A · Pedidos de insumos (planejamento vira canal bidirecional) ───────────
alter table public.obra_planejamento_materiais
  add column if not exists origem text not null default 'contratante'
    check (origem in ('contratante','prestador')),
  add column if not exists status_atendimento text not null default 'programado'
    check (status_atendimento in ('solicitado','programado','comprado','entregue','negado')),
  add column if not exists data_prometida date,
  add column if not exists data_entrega date,
  add column if not exists resposta text;

comment on column public.obra_planejamento_materiais.status_atendimento is
  'Ciclo do pedido: solicitado (TRÍADE pediu) → programado/comprado (nossa resposta, com data_prometida) → entregue (recebido em obra) | negado.';

-- Prestador LÊ os pedidos (sem preços — preços vivem em cotações/OCs, fechadas),
-- CRIA pedidos e ATUALIZA (marcar recebido). Master/direção seguem com tudo.
drop policy if exists obra_planmat_select on public.obra_planejamento_materiais;
create policy obra_planmat_select on public.obra_planejamento_materiais for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_planmat_prestador_ins on public.obra_planejamento_materiais;
create policy obra_planmat_prestador_ins on public.obra_planejamento_materiais for insert to authenticated
  with check (public.app_perfil() = 'obra_prestador');
drop policy if exists obra_planmat_prestador_upd on public.obra_planejamento_materiais;
create policy obra_planmat_prestador_upd on public.obra_planejamento_materiais for update to authenticated
  using (public.app_perfil() = 'obra_prestador')
  with check (public.app_perfil() = 'obra_prestador');

-- Baixa de uso: prestador lê e lança consumo (alimenta perdas/glosa).
drop policy if exists obra_consumo_prestador_sel on public.obra_consumo;
create policy obra_consumo_prestador_sel on public.obra_consumo for select to authenticated
  using (public.app_perfil() = 'obra_prestador');
drop policy if exists obra_consumo_prestador_ins on public.obra_consumo;
create policy obra_consumo_prestador_ins on public.obra_consumo for insert to authenticated
  with check (public.app_perfil() = 'obra_prestador');

-- ── B · Fotos de andamento do canteiro ──────────────────────────────────────
create table if not exists public.obra_fotos_andamento (
  id             uuid primary key default gen_random_uuid(),
  fase_id        uuid references public.obra_fases(id) on delete set null,
  descricao      text,
  foto_url       text not null,              -- bucket obra, pasta andamento/
  registrado_por text,
  criado_em      timestamptz not null default now()
);
comment on table public.obra_fotos_andamento is
  'Fotos do andamento do canteiro anexadas pela construtora (ou por nós). Visíveis dos dois lados.';
create index if not exists idx_obra_fotos_and on public.obra_fotos_andamento (criado_em desc);

drop trigger if exists trg_audit_obra_fotos_andamento on public.obra_fotos_andamento;
create trigger trg_audit_obra_fotos_andamento
  after insert or update or delete on public.obra_fotos_andamento
  for each row execute function public.fn_obra_audit();

alter table public.obra_fotos_andamento enable row level security;
drop policy if exists obra_fotos_and_sel on public.obra_fotos_andamento;
create policy obra_fotos_and_sel on public.obra_fotos_andamento for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_fotos_and_ins on public.obra_fotos_andamento;
create policy obra_fotos_and_ins on public.obra_fotos_andamento for insert to authenticated
  with check (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_fotos_and_del on public.obra_fotos_andamento;
create policy obra_fotos_and_del on public.obra_fotos_andamento for delete to authenticated
  using (public.app_perfil() in ('master','direcao'));

-- Storage: pasta andamento/ liberada para o prestador (ler + subir).
drop policy if exists obra_storage_select on storage.objects;
create policy obra_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'obra' and (
      public.app_perfil() in ('master','direcao')
      or (
        public.app_perfil() = 'obra_prestador'
        and (storage.foldername(name))[1] in ('checklist','documentos','entregas','bim','nf','andamento')
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
        and (storage.foldername(name))[1] in ('documentos','entregas','bim','andamento')
      )
    )
  );

-- ── C · Solicitações gerais da construtora ──────────────────────────────────
create table if not exists public.obra_solicitacoes (
  id             uuid primary key default gen_random_uuid(),
  tipo           text not null default 'geral' check (tipo in ('insumo','medicao','geral')),
  titulo         text not null,
  descricao      text,
  data_desejada  date,
  status         text not null default 'aberta' check (status in ('aberta','em_atendimento','concluida','negada')),
  resposta       text,
  respondido_por text,
  respondido_em  timestamptz,
  registrado_por text,
  criado_em      timestamptz not null default now()
);
comment on table public.obra_solicitacoes is
  'Solicitações da construtora ao Contratante (medição antecipada, acordos, pedidos gerais) com resposta registrada.';
create index if not exists idx_obra_solic_status on public.obra_solicitacoes (status, criado_em desc);

drop trigger if exists trg_audit_obra_solicitacoes on public.obra_solicitacoes;
create trigger trg_audit_obra_solicitacoes
  after insert or update or delete on public.obra_solicitacoes
  for each row execute function public.fn_obra_audit();

alter table public.obra_solicitacoes enable row level security;
drop policy if exists obra_solic_sel on public.obra_solicitacoes;
create policy obra_solic_sel on public.obra_solicitacoes for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_solic_ins on public.obra_solicitacoes;
create policy obra_solic_ins on public.obra_solicitacoes for insert to authenticated
  with check (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_solic_upd on public.obra_solicitacoes;
create policy obra_solic_upd on public.obra_solicitacoes for update to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

-- ── D · Adicional acordado: supervisão da terraplanagem (cláusula 4.7.1) ────
insert into public.obra_disciplinas (ordem, nome, valor, prazo_dias, revisoes_max, observacao)
select 41, 'Supervisão da terraplanagem — taxa de administração 5% (cláusula 4.7.1)', 0, null, 0,
       'Adicional acordado: 5% sobre o valor efetivamente medido e pago ao executor da terraplanagem, pago junto às medições correspondentes. Sem valor fixo.'
where not exists (
  select 1 from public.obra_disciplinas
  where nome like 'Supervisão da terraplanagem%'
);

-- Fim.
