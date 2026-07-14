-- ===========================================================================
-- 0099 — MÓDULO OBRA · Fase 0 (fundação) + Fase 1 (etapas verificáveis)
-- ---------------------------------------------------------------------------
-- Acompanhamento da construção da ILPI (13.688,56 m², Curitiba, construtora
-- TRÍADE, empreitada por medida R$ 914,66/m² + projetos R$ 500.000 global).
-- Princípio: NENHUM percentual subjetivo — avanço físico = etapas BINÁRIAS
-- verificáveis in loco (concluído sim/não + foto obrigatória); o financeiro é
-- consequência aritmética dos pesos das etapas concluídas.
--
-- Fase 0: papel obra_prestador, feature flag, auditoria, bucket, RLS, seeds
--         dos dados FIXOS do contrato (fases, disciplinas, alíquotas,
--         tolerâncias, parâmetros).
-- Fase 1: obra_fases / obra_etapas (curva de pesos padrão, editável pelo
--         master ANTES da 1ª medição da fase — trava chega com a Fase 2) /
--         obra_checklist_execucao (verificação binária + foto).
--
-- Zero acoplamento com tabelas assistenciais (nenhuma FK cruzada; usuários
-- via `usuarios`/app_perfil() já existentes). Idempotente. Rode após a 0098.
-- ===========================================================================

-- ── 0.1 · Papel obra_prestador (construtora) ────────────────────────────────
alter table public.usuarios drop constraint if exists usuarios_perfil_check;
alter table public.usuarios add constraint usuarios_perfil_check check (perfil in
  ('master','medico','coordenacao','cuidador','enfermagem','enfermeira','multidisciplinar',
   'nutricionista','farmacia','administracao','direcao','hotelaria','servicos_gerais',
   'lavanderia','familia','obra_prestador'));

-- ── 0.2 · Configuração do módulo (feature flag + parâmetros contratuais) ────
create table if not exists public.obra_config (
  chave      text primary key,
  valor      text not null,
  descricao  text,
  atualizado_em timestamptz not null default now()
);
comment on table public.obra_config is
  'Módulo Obra: feature flag + parâmetros FIXOS do contrato (fonte: contrato TRÍADE). A linha modulo_obra_ativo é legível por qualquer autenticado (controla menu/rota); as demais são financeiras (master/direção).';

insert into public.obra_config (chave, valor, descricao) values
  ('modulo_obra_ativo',          'true',     'Feature flag: desligada, o módulo some do menu e a rota mostra aviso'),
  ('preco_m2_mo',                '914.66',   'Preço de mão de obra por m² (fixo na Fase 1; reajuste IPCA nas 2–4)'),
  ('teto_area_m2',               '13688.56', 'Teto total de área construída medida'),
  ('retencao_mo_pct',            '5',        'Retenção sobre cada medição de MO (libera 50% TRP / 50% TRD)'),
  ('trd_prazo_dias',             '90',       'Dias entre TRP e TRD (vícios aparentes)'),
  ('multa_fase_dia_pct',         '0.05',     'Multa de atraso de fase: %/dia sobre o valor da fase'),
  ('multa_fase_teto_pct',        '5',        'Teto da multa de atraso de fase (%)'),
  ('bonus_antecipacao_pct',      '1',        'Bônus por 30 dias completos de antecipação (%)'),
  ('bonus_antecipacao_teto_pct', '2',        'Teto do bônus de antecipação por fase (%)'),
  ('projetos_valor_global',      '500000',   'Projetos complementares: valor global (R$)'),
  ('multa_projeto_dia_pct',      '0.15',     'Multa de atraso de disciplina de projeto: %/dia'),
  ('multa_projeto_teto_pct',     '10',       'Teto da multa de atraso de projeto (%)'),
  ('consumiveis_canteiro_pct',   '1.5',      'Limite de consumíveis de canteiro da construtora (% da medição)'),
  ('estoque_reposicao_pct',      '3',        'Estoque de reposição de acabamentos ao fim de cada fase (%)')
on conflict (chave) do nothing;

-- ── 0.3 · Alíquotas sobre NF de MO (configuráveis) ──────────────────────────
create table if not exists public.obra_aliquotas (
  chave      text primary key,
  rotulo     text not null,
  percentual numeric not null,
  ativa      boolean not null default true,
  observacao text
);
insert into public.obra_aliquotas (chave, rotulo, percentual, ativa, observacao) values
  ('inss', 'INSS (retenção art. 31, Lei 8.212/91)', 11,   true,  null),
  ('iss',  'ISS Curitiba',                           5,    true,  'Confirmar alíquota do CNAE junto à contabilidade'),
  ('irrf', 'IRRF',                                   1.2,  false, 'Ativar quando aplicável'),
  ('csrf', 'CSRF (PIS/COFINS/CSLL)',                 4.65, false, 'Ativar quando aplicável')
