-- ===========================================================================
-- 0043 — Perfil DIREÇÃO (separa do Administrativo; só a Direção tem CRM)
-- ---------------------------------------------------------------------------
-- A Direção é a MESMA operação da Administração + o módulo CRM. Logo:
--   • ganha 'direcao' o mesmo acesso de dados que 'administracao' (residentes,
--     usuários, financeiro);
--   • o CRM passa a ser de 'master' + 'direcao' (a Administração PERDE o CRM).
-- Também cria o login de Direção (Ernesto Lagomarsino) e torna o login
-- administrativo genérico. Idempotente.
-- ===========================================================================

-- 1) Enum/check do perfil: adiciona 'direcao'.
alter table public.usuarios drop constraint if exists usuarios_perfil_check;
alter table public.usuarios add constraint usuarios_perfil_check check (perfil in
  ('master','medico','coordenacao','cuidador','enfermagem','multidisciplinar',
   'nutricionista','farmacia','administracao','direcao','hotelaria','familia'));

-- 2) RLS — Direção espelha a Administração nas tabelas de lista explícita.
-- 2a. RESIDENTES (select + write).
drop policy if exists residentes_select on public.residentes;
create policy residentes_select on public.residentes for select to authenticated using (
  public.app_perfil() in
    ('master','coordenacao','medico','enfermagem','multidisciplinar','nutricionista','administracao','direcao','hotelaria','farmacia')
  or (public.app_perfil() = 'cuidador'
      and id in (select cr.residente_id from public.cuidador_residente cr
                 where cr.cuidador_id = public.app_usuario_id()))
  or (public.app_perfil() = 'familia'
      and id = (select u.residente_vinculado from public.usuarios u
                where u.id = public.app_usuario_id()))
);
drop policy if exists residentes_write on public.residentes;
create policy residentes_write on public.residentes for all to authenticated
  using (public.app_perfil() in ('master','coordenacao','administracao','direcao'))
  with check (public.app_perfil() in ('master','coordenacao','administracao','direcao'));

-- 2b. USUARIOS (insert + update) — Direção gere usuários como a Administração.
drop policy if exists usuarios_insert on public.usuarios;
create policy usuarios_insert on public.usuarios for insert to authenticated with check (
  public.app_perfil() in ('master','administracao','direcao')
  or (public.app_perfil() = 'coordenacao' and perfil in ('cuidador','enfermagem'))
);
drop policy if exists usuarios_update on public.usuarios;
create policy usuarios_update on public.usuarios for update to authenticated
  using (
    public.app_perfil() in ('master','administracao','direcao')
    or (public.app_perfil() = 'coordenacao' and perfil in ('cuidador','enfermagem'))
  )
  with check (
    public.app_perfil() in ('master','administracao','direcao')
    or (public.app_perfil() = 'coordenacao' and perfil in ('cuidador','enfermagem'))
  );

-- 2c. FINANCEIRO — upselling + (tabela_preco, pagamento_mensalidade, pagamento_pessoal).
do $$
begin
  if to_regclass('public.upselling') is not null then
    drop policy if exists upselling_select on public.upselling;
    drop policy if exists upselling_write on public.upselling;
    create policy upselling_select on public.upselling for select to authenticated using (
      public.app_perfil() in ('administracao','direcao','master')
      or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia())
    );
    create policy upselling_write on public.upselling for all to authenticated
      using (public.app_perfil() in ('administracao','direcao','master'))
      with check (public.app_perfil() in ('administracao','direcao','master'));
  end if;
end $$;

do $$ declare t text;
begin
  foreach t in array array['tabela_preco','pagamento_mensalidade','pagamento_pessoal'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists admin_only on public.%I;', t);
      execute format(
        'create policy admin_only on public.%I for all to authenticated '
        || 'using (public.app_perfil() in (''administracao'',''direcao'',''master'')) '
        || 'with check (public.app_perfil() in (''administracao'',''direcao'',''master''));', t);
    end if;
  end loop;
end $$;

-- 2d. CRM — passa a ser de Master + DIREÇÃO (Administração perde o acesso).
do $$ declare t text;
begin
  foreach t in array array[
    'crm_etapa','crm_motivo_perda','crm_origem','crm_contato',
    'crm_oportunidade','crm_tarefa','crm_evento'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists crm_admin_all on public.%I;', t);
      execute format(
        'create policy crm_admin_all on public.%I for all to authenticated '
        || 'using (public.app_perfil() in (''master'',''direcao'')) '
        || 'with check (public.app_perfil() in (''master'',''direcao''));', t);
    end if;
  end loop;
end $$;

-- 3) Usuários: Direção (Ernesto) + login administrativo genérico.
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, isento_ponto_app) values
  ('b0000000-0000-0000-0000-000000000016','Ernesto Lagomarsino','direcao@blueseniorliving.com.br','direcao',true,'Diretor',true)
on conflict (id) do update
  set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
      ativo = excluded.ativo, funcao = excluded.funcao;

-- Login administrativo passa a ter nome genérico (a pessoa real foi p/ Direção).
update public.usuarios
  set nome = 'Administrativo', funcao = 'Administrativo'
  where id = 'b0000000-0000-0000-0000-000000000007';

-- 4) CRM mock: o responsável/autor que era a antiga administradora (Cláudia)
--    passa a ser a Direção (Ernesto), coerente com a posse do CRM.
update public.crm_oportunidade set responsavel = 'Ernesto Lagomarsino' where responsavel = 'Cláudia Ferreira';
update public.crm_tarefa        set responsavel = 'Ernesto Lagomarsino' where responsavel = 'Cláudia Ferreira';
update public.crm_evento        set autor       = 'Ernesto Lagomarsino' where autor       = 'Cláudia Ferreira';
