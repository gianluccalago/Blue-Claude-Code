-- ===========================================================================
-- 0133 — ENDURECIMENTO DE SEGURANÇA (auditoria de 24/09/2026).
-- ---------------------------------------------------------------------------
-- Fecha os pontos críticos e altos encontrados na auditoria de RLS, RPCs e
-- storage. Tudo idempotente e guardado por existência. Rode após a 0132
-- (a 0132 NÃO precisa ter sido executada).
--
-- RESUMO DO QUE MUDA
--  1) app_perfil() nunca mais devolve NULL para usuário logado sem cadastro
--     ativo: devolve 'sem_perfil'. Em PL/pgSQL, "NULL not in (...)" é NULL e o
--     IF trata como falso — 12 RPCs SECURITY DEFINER (pagar medição/marco,
--     emitir TRP/TRD, planejar atividade, trocar senha...) deixavam passar
--     usuário inativo, sem_acesso ou conta criada por cadastro público.
--  2) EXECUTE das funções de public revogado de PUBLIC/anon (só as de
--     agenda/solicitação continuam anônimas). Antes, com a anon key do bundle
--     e sem login dava para chamar obra_pagar_medicao e afins.
--  3) Policies "não é família" (app_perfil() <> 'familia') viram LISTAS DE
--     PERMISSÃO: a construtora (obra_prestador) lia e gravava prescrição,
--     evolução, intercorrência, dispensação, escala, etc.
--  4) usuarios: leitura só da própria linha ou pela equipe interna (família e
--     construtora liam salários, contatos e vínculos); índice único de e-mail
--     (evita sequestro de identidade por linha duplicada); trigger que impede
--     não-master de criar/alterar Master ou trocar o próprio perfil; inativar
--     ou marcar sem_acesso agora BANE a credencial no auth.
--  5) Storage: os 7 buckets de fotos/comprovantes tinham policy só por bucket
--     (qualquer logado listava fotos de lesões e comprovantes de todas as
--     famílias). Agora é por perfil e por pasta. No bucket obra, a construtora
--     deixa de enxergar nf/comprovantes/ (comprovantes bancários nossos).
--  6) fc_lancamentos_bkp_0131 (backup da unificação) ganha RLS e perde o
--     acesso via API.
--  7) Construtora: NF não pode nascer "paga"; item não pode ser faturado em
--     duas NFs; autoria (perfil_registrador/registrado_por) vem do servidor;
--     no planejamento de materiais ela não altera a resposta do Contratante.
--  8) Funcionais que eram só RLS: Direção passa a ler NPS e a gravar
--     configuração; médico atualiza alergias/altura/grau do hóspede (e só
--     isso), nutricionista a altura; estoque por hóspede aceita meia dose.
-- ===========================================================================

-- ── 1 · app_perfil() sem NULL + helpers de perfil ───────────────────────────
create or replace function public.app_perfil()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select u.perfil::text from public.usuarios u
    where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and u.ativo and not coalesce(u.sem_acesso, false)
    order by u.id limit 1
  ), 'sem_perfil')
$$;
comment on function public.app_perfil is
  'Perfil do usuário autenticado; ''sem_perfil'' quando não há cadastro ativo (nunca NULL — evita que "NULL not in (...)" passe em IF).';

create or replace function public.app_residente_vinculado()
returns uuid language sql stable security definer set search_path = public as $$
  select u.residente_vinculado from public.usuarios u
  where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and u.ativo and not coalesce(u.sem_acesso, false)
  order by u.id limit 1
$$;

-- Equipe interna: todo mundo que trabalha na casa. Exclui família, construtora e sem_perfil.
create or replace function public.app_equipe_interna()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_perfil() in (
    'master','direcao','administracao','coordenacao','cuidador','medico','enfermagem','enfermeira',
    'multidisciplinar','farmacia','nutricionista','hotelaria','lavanderia','servicos_gerais'
  ), false)
$$;
-- Equipe clínica/assistencial: quem lida com prontuário e cuidado.
create or replace function public.app_equipe_clinica()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_perfil() in (
    'master','direcao','coordenacao','cuidador','medico','enfermagem','enfermeira',
    'multidisciplinar','farmacia','nutricionista'
  ), false)