on conflict (chave) do nothing;

-- ── 0.4 · Tolerâncias de perdas de materiais por categoria ──────────────────
create table if not exists public.obra_tolerancias_perdas (
  categoria  text primary key,
  percentual numeric not null
);
insert into public.obra_tolerancias_perdas (categoria, percentual) values
  ('concreto', 5), ('aco', 8), ('blocos', 5), ('ceramicos', 10), ('tintas', 5), ('demais', 5)
on conflict (categoria) do nothing;

-- ── 1.1 · Fases da obra (dados fixos do contrato) ───────────────────────────
create table if not exists public.obra_fases (
  id           uuid primary key default gen_random_uuid(),
  numero       int not null unique check (numero between 1 and 4),
  nome         text not null,
  modulos      text not null,
  area_m2      numeric not null,
  reajustavel  boolean not null default true,   -- Fase 1: preço fixo
  ipca_pct     numeric,                          -- reajuste aplicado ao iniciar (Fases 2–4)
  status       text not null default 'nao_iniciada'
               check (status in ('nao_iniciada','em_andamento','trp_emitido','trd_emitido')),
  data_inicio  date,
  data_trp     date,
  data_trd     date,
  criado_em    timestamptz not null default now()
);
comment on table public.obra_fases is
  'Fases sequenciais da obra (contrato TRÍADE). Fase seguinte só inicia após TRP da anterior + aprovação expressa. Fase 1 tem preço/m² fixo; 2–4 reajuste IPCA (mora congela índice).';

insert into public.obra_fases (numero, nome, modulos, area_m2, reajustavel) values
  (1, 'Fase 1', 'Módulo 5',       2952.41, false),
  (2, 'Fase 2', 'Módulo 3',       2785.30, true),
  (3, 'Fase 3', 'Módulo 4',       2302.08, true),
  (4, 'Fase 4', 'Módulos 1 e 2',  5648.77, true)
on conflict (numero) do nothing;

-- ── 1.2 · Etapas construtivas por fase (binárias, com peso financeiro) ──────
create table if not exists public.obra_etapas (
  id         uuid primary key default gen_random_uuid(),
  fase_id    uuid not null references public.obra_fases(id) on delete cascade,
  ordem      int not null,
  nome       text not null,
  descricao  text,                -- o que verificar IN LOCO para dar por concluída
  peso_pct   numeric not null check (peso_pct >= 0),
  depende_de uuid references public.obra_etapas(id),
  criado_em  timestamptz not null default now(),
  unique (fase_id, ordem)
);
comment on table public.obra_etapas is
  'Etapas construtivas binárias por fase. peso_pct: curva padrão editável pelo master ANTES da 1ª medição da fase (trava com o módulo de medições). Avanço físico da fase = soma dos pesos das etapas concluídas.';

-- Curva de pesos padrão (soma 100) semeada em CADA fase.
do $$
declare
  f record;
begin
  if not exists (select 1 from public.obra_etapas) then
    for f in select id from public.obra_fases order by numero loop
      insert into public.obra_etapas (fase_id, ordem, nome, descricao, peso_pct) values
        (f.id,  1, 'Serviços preliminares',        'Canteiro, tapumes e ligações provisórias instalados e operantes', 3),
        (f.id,  2, 'Fundações',                    'Fundações executadas conforme projeto, com ensaios de concreto arquivados', 8),
        (f.id,  3, 'Estrutura',                    'Estrutura (pilares/vigas/lajes) concluída no módulo, desformada', 22),
        (f.id,  4, 'Alvenaria e vedações',         'Alvenarias/vedações levantadas em todos os pavimentos do módulo', 11),
        (f.id,  5, 'Cobertura',                    'Cobertura executada e estanque (teste de estanqueidade)', 3),
        (f.id,  6, 'Impermeabilização',            'Áreas molhadas/reservatórios impermeabilizados com teste de lâmina', 2),
        (f.id,  7, 'Instalações',                  'Elétrica, hidrossanitária e especiais passadas e testadas', 22),
        (f.id,  8, 'Revestimentos, pisos e pintura','Revestimentos internos/externos, pisos e pintura concluídos', 20),
        (f.id,  9, 'Esquadrias e vidros',          'Esquadrias e vidros instalados e vedados', 5),
        (f.id, 10, 'Louças e metais',              'Louças, metais e acessórios instalados e funcionando', 2),
        (f.id, 11, 'Áreas externas',               'Calçadas, acessos e áreas externas do módulo concluídas', 1),
        (f.id, 12, 'Limpeza e comissionamento',    'Limpeza fina e comissionamento das instalações do módulo', 1);
    end loop;
  end if;
