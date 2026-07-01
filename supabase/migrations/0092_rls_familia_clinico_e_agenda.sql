-- ===========================================================================
-- 0092 — AUDITORIA DE SEGURANÇA: fechar acesso da FAMÍLIA a dados clínicos crus
-- e endurecer o insert anônimo da agenda de visitas.
-- ---------------------------------------------------------------------------
-- CONTEXTO (auditoria RLS): as tabelas assistenciais criadas na 0001 ficaram
-- com a policy `auth_all` (qualquer autenticado) desde a 0030 e NUNCA foram
-- reescopadas para excluir a família — ao contrário das clínicas mais novas
-- (registro_peso 0064, patologia 0088, teste_cognitivo 0091), que já barram a
-- família. Resultado: um usuário-família autenticado consegue LER, via API
-- direta (chave anônima + JWT), a medicação, eliminações, intercorrências e
-- pendências de TODOS os hóspedes — dado clínico sensível (LGPD).
--
-- O portal da família NÃO consome estas tabelas (só bem-estar: recados,
-- participações, compromissos, fotos, aceitação de refeição). Logo, barrar a
-- família NÃO muda o comportamento visível do app — só fecha o vazamento.
--
-- Mudanças:
--  1. staff_only (app_perfil <> 'familia') em: administracao, eliminacao,
--     eliminacao_tratamento, pendencia_tratamento, intercorrencia.
--  2. tarefa_registro: a família continua LENDO/o portal usa a aceitação de
--     refeição, mas ESCOPADA ao seu próprio residente (não a casa inteira).
--  3. visita_agendamento (insert anônimo do site): limites de tamanho por
--     coluna — defesa contra payload gigante/poluição via a chave pública.
--
-- Idempotente. Rode DEPOIS da 0030/0058/0080.
-- ===========================================================================

-- 1) CLÍNICO/OPERACIONAL invisível à família (mesmo padrão da 0032 staff_only)
do $$ declare t text;
begin
  foreach t in array array[
    'administracao','eliminacao','eliminacao_tratamento',
    'pendencia_tratamento','intercorrencia'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('alter table public.%I enable row level security;', t);
      execute format('drop policy if exists demo_all on public.%I;', t);
      execute format('drop policy if exists auth_all on public.%I;', t);
      execute format('drop policy if exists staff_only on public.%I;', t);
      execute format(
        'create policy staff_only on public.%I for all to authenticated '
        || 'using (public.app_perfil() <> ''familia'') '
        || 'with check (public.app_perfil() <> ''familia'');', t);
    end if;
  end loop;
end $$;

-- 2) tarefa_registro: staff = total; família só o SEU residente (o portal lê a
--    aceitação de refeição do próprio hóspede — comportamento preservado).
do $$
begin
  if to_regclass('public.tarefa_registro') is not null then
    alter table public.tarefa_registro enable row level security;
    drop policy if exists demo_all on public.tarefa_registro;
    drop policy if exists auth_all on public.tarefa_registro;
    drop policy if exists tarefa_registro_scope on public.tarefa_registro;
    create policy tarefa_registro_scope on public.tarefa_registro for all to authenticated
      using (public.app_perfil() <> 'familia' or residente_id = public.app_residente_familia())
      with check (public.app_perfil() <> 'familia');
  end if;
end $$;

-- 3) AGENDA DE VISITAS (anon): limites de tamanho por coluna. A RLS/coluna já
--    restringe QUEM e QUAIS colunas; aqui limitamos o TAMANHO para conter
--    payloads absurdos inseridos direto pela API com a chave pública.
do $$
begin
  if to_regclass('public.visita_agendamento') is not null then
    alter table public.visita_agendamento drop constraint if exists visita_agend_tamanhos_chk;
    alter table public.visita_agendamento add constraint visita_agend_tamanhos_chk check (
      char_length(nome_completo) <= 120
      and (whatsapp is null or char_length(whatsapp) <= 25)
      and (email is null or char_length(email) <= 150)
      and (observacao is null or char_length(observacao) <= 600)
    );
  end if;
end $$;

-- Fim.