$$;
-- Gestão: sócios e administração.
create or replace function public.app_gestao()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_perfil() in ('master','direcao','administracao'), false)
$$;
grant execute on function public.app_equipe_interna() to authenticated, anon;
grant execute on function public.app_equipe_clinica() to authenticated, anon;
grant execute on function public.app_gestao() to authenticated, anon;

-- ── 3 · Policies de exclusão viram listas de permissão ──────────────────────
-- 3a. Tabelas clínicas: leitura pela equipe interna, escrita pela equipe clínica.
do $$ declare t text;
begin
  foreach t in array array[
    'avaliacao_ivcf','evolucao','evolucao_nutricional','resolucao_medica',
    'estoque_hospede','dispensacao','dieta',
    'administracao','eliminacao','eliminacao_tratamento','pendencia_tratamento','intercorrencia'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists staff_only on public.%I;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_sel_equipe', t);
      execute format('drop policy if exists %I on public.%I;', t || '_wr_clinica', t);
      execute format('create policy %I on public.%I for select to authenticated using (public.app_equipe_interna());', t || '_sel_equipe', t);
      execute format('create policy %I on public.%I for insert to authenticated with check (public.app_equipe_clinica());', t || '_ins_clinica', t);
      execute format('drop policy if exists %I on public.%I;', t || '_ins_clinica', t);
      execute format('create policy %I on public.%I for all to authenticated using (public.app_equipe_clinica()) with check (public.app_equipe_clinica());', t || '_wr_clinica', t);
    end if;
  end loop;
end $$;
-- 3b. Operacionais: equipe interna lê e grava.
do $$ declare t text;
begin
  foreach t in array array['inspecao_suite','inspecao_item','rouparia_transito'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists staff_only on public.%I;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_equipe', t);
      execute format('create policy %I on public.%I for all to authenticated using (public.app_equipe_interna()) with check (public.app_equipe_interna());', t || '_equipe', t);
    end if;
  end loop;
end $$;
-- 3c. Chamado de manutenção: abrir é da equipe interna.
drop policy if exists chamado_insert on public.chamado_manutencao;
create policy chamado_insert on public.chamado_manutencao for insert to authenticated
  with check (public.app_equipe_interna());

-- 3d. Registros de cuidado: equipe lê tudo; família lê SÓ o seu; escreve a equipe clínica.
do $$
begin
  if to_regclass('public.tarefa_registro') is not null then
    drop policy if exists tarefa_registro_scope on public.tarefa_registro;
    drop policy if exists tarefa_registro_sel on public.tarefa_registro;
    drop policy if exists tarefa_registro_wr on public.tarefa_registro;
    create policy tarefa_registro_sel on public.tarefa_registro for select to authenticated
      using (public.app_equipe_interna() or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia()));
    create policy tarefa_registro_wr on public.tarefa_registro for all to authenticated
      using (public.app_equipe_clinica()) with check (public.app_equipe_clinica());
  end if;
  if to_regclass('public.atividade_participacao') is not null then
    drop policy if exists ap_scope on public.atividade_participacao;
    drop policy if exists ap_sel on public.atividade_participacao;
    drop policy if exists ap_wr on public.atividade_participacao;
    create policy ap_sel on public.atividade_participacao for select to authenticated
      using (public.app_equipe_interna() or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia()));
    create policy ap_wr on public.atividade_participacao for all to authenticated
      using (public.app_equipe_clinica()) with check (public.app_equipe_clinica());
  end if;
  if to_regclass('public.compromisso_externo') is not null then
    drop policy if exists fam_scope on public.compromisso_externo;
    drop policy if exists compromisso_scope on public.compromisso_externo;
    create policy compromisso_scope on public.compromisso_externo for all to authenticated
      using (public.app_equipe_interna() or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia()))
      with check (public.app_equipe_interna() or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia()));
  end if;
  if to_regclass('public.solicitacao_familia') is not null then
    drop policy if exists fam_scope on public.solicitacao_familia;
    drop policy if exists solicitacao_familia_scope on public.solicitacao_familia;
    create policy solicitacao_familia_scope on public.solicitacao_familia for all to authenticated
      using ((public.app_equipe_interna() and public.app_perfil() <> 'enfermeira')
             or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia()))
      with check ((public.app_equipe_interna() and public.app_perfil() <> 'enfermeira')
             or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia()));
  end if;