end $$;

-- ── 1.3 · Checklist de execução (verificação binária + FOTO obrigatória) ────
create table if not exists public.obra_checklist_execucao (
  id                 uuid primary key default gen_random_uuid(),
  etapa_id           uuid not null references public.obra_etapas(id) on delete cascade,
  concluido          boolean not null,
  foto_url           text not null,   -- caminho no bucket privado `obra` (obrigatória)
  observacao         text,
  registrado_por     text not null,
  perfil_registrador text not null,
  registrado_em      timestamptz not null default now()
);
comment on table public.obra_checklist_execucao is
  'Verificações in loco da etapa (binário + foto datada obrigatória). O estado atual da etapa é o registro MAIS RECENTE (permite reabrir com novo registro concluido=false e justificativa). O "carimbo" da foto é o registro: data/autor gravados aqui e exibidos sobre a imagem na UI.';
create index if not exists idx_obra_checklist_etapa on public.obra_checklist_execucao (etapa_id, registrado_em desc);

-- ── 0.5 · Disciplinas de projeto (Anexo III — dados fixos; fluxo na Fase 3) ─
create table if not exists public.obra_disciplinas (
  id              uuid primary key default gen_random_uuid(),
  ordem           int not null,
  nome            text not null unique,
  valor           numeric not null,
  prazo_dias      int,
  revisoes_max    int not null default 2,
  revisoes_usadas int not null default 0,
  status          text not null default 'Pendente'
                  check (status in ('Pendente','Em análise','Aprovado','Reprovado','Aguardando input','Pago','Concluído')),
  motivo          text,             -- obrigatório em Reprovado/Aguardando input (validado na UI/RPC da Fase 3)
  observacao      text,
  criado_em       timestamptz not null default now()
);
comment on table public.obra_disciplinas is
  'Projetos complementares (Anexo III, R$ 500.000 global). Marcos de pagamento 25/40/25/10 e fluxo entram na Fase 3; aqui ficam os dados fixos semeados.';

insert into public.obra_disciplinas (ordem, nome, valor, prazo_dias, revisoes_max, observacao) values
  ( 1, 'Sondagem',                          6800,     10, 0, null),
  ( 2, 'Terraplenagem',                     20000,    45, 2, 'Máquinas, operadores e combustível por conta do Contratante'),
  ( 3, 'Contenções',                        12000,    45, 2, null),
  ( 4, 'Licenciamento ambiental',           4200,   null, 2, null),
  ( 5, 'Fundações',                         37000,    45, 2, null),
  ( 6, 'Estrutural',                        98800,    45, 2, 'Prazo de 45 dias contado do laudo geotécnico + estudo de elevadores'),
  ( 7, 'Impermeabilização',                 20000,    45, 2, null),
  ( 8, 'Hidrossanitário',                   65000,    90, 2, null),
  ( 9, 'Drenagem pluvial',                  15000,    45, 2, null),
  (10, 'Elétrico + Cabeamento + CFTV',      65000,    90, 2, null),
  (11, 'Cabeamento estruturado',            14630.45, 90, 2, null),
  (12, 'CFTV',                              8088.68,  90, 2, null),
  (13, 'Chamada de enfermagem',             9265.20,  90, 2, null),
  (14, 'Automação / IoT',                   11838.87, 90, 2, null),
  (15, 'Controle de acesso',                6176.80,  90, 2, null),
  (16, 'PPCI',                              55000,    90, 2, null),
  (17, 'PBA-VISA',                          15800,    90, 2, null),
  (18, 'PGRSS',                             3500,     45, 2, null),
  (19, 'Acessibilidade',                    8500,     90, 2, null),
  (20, 'BIM',                               23400,    45, 2, 'Mínimo 3 rodadas com relatório de interferências + rodada final com IFC'),
  (21, 'Paisagismo',                        0,        45, 2, 'Incluso no global')
on conflict (nome) do nothing;

-- ── 0.6 · Auditoria: toda mutação relevante nas tabelas obra_ ───────────────
create table if not exists public.obra_audit_log (
  id          uuid primary key default gen_random_uuid(),
  tabela      text not null,
  registro_id text,
  acao        text not null,          -- INSERT / UPDATE / DELETE
  antes       jsonb,
  depois      jsonb,
  usuario     text,                   -- e-mail do JWT
  perfil      text,
  em          timestamptz not null default now()
);
comment on table public.obra_audit_log is
  'Trilha de auditoria do módulo Obra (quem, quando, o quê, antes → depois). Escrita só por trigger; leitura master/direção.';
create index if not exists idx_obra_audit_tabela on public.obra_audit_log (tabela, em desc);

