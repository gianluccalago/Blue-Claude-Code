-- ===========================================================================
-- 0049 — Chamados de manutenção DIRECIONÁVEIS (Hotelaria × Serviços Gerais)
-- ---------------------------------------------------------------------------
-- Cada chamado passa a ter um DESTINO (quem trata). Quem abre escolhe. Cada
-- serviço vê/gere apenas os seus; Administração/Master veem todos (leitura +
-- a flag de cobrança da 0050).
--
-- Os chamados EXISTENTES viram 'servicos_gerais' (manutenção predial é o caso
-- comum) — o default da coluna preenche as linhas antigas. Idempotente.
-- ===========================================================================

-- 1) Coluna destino (default cobre as linhas existentes → servicos_gerais).
alter table public.chamado_manutencao
  add column if not exists destino text not null default 'servicos_gerais';

alter table public.chamado_manutencao drop constraint if exists chamado_manutencao_destino_check;
alter table public.chamado_manutencao add constraint chamado_manutencao_destino_check
  check (destino in ('hotelaria','servicos_gerais'));

-- 2) RLS por destino. Substitui a policy 'staff_only' (0032) por três policies
--    granulares (select/insert/update).
alter table public.chamado_manutencao enable row level security;
drop policy if exists demo_all   on public.chamado_manutencao;
drop policy if exists auth_all   on public.chamado_manutencao;
drop policy if exists staff_only on public.chamado_manutencao;
drop policy if exists chamado_select on public.chamado_manutencao;
drop policy if exists chamado_insert on public.chamado_manutencao;
drop policy if exists chamado_update on public.chamado_manutencao;

-- SELECT: gestão vê tudo; cada serviço vê só o seu destino.
create policy chamado_select on public.chamado_manutencao for select to authenticated using (
  public.app_perfil() in ('master','administracao','direcao')
  or (public.app_perfil() = 'hotelaria'       and destino = 'hotelaria')
  or (public.app_perfil() = 'servicos_gerais' and destino = 'servicos_gerais')
);

-- INSERT: qualquer equipe (não-família) pode abrir, para qualquer destino.
-- (Cuidadores, Coordenação, Master, Hotelaria, Serviços Gerais.)
create policy chamado_insert on public.chamado_manutencao for insert to authenticated
  with check (public.app_perfil() <> 'familia');

-- UPDATE: gestão (flag de cobrança) + o serviço dono do destino (atribuir/
-- resolver). O WITH CHECK mantém o destino coerente com quem edita.
create policy chamado_update on public.chamado_manutencao for update to authenticated
  using (
    public.app_perfil() in ('master','administracao','direcao')
    or (public.app_perfil() = 'hotelaria'       and destino = 'hotelaria')
    or (public.app_perfil() = 'servicos_gerais' and destino = 'servicos_gerais')
  )
  with check (
    public.app_perfil() in ('master','administracao','direcao')
    or (public.app_perfil() = 'hotelaria'       and destino = 'hotelaria')
    or (public.app_perfil() = 'servicos_gerais' and destino = 'servicos_gerais')
  );