end $$;

-- 3e. Prescrição: a equipe interna lê; só médico e master escrevem
--     (a tela de prescrição existe só no menu do médico).
drop policy if exists prescricao_select on public.prescricao;
create policy prescricao_select on public.prescricao for select to authenticated
  using (public.app_equipe_interna());
drop policy if exists prescricao_write on public.prescricao;
create policy prescricao_write on public.prescricao for all to authenticated
  using (coalesce(public.app_perfil() in ('master','medico'), false))
  with check (coalesce(public.app_perfil() in ('master','medico'), false));

-- 3f. Plano de cuidado, procedimentos, peso, viagem, resgate.
drop policy if exists plano_cuidado_select on public.plano_cuidado_item;
create policy plano_cuidado_select on public.plano_cuidado_item for select to authenticated
  using (public.app_equipe_interna() or (public.app_perfil() = 'familia' and residente_id = public.app_residente_vinculado()));
do $$
begin
  if to_regclass('public.procedimento_enfermagem') is not null then
    drop policy if exists procedimento_enf_select on public.procedimento_enfermagem;
    create policy procedimento_enf_select on public.procedimento_enfermagem for select to authenticated using (public.app_equipe_interna());
  end if;
  if to_regclass('public.registro_peso') is not null then
    drop policy if exists registro_peso_select on public.registro_peso;
    create policy registro_peso_select on public.registro_peso for select to authenticated using (public.app_equipe_interna());
  end if;
  if to_regclass('public.baixa_viagem') is not null then
    drop policy if exists baixa_viagem_select on public.baixa_viagem;
    create policy baixa_viagem_select on public.baixa_viagem for select to authenticated using (public.app_equipe_interna());
  end if;
  if to_regclass('public.estoque_resgate') is not null then
    drop policy if exists estoque_resgate_select on public.estoque_resgate;
    create policy estoque_resgate_select on public.estoque_resgate for select to authenticated
      using (public.app_equipe_interna() and public.app_perfil() <> 'cuidador');
  end if;
  if to_regclass('public.baixa_resgate') is not null then
    drop policy if exists baixa_resgate_select on public.baixa_resgate;
    create policy baixa_resgate_select on public.baixa_resgate for select to authenticated
      using (public.app_equipe_interna() and public.app_perfil() <> 'cuidador');
  end if;
end $$;

