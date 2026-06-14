-- ===========================================================================
-- 0058 — Perfil ENFERMEIRA (operacional, versão reduzida da Coordenação)
-- ---------------------------------------------------------------------------
-- Mesmo poder de AÇÃO assistencial da Coordenação (pendências, alertas,
-- medicação de enfermagem, baixa de resgate), mas SEM chefia/gestão:
--   • Planos de cuidado: só LEITURA (criar/editar/remover é da Coordenação).
--   • Escalas/turnos/ponto, Modelos de rotina, Solicitações da família,
--     cadastro de Profissionais, NPS e financeiro: SEM acesso (RLS bloqueia).
-- As tabelas assistenciais (pendência/eliminação/intercorrência/administração)
-- já são auth_all → a enfermeira age plenamente nelas sem mudança. Aqui só
-- ajustamos o que precisa de recorte. Idempotente.
-- ===========================================================================

-- 1) Enum/check do perfil: adiciona 'enfermeira'.
alter table public.usuarios drop constraint if exists usuarios_perfil_check;
alter table public.usuarios add constraint usuarios_perfil_check check (perfil in
  ('master','medico','coordenacao','cuidador','enfermagem','enfermeira','multidisciplinar',
   'nutricionista','farmacia','administracao','direcao','hotelaria','servicos_gerais',
   'lavanderia','familia'));

-- 2) RESIDENTES: enfermeira lê todos (assistencial, como a Coordenação). NÃO
--    edita cadastro (residentes_write inalterado: master/coordenacao/administracao/direcao).
drop policy if exists residentes_select on public.residentes;
create policy residentes_select on public.residentes for select to authenticated using (
  public.app_perfil() in
    ('master','coordenacao','medico','enfermagem','enfermeira','multidisciplinar','nutricionista',
     'administracao','direcao','hotelaria','servicos_gerais','farmacia')
  or (public.app_perfil() = 'cuidador'
      and id in (select cr.residente_id from public.cuidador_residente cr
                 where cr.cuidador_id = public.app_usuario_id()))
  or (public.app_perfil() = 'familia'
      and id = (select u.residente_vinculado from public.usuarios u
                where u.id = public.app_usuario_id()))
);

-- 3) PLANO DE CUIDADO: leitura para a equipe; escrita só chefia (Master/
--    Coordenação). Antes era auth_all → agora a Enfermeira (e demais) só LÊ.
alter table public.plano_cuidado_item enable row level security;
drop policy if exists auth_all on public.plano_cuidado_item;
drop policy if exists plano_cuidado_select on public.plano_cuidado_item;
drop policy if exists plano_cuidado_write on public.plano_cuidado_item;
create policy plano_cuidado_select on public.plano_cuidado_item for select to authenticated
  using (public.app_perfil() <> 'familia');
create policy plano_cuidado_write on public.plano_cuidado_item for all to authenticated
  using (public.app_perfil() in ('master','coordenacao'))
  with check (public.app_perfil() in ('master','coordenacao'));

-- 4) ESTOQUE DE RESGATE: a Enfermeira pode dar BAIXA (não repõe). Amplia o
--    check de perfil_responsavel e a policy de escrita.
alter table public.baixa_resgate drop constraint if exists baixa_resgate_perfil_responsavel_check;
alter table public.baixa_resgate add constraint baixa_resgate_perfil_responsavel_check
  check (perfil_responsavel in ('farmacia','coordenacao','medico','enfermeira'));
drop policy if exists baixa_resgate_write on public.baixa_resgate;
create policy baixa_resgate_write on public.baixa_resgate for all to authenticated
  using (public.app_perfil() in ('farmacia','coordenacao','medico','enfermeira','master'))
  with check (public.app_perfil() in ('farmacia','coordenacao','medico','enfermeira','master'));

-- 5) PROCEDIMENTOS de enfermagem: a Enfermeira registra (curativo/sonda).
drop policy if exists procedimento_enf_write on public.procedimento_enfermagem;
create policy procedimento_enf_write on public.procedimento_enfermagem for all to authenticated
  using (public.app_perfil() in ('enfermagem','enfermeira','coordenacao','medico','master'))
  with check (public.app_perfil() in ('enfermagem','enfermeira','coordenacao','medico','master'));

-- 6) SOLICITAÇÕES DA FAMÍLIA: a Enfermeira NÃO vê nem responde.
drop policy if exists fam_scope on public.solicitacao_familia;
drop policy if exists solicitacao_familia_scope on public.solicitacao_familia;
create policy solicitacao_familia_scope on public.solicitacao_familia for all to authenticated
  using (
    public.app_perfil() not in ('familia','enfermeira')
    or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia())
  )
  with check (
    public.app_perfil() not in ('familia','enfermeira')
    or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia())
  );

-- 7) ESCALAS (turnos/ponto) e MODELOS DE ROTINA: a Enfermeira não acessa.
--    Mantém o acesso aberto dos demais (era auth_all) e só bloqueia a enfermeira.
do $$ declare t text;
begin
  foreach t in array array['turnos','modelo_rotina','modelo_rotina_item'] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists auth_all on public.%I;', t);
      execute format('drop policy if exists sem_enfermeira on public.%I;', t);
      execute format(
        'create policy sem_enfermeira on public.%I for all to authenticated '
        || 'using (public.app_perfil() <> ''enfermeira'') '
        || 'with check (public.app_perfil() <> ''enfermeira'');', t);
    end if;
  end loop;
end $$;

-- 8) Usuário de teste.
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, isento_ponto_app) values
  ('b0000000-0000-0000-0000-000000000019','Beatriz Solano','enfermeira@blueseniorliving.com.br','enfermeira',true,'Enfermeira',true)
on conflict (id) do update
  set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
      ativo = excluded.ativo, funcao = excluded.funcao;