create or replace function public.fn_obra_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.obra_audit_log (tabela, registro_id, acao, antes, depois, usuario, perfil)
  values (
    TG_TABLE_NAME,
    coalesce((case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end) ->> 'id',
             (case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end) ->> 'chave',
             (case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end) ->> 'categoria'),
    TG_OP,
    case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) end,
    case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) end,
    auth.jwt() ->> 'email',
    public.app_perfil()
  );
  return coalesce(NEW, OLD);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['obra_config','obra_aliquotas','obra_tolerancias_perdas',
                           'obra_fases','obra_etapas','obra_checklist_execucao','obra_disciplinas'] loop
    execute format('drop trigger if exists trg_audit_%s on public.%I', t, t);
    execute format('create trigger trg_audit_%s after insert or update or delete on public.%I
                    for each row execute function public.fn_obra_audit()', t, t);
  end loop;
end $$;

-- ── 0.7 · RLS ────────────────────────────────────────────────────────────────
-- master/direcao: total. obra_prestador: SÓ leitura da estrutura física
-- (fases/etapas/checklist) — escrita dele chega na Fase 6 (portal). Nunca vê
-- config financeira, alíquotas, tolerâncias, disciplinas (valores) nem audit.

alter table public.obra_config enable row level security;
drop policy if exists obra_config_flag_select on public.obra_config;
create policy obra_config_flag_select on public.obra_config for select to authenticated
  using (chave = 'modulo_obra_ativo' or public.app_perfil() in ('master','direcao'));
drop policy if exists obra_config_write on public.obra_config;
create policy obra_config_write on public.obra_config for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_aliquotas enable row level security;
drop policy if exists obra_aliquotas_all on public.obra_aliquotas;
create policy obra_aliquotas_all on public.obra_aliquotas for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_tolerancias_perdas enable row level security;
drop policy if exists obra_tolerancias_all on public.obra_tolerancias_perdas;
create policy obra_tolerancias_all on public.obra_tolerancias_perdas for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_fases enable row level security;
drop policy if exists obra_fases_select on public.obra_fases;
create policy obra_fases_select on public.obra_fases for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_fases_write on public.obra_fases;
create policy obra_fases_write on public.obra_fases for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_etapas enable row level security;
drop policy if exists obra_etapas_select on public.obra_etapas;
create policy obra_etapas_select on public.obra_etapas for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_etapas_write on public.obra_etapas;
create policy obra_etapas_write on public.obra_etapas for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_checklist_execucao enable row level security;
drop policy if exists obra_checklist_select on public.obra_checklist_execucao;
create policy obra_checklist_select on public.obra_checklist_execucao for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_checklist_write on public.obra_checklist_execucao;
create policy obra_checklist_write on public.obra_checklist_execucao for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_disciplinas enable row level security;
drop policy if exists obra_disciplinas_all on public.obra_disciplinas;
create policy obra_disciplinas_all on public.obra_disciplinas for all to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));

alter table public.obra_audit_log enable row level security;
drop policy if exists obra_audit_select on public.obra_audit_log;
create policy obra_audit_select on public.obra_audit_log for select to authenticated
  using (public.app_perfil() in ('master','direcao'));
-- (sem policies de INSERT/UPDATE/DELETE: só o trigger SECURITY DEFINER escreve)

-- ── 0.8 · Storage: bucket privado `obra` ────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('obra', 'obra', false)
on conflict (id) do nothing;

drop policy if exists obra_storage_select on storage.objects;
create policy obra_storage_select on storage.objects for select to authenticated
  using (bucket_id = 'obra' and public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_storage_insert on storage.objects;
create policy obra_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'obra' and public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_storage_update on storage.objects;
create policy obra_storage_update on storage.objects for update to authenticated
  using (bucket_id = 'obra' and public.app_perfil() in ('master','direcao'));
drop policy if exists obra_storage_delete on storage.objects;
create policy obra_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'obra' and public.app_perfil() in ('master','direcao'));

-- ── 0.9 · Teste de RLS (rodar manualmente com um JWT obra_prestador) ────────
-- select * from obra_config;              -- deve retornar SÓ modulo_obra_ativo
-- select * from obra_aliquotas;           -- deve retornar 0 linhas
-- select * from obra_tolerancias_perdas;  -- deve retornar 0 linhas
-- select * from obra_disciplinas;         -- deve retornar 0 linhas
-- select * from obra_audit_log;           -- deve retornar 0 linhas
-- select * from obra_fases;               -- deve retornar as 4 fases (leitura ok)
-- update obra_fases set status='em_andamento' where numero=1;  -- deve falhar
-- select * from mensalidade_config;       -- (qualquer tabela financeira do app) deve falhar/0 linhas

-- Fim.