-- 3g. Escala (turnos) e modelos de rotina: eram "todos menos a enfermeira" —
--     família e construtora podiam criar, editar e apagar turnos e ponto.
do $$ declare t text;
begin
  foreach t in array array['turnos','modelo_rotina','modelo_rotina_item'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists sem_enfermeira on public.%I;', t);
      execute format('drop policy if exists %I on public.%I;', t || '_sel', t);
      execute format('drop policy if exists %I on public.%I;', t || '_wr_gestao', t);
      execute format('create policy %I on public.%I for select to authenticated using (public.app_equipe_interna() and public.app_perfil() <> ''enfermeira'');', t || '_sel', t);
      execute format('create policy %I on public.%I for all to authenticated using (coalesce(public.app_perfil() in (''master'',''direcao'',''administracao'',''coordenacao''), false)) with check (coalesce(public.app_perfil() in (''master'',''direcao'',''administracao'',''coordenacao''), false));', t || '_wr_gestao', t);
    end if;
  end loop;
  -- A própria profissional bate o ponto (check-in/out) no SEU turno.
  if to_regclass('public.turnos') is not null then
    drop policy if exists turnos_upd_proprio on public.turnos;
    create policy turnos_upd_proprio on public.turnos for update to authenticated
      using (profissional_id = public.app_usuario_id())
      with check (profissional_id = public.app_usuario_id());
  end if;
end $$;

-- 3h. Vínculos, atividades e designação: leitura pela equipe; escrita pela gestão/coordenação.
do $$
begin
  if to_regclass('public.cuidador_residente') is not null then
    drop policy if exists auth_all on public.cuidador_residente;
    drop policy if exists cuidador_residente_sel on public.cuidador_residente;
    drop policy if exists cuidador_residente_wr on public.cuidador_residente;
    create policy cuidador_residente_sel on public.cuidador_residente for select to authenticated using (public.app_equipe_interna());
    create policy cuidador_residente_wr on public.cuidador_residente for all to authenticated
      using (coalesce(public.app_perfil() in ('master','direcao','administracao','coordenacao'), false))
      with check (coalesce(public.app_perfil() in ('master','direcao','administracao','coordenacao'), false));
  end if;
  if to_regclass('public.atividade') is not null then
    drop policy if exists auth_all on public.atividade;
    drop policy if exists atividade_sel on public.atividade;
    drop policy if exists atividade_wr on public.atividade;
    create policy atividade_sel on public.atividade for select to authenticated
      using (public.app_equipe_interna() or public.app_perfil() = 'familia');
    create policy atividade_wr on public.atividade for all to authenticated
      using (coalesce(public.app_perfil() in ('master','direcao','coordenacao','multidisciplinar'), false))
      with check (coalesce(public.app_perfil() in ('master','direcao','coordenacao','multidisciplinar'), false));
  end if;
  if to_regclass('public.atividade_execucao') is not null then
    drop policy if exists auth_all on public.atividade_execucao;
    drop policy if exists atividade_execucao_sel on public.atividade_execucao;
    drop policy if exists atividade_execucao_wr on public.atividade_execucao;
    create policy atividade_execucao_sel on public.atividade_execucao for select to authenticated
      using (public.app_equipe_interna() or public.app_perfil() = 'familia');
    create policy atividade_execucao_wr on public.atividade_execucao for all to authenticated
      using (public.app_equipe_clinica()) with check (public.app_equipe_clinica());
  end if;
  if to_regclass('public.designacao_cuidado') is not null then
    drop policy if exists designacao_select on public.designacao_cuidado;
    create policy designacao_select on public.designacao_cuidado for select to authenticated using (public.app_equipe_interna());
  end if;
  if to_regclass('public.log_alteracao') is not null then
    drop policy if exists "log_alteracao_leitura" on public.log_alteracao;
    drop policy if exists "log_alteracao_insercao" on public.log_alteracao;
    create policy "log_alteracao_leitura" on public.log_alteracao for select to authenticated using (public.app_gestao());
    create policy "log_alteracao_insercao" on public.log_alteracao for insert to authenticated with check (public.app_gestao());
  end if;
end $$;

-- ── 4 · usuarios ────────────────────────────────────────────────────────────
drop policy if exists usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios for select to authenticated
  using (
    lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))   -- a própria linha (login, perfil)
    or public.app_equipe_interna()
  );

-- E-mail único (a resolução do perfil é por e-mail; linha duplicada = sequestro).
do $$
declare v_dups text;
begin
  select string_agg(e, ', ') into v_dups
    from (select lower(email) e from public.usuarios where email is not null group by 1 having count(*) > 1) d;
  if v_dups is not null then
    raise warning 'usuarios: e-mails duplicados (%). Índice único NÃO criado — corrija e rode de novo.', v_dups;
  else
    create unique index if not exists usuarios_email_lower_uq on public.usuarios (lower(email)) where email is not null;
  end if;
end $$;

-- Guarda de perfil: só Master cria/altera Master; ninguém troca o próprio perfil.
create or replace function public.fn_usuarios_guarda_perfil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Sem JWT (SQL Editor / migrations) não há o que guardar.
  if coalesce(auth.jwt() ->> 'email', '') = '' then return new; end if;
  if public.app_perfil() = 'master' then return new; end if;
  if new.perfil = 'master' or (tg_op = 'UPDATE' and old.perfil = 'master') then
    raise exception 'Só o Master pode criar ou alterar um usuário Master.';
  end if;
  if tg_op = 'UPDATE' and new.id = public.app_usuario_id() and new.perfil is distinct from old.perfil then
    raise exception 'Você não pode alterar o seu próprio perfil.';
  end if;
  return new;
end $$;
drop trigger if exists trg_usuarios_guarda_perfil on public.usuarios;
create trigger trg_usuarios_guarda_perfil before insert or update on public.usuarios
  for each row execute function public.fn_usuarios_guarda_perfil();

