-- ===========================================================================
-- 0081 — COBERTURA ASSISTENCIAL: designação cuidador↔hóspede POR TURNO
-- ---------------------------------------------------------------------------
-- Substitui o vínculo FIXO `cuidador_residente` por uma designação por
-- data+turno (muitos-para-muitos). A enfermeira NÃO entra aqui — ela é lida da
-- escala (turnos, categoria='enfermeiras'): uma por turno, responsável por
-- todos. Day care só é designado no turno diurno (regra aplicada no app).
--
-- "Conversa com a escala" (em tempo real, sem trigger): a designação só VALE se
-- o cuidador ainda estiver escalado no turno — o app cruza designacao × turnos
-- na leitura; quem sai da escala deixa de cobrir (hóspede fica DESCOBERTO).
--
-- Idempotente. Rode DEPOIS da 0030 (app_perfil) e da 0009 (turnos).
-- ===========================================================================

create table if not exists public.designacao_cuidado (
  id            uuid primary key default gen_random_uuid(),
  residente_id  uuid not null references public.residentes(id) on delete cascade,
  cuidador_id   uuid not null references public.usuarios(id)   on delete cascade,
  data          date not null,
  turno         text not null,                 -- tag da escala: 'diurno' | 'noturno'
  criado_por    text,
  criado_em     timestamptz not null default now(),
  unique (residente_id, cuidador_id, data, turno)
);
comment on table public.designacao_cuidado is
  'Designação cuidador↔hóspede POR TURNO (data+turno). Substitui o vínculo fixo cuidador_residente. A enfermeira vem da escala (turnos categoria=enfermeiras), não daqui.';

create index if not exists idx_designacao_data_turno on public.designacao_cuidado (data, turno);
create index if not exists idx_designacao_cuidador   on public.designacao_cuidado (cuidador_id, data, turno);

-- RLS: todo mundo autenticado LÊ (o cuidador precisa ver os seus); só
-- Coordenação e Master ESCREVEM (designam/removem).
alter table public.designacao_cuidado enable row level security;
drop policy if exists designacao_select on public.designacao_cuidado;
create policy designacao_select on public.designacao_cuidado for select to authenticated using (true);
drop policy if exists designacao_write on public.designacao_cuidado;
create policy designacao_write on public.designacao_cuidado for all to authenticated
  using (public.app_perfil() in ('coordenacao','master'))
  with check (public.app_perfil() in ('coordenacao','master'));

-- Aposentadoria do vínculo fixo: a tabela continua existindo (compatibilidade
-- histórica), mas o app NÃO a lê mais para "meus hóspedes" — agora é por turno.
comment on table public.cuidador_residente is
  'DEPRECADO (0081): vínculo fixo cuidador↔hóspede. Substituído por designacao_cuidado (por turno). Mantido só por histórico; o app não usa mais para "meus hóspedes".';

-- ---------------------------------------------------------------------------
-- RLS de RESIDENTES: o cuidador agora enxerga os hóspedes DESIGNADOS a ele por
-- turno (designacao_cuidado), e não mais só os do vínculo fixo. Mantemos a
-- união com cuidador_residente por segurança de transição. Replica a policy
-- vigente (0058) trocando apenas a cláusula do cuidador. Idempotente.
-- ---------------------------------------------------------------------------
drop policy if exists residentes_select on public.residentes;
create policy residentes_select on public.residentes for select to authenticated using (
  public.app_perfil() in
    ('master','coordenacao','medico','enfermagem','enfermeira','multidisciplinar','nutricionista',
     'administracao','direcao','hotelaria','servicos_gerais','farmacia')
  or (public.app_perfil() = 'cuidador'
      and id in (
        select dc.residente_id from public.designacao_cuidado dc
          where dc.cuidador_id = public.app_usuario_id()
        union
        select cr.residente_id from public.cuidador_residente cr
          where cr.cuidador_id = public.app_usuario_id()
      ))
  or (public.app_perfil() = 'familia'
      and id = (select u.residente_vinculado from public.usuarios u
                where u.id = public.app_usuario_id()))
);