-- Inativar / sem_acesso BANE a credencial (antes, o ex-funcionário seguia com JWT válido).
create or replace function public.fn_usuarios_sincroniza_acesso()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_bloqueado boolean := (not new.ativo) or coalesce(new.sem_acesso, false);
        v_estava boolean := tg_op = 'UPDATE' and ((not old.ativo) or coalesce(old.sem_acesso, false));
begin
  if new.email is null or to_regclass('auth.users') is null then return new; end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'auth' and table_name = 'users' and column_name = 'banned_until') then
    return new;
  end if;
  if v_bloqueado then
    update auth.users set banned_until = 'infinity' where lower(email) = lower(new.email);
    if to_regclass('auth.refresh_tokens') is not null then
      delete from auth.refresh_tokens
       where user_id in (select id from auth.users where lower(email) = lower(new.email));
    end if;
  elsif v_estava then
    update auth.users set banned_until = null where lower(email) = lower(new.email);
  end if;
  return new;
end $$;
drop trigger if exists trg_usuarios_sincroniza_acesso on public.usuarios;
create trigger trg_usuarios_sincroniza_acesso after insert or update of ativo, sem_acesso, email on public.usuarios
  for each row execute function public.fn_usuarios_sincroniza_acesso();

-- ── 5 · Storage: buckets de fotos/comprovantes por perfil e pasta ───────────
-- Pastas: residentes-fotos/<residente>/, usuarios-fotos/<usuario>/,
-- manutencao-fotos/<chamado>/, atividades-fotos/<atividade>/ e inspecao/<residente>/,
-- upselling-comprovantes/<residente>/, intercorrencias-fotos/<residente>/,
-- custos-materiais-comprovantes/<categoria>/.
do $$
declare b text;
begin
  foreach b in array array[
    'residentes-fotos','usuarios-fotos','manutencao-fotos','atividades-fotos',
    'upselling-comprovantes','intercorrencias-fotos','custos-materiais-comprovantes'
  ] loop
    execute format('drop policy if exists %I on storage.objects;', b || '_select');
    execute format('drop policy if exists %I on storage.objects;', b || '_insert');
    execute format('drop policy if exists %I on storage.objects;', b || '_update');
    execute format('drop policy if exists %I on storage.objects;', b || '_delete');
  end loop;
end $$;

-- residentes-fotos: equipe; família só a pasta do seu residente.
create policy "residentes-fotos_select" on storage.objects for select to authenticated
  using (bucket_id = 'residentes-fotos' and (public.app_equipe_interna()
         or (public.app_perfil() = 'familia' and (storage.foldername(name))[1] = public.app_residente_familia()::text)));
create policy "residentes-fotos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'residentes-fotos' and public.app_equipe_interna());
create policy "residentes-fotos_update" on storage.objects for update to authenticated
  using (bucket_id = 'residentes-fotos' and public.app_equipe_interna())
  with check (bucket_id = 'residentes-fotos' and public.app_equipe_interna());
create policy "residentes-fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'residentes-fotos' and (public.app_gestao() or public.app_perfil() = 'coordenacao'));

-- usuarios-fotos: equipe e família veem (avatares); cada um sobe na própria pasta; gestão em todas.
create policy "usuarios-fotos_select" on storage.objects for select to authenticated
  using (bucket_id = 'usuarios-fotos' and (public.app_equipe_interna() or public.app_perfil() = 'familia'
         or (storage.foldername(name))[1] = public.app_usuario_id()::text));
create policy "usuarios-fotos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'usuarios-fotos' and (public.app_gestao() or (storage.foldername(name))[1] = public.app_usuario_id()::text));
create policy "usuarios-fotos_update" on storage.objects for update to authenticated
  using (bucket_id = 'usuarios-fotos' and (public.app_gestao() or (storage.foldername(name))[1] = public.app_usuario_id()::text))
  with check (bucket_id = 'usuarios-fotos' and (public.app_gestao() or (storage.foldername(name))[1] = public.app_usuario_id()::text));
create policy "usuarios-fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'usuarios-fotos' and (public.app_gestao() or (storage.foldername(name))[1] = public.app_usuario_id()::text));

-- manutencao-fotos: equipe interna.
create policy "manutencao-fotos_select" on storage.objects for select to authenticated
  using (bucket_id = 'manutencao-fotos' and public.app_equipe_interna());
create policy "manutencao-fotos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'manutencao-fotos' and public.app_equipe_interna());
create policy "manutencao-fotos_update" on storage.objects for update to authenticated
  using (bucket_id = 'manutencao-fotos' and public.app_equipe_interna())
  with check (bucket_id = 'manutencao-fotos' and public.app_equipe_interna());
create policy "manutencao-fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'manutencao-fotos' and (public.app_gestao() or public.app_perfil() in ('coordenacao','hotelaria','servicos_gerais')));

-- atividades-fotos (atividades e inspeção): equipe; família vê (fotos das atividades do portal).
create policy "atividades-fotos_select" on storage.objects for select to authenticated
  using (bucket_id = 'atividades-fotos' and (public.app_equipe_interna() or public.app_perfil() = 'familia'));
create policy "atividades-fotos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'atividades-fotos' and public.app_equipe_interna());
create policy "atividades-fotos_update" on storage.objects for update to authenticated
  using (bucket_id = 'atividades-fotos' and public.app_equipe_interna())
  with check (bucket_id = 'atividades-fotos' and public.app_equipe_interna());
create policy "atividades-fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'atividades-fotos' and (public.app_gestao() or public.app_perfil() in ('coordenacao','multidisciplinar','hotelaria')));

-- upselling-comprovantes: gestão e farmácia; família só a própria pasta.
create policy "upselling-comprovantes_select" on storage.objects for select to authenticated
  using (bucket_id = 'upselling-comprovantes' and (public.app_gestao() or public.app_perfil() = 'farmacia'
         or (public.app_perfil() = 'familia' and (storage.foldername(name))[1] = public.app_residente_familia()::text)));
create policy "upselling-comprovantes_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'upselling-comprovantes' and (public.app_gestao() or public.app_perfil() = 'farmacia'
         or (public.app_perfil() = 'familia' and (storage.foldername(name))[1] = public.app_residente_familia()::text)));
create policy "upselling-comprovantes_update" on storage.objects for update to authenticated
  using (bucket_id = 'upselling-comprovantes' and (public.app_gestao() or public.app_perfil() = 'farmacia'))
  with check (bucket_id = 'upselling-comprovantes' and (public.app_gestao() or public.app_perfil() = 'farmacia'));
create policy "upselling-comprovantes_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'upselling-comprovantes' and public.app_gestao());

-- intercorrencias-fotos: só equipe clínica (fotos de lesões).
create policy "intercorrencias-fotos_select" on storage.objects for select to authenticated
  using (bucket_id = 'intercorrencias-fotos' and (public.app_equipe_clinica() or public.app_gestao()));
create policy "intercorrencias-fotos_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'intercorrencias-fotos' and public.app_equipe_clinica());
create policy "intercorrencias-fotos_update" on storage.objects for update to authenticated
  using (bucket_id = 'intercorrencias-fotos' and public.app_equipe_clinica())
  with check (bucket_id = 'intercorrencias-fotos' and public.app_equipe_clinica());
create policy "intercorrencias-fotos_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'intercorrencias-fotos' and (public.app_gestao() or public.app_perfil() = 'coordenacao'));

-- custos-materiais-comprovantes: só gestão (custo interno).
create policy "custos-materiais-comprovantes_select" on storage.objects for select to authenticated
  using (bucket_id = 'custos-materiais-comprovantes' and public.app_gestao());
create policy "custos-materiais-comprovantes_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'custos-materiais-comprovantes' and public.app_gestao());
create policy "custos-materiais-comprovantes_update" on storage.objects for update to authenticated
  using (bucket_id = 'custos-materiais-comprovantes' and public.app_gestao())
  with check (bucket_id = 'custos-materiais-comprovantes' and public.app_gestao());
create policy "custos-materiais-comprovantes_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'custos-materiais-comprovantes' and public.app_gestao());

-- Bucket obra: a construtora não enxerga nem escreve em nf/comprovantes/ (comprovantes bancários nossos).
drop policy if exists obra_storage_select on storage.objects;
create policy obra_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'obra' and (
      coalesce(public.app_perfil() in ('master','direcao'), false)
      or (public.app_perfil() = 'obra_prestador'
          and (storage.foldername(name))[1] in ('checklist','documentos','entregas','bim','nf','andamento','diario')
          and name not like 'nf/comprovantes/%')
    )
  );
drop policy if exists obra_storage_insert on storage.objects;
create policy obra_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'obra' and (
      coalesce(public.app_perfil() in ('master','direcao'), false)
      or (public.app_perfil() = 'obra_prestador'
          and (storage.foldername(name))[1] in ('documentos','entregas','bim','andamento','diario','nf')
          and name not like 'nf/comprovantes/%')
    )
  );

-- ── 6 · Backup da unificação do caixa: fora da API ──────────────────────────
do $$
begin
  if to_regclass('public.fc_lancamentos_bkp_0131') is not null then
    alter table public.fc_lancamentos_bkp_0131 enable row level security;
    revoke all on public.fc_lancamentos_bkp_0131 from anon, authenticated;
  end if;
end $$;

-- ── 7 · Construtora: integridade das escritas ───────────────────────────────
-- 7a. NF não nasce "paga" e item não vai em duas NFs.
drop policy if exists obra_nf_ins on public.obra_notas_fiscais;
create policy obra_nf_ins on public.obra_notas_fiscais for insert to authenticated
  with check (
    coalesce(public.app_perfil() in ('master','direcao'), false)
    or (public.app_perfil() = 'obra_prestador'
        and status = 'emitida' and data_pagamento is null and comprovante_url is null and pago_por is null)
  );
create or replace function public.fn_obra_nf_itens_unicos()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_dup text;
begin
  select string_agg(coalesce(i->>'rotulo', i->>'id'), ', ') into v_dup
    from jsonb_array_elements(coalesce(new.itens, '[]'::jsonb)) i
   where exists (
     select 1 from public.obra_notas_fiscais n, jsonb_array_elements(coalesce(n.itens, '[]'::jsonb)) j
      where n.id <> new.id and j->>'id' = i->>'id'
   );
  if v_dup is not null then
    raise exception 'Item já faturado em outra nota fiscal: %', v_dup;
  end if;
  return new;
end $$;
drop trigger if exists trg_obra_nf_itens_unicos on public.obra_notas_fiscais;
create trigger trg_obra_nf_itens_unicos before insert or update of itens on public.obra_notas_fiscais
  for each row execute function public.fn_obra_nf_itens_unicos();

-- 7b. Autoria vem do servidor (perfil real + nome do usuário autenticado).
create or replace function public.fn_obra_autoria()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if coalesce(auth.jwt() ->> 'email', '') = '' then return new; end if;  -- SQL Editor / seeds
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  if to_jsonb(new) ? 'perfil_registrador' then
    new := jsonb_populate_record(new, jsonb_build_object('perfil_registrador', public.app_perfil()));
  end if;
  if v_nome is not null and to_jsonb(new) ? 'registrado_por' then
    new := jsonb_populate_record(new, jsonb_build_object('registrado_por', v_nome));
  end if;
  -- Construtora abre solicitação; quem responde é o Contratante.
  if tg_table_name = 'obra_solicitacoes' and public.app_perfil() = 'obra_prestador' then
    new := jsonb_populate_record(new, jsonb_build_object('resposta', null, 'respondido_por', null));
  end if;
  return new;
end $$;
do $$ declare t text;
begin
  foreach t in array array['obra_diario','obra_solicitacoes','obra_notas_fiscais'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists trg_obra_autoria on public.%I;', t);
      execute format('create trigger trg_obra_autoria before insert on public.%I for each row execute function public.fn_obra_autoria();', t);
    end if;
  end loop;
end $$;

-- 7c. Planejamento de materiais: a construtora não altera a resposta do Contratante.
create or replace function public.fn_obra_planmat_guarda()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.app_perfil() = 'obra_prestador' and (
       new.resposta is distinct from old.resposta
    or new.data_prometida is distinct from old.data_prometida
    or new.status_atendimento is distinct from old.status_atendimento
  ) then
    raise exception 'A resposta, a data prometida e o status do atendimento são do Contratante.';
  end if;
  return new;
end $$;
do $$
begin
  if to_regclass('public.obra_planejamento_materiais') is not null then
    drop trigger if exists trg_obra_planmat_guarda on public.obra_planejamento_materiais;
    create trigger trg_obra_planmat_guarda before update on public.obra_planejamento_materiais
      for each row execute function public.fn_obra_planmat_guarda();
  end if;
end $$;

-- ── 8 · Funcionais que eram só RLS ──────────────────────────────────────────
-- 8a. Direção lê o NPS (está no menu dela) e grava configuração (capacidade, notas de RH).
drop policy if exists nps_pesquisa_select on public.nps_pesquisa;
create policy nps_pesquisa_select on public.nps_pesquisa for select to authenticated using (public.app_gestao());
drop policy if exists nps_resposta_select on public.nps_resposta;
create policy nps_resposta_select on public.nps_resposta for select to authenticated using (public.app_gestao());
drop policy if exists configuracao_write on public.configuracao;
create policy configuracao_write on public.configuracao for all to authenticated
  using (public.app_gestao()) with check (public.app_gestao());

-- 8b. Médico atualiza alergias, altura e grau do hóspede (e SÓ isso);
--     nutricionista, a altura. Antes o UPDATE atingia 0 linhas sem erro e a
--     tela dizia "alergias alimentadas" — o alerta de alergia nunca disparava.
drop policy if exists residentes_update_clinico on public.residentes;
create policy residentes_update_clinico on public.residentes for update to authenticated
  using (coalesce(public.app_perfil() in ('medico','nutricionista'), false))
  with check (coalesce(public.app_perfil() in ('medico','nutricionista'), false));
create or replace function public.fn_residentes_guarda_colunas()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_perfil text := public.app_perfil();
begin
  if v_perfil = 'medico' then
    if (to_jsonb(new) - 'alergias' - 'altura_m' - 'grau_dependencia') is distinct from
       (to_jsonb(old) - 'alergias' - 'altura_m' - 'grau_dependencia') then
      raise exception 'O médico só pode alterar alergias, altura e grau de dependência.';
    end if;
  elsif v_perfil = 'nutricionista' then
    if (to_jsonb(new) - 'altura_m') is distinct from (to_jsonb(old) - 'altura_m') then
      raise exception 'A nutricionista só pode alterar a altura.';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_residentes_guarda_colunas on public.residentes;
create trigger trg_residentes_guarda_colunas before update on public.residentes
  for each row execute function public.fn_residentes_guarda_colunas();

-- 8c. Estoque por hóspede: meia dose (0,5) era arredondada para inteiro e o
--     saldo nunca baixava (e o estorno subia).
do $$
begin
  if to_regclass('public.estoque_hospede') is not null then
    alter table public.estoque_hospede
      alter column quantidade_provisionada type numeric(10,2),
      alter column quantidade_atual type numeric(10,2);
  end if;
end $$;

-- ── 2 · EXECUTE só para autenticados (anon só nas funções de agenda/solicitação)
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as assinatura, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke execute on function %s from public, anon', r.assinatura);
    execute format('grant execute on function %s to authenticated', r.assinatura);
  end loop;
end $$;
-- Funções que a agenda pública e o "esqueci a senha" usam sem login.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as assinatura
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'app_perfil','app_usuario_id','app_residente_familia','app_residente_vinculado',
      'app_equipe_interna','app_equipe_clinica','app_gestao',
      'visitas_slots_livres','solicitar_reset_senha','solicitar_acesso'
    )
  loop
    execute format('grant execute on function %s to anon', r.assinatura);
  end loop;
end $$;
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;


-- ── Conferência ─────────────────────────────────────────────────────────────
do $$
declare v_anon int; v_null int;
begin
  select count(*) into v_anon
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f'
     and has_function_privilege('anon', p.oid, 'execute')
     and p.proname not in ('app_perfil','app_usuario_id','app_residente_familia','app_residente_vinculado',
                           'app_equipe_interna','app_equipe_clinica','app_gestao',
                           'visitas_slots_livres','solicitar_reset_senha','solicitar_acesso');
  raise notice 'Funções ainda executáveis por anon fora da lista: % (esperado 0).', v_anon;
  select count(*) into v_null from pg_policies where schemaname = 'public'
     and (coalesce(qual,'') like '%<> ''familia''%' or coalesce(with_check,'') like '%<> ''familia''%');
  raise notice 'Policies "não é família" restantes: % (esperado 0).', v_null;
end $$;

-- Fim.
