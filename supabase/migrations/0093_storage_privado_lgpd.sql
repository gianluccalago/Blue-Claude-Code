-- ===========================================================================
-- 0093 — AUDITORIA LGPD: torna PRIVADOS os buckets com foto de idoso / anexos.
-- ---------------------------------------------------------------------------
-- Achado CRÍTICO: buckets `public=true` servem o objeto SEM autenticação e sem
-- expiração — foto de idoso/comprovante acessível por qualquer um que tenha a
-- URL. Aqui:
--   1. Vira `public=false` os buckets sensíveis (e cria o de intercorrência,
--      que nunca existiu → upload falhava em silêncio).
--   2. Cria policies de `storage.objects` restringindo LEITURA/ESCRITA a
--      usuários AUTENTICADOS (a chave anônima do site perde o acesso).
--
-- A aplicação passou a gravar o CAMINHO do objeto (não URL pública) e a exibir
-- por URL ASSINADA temporária (createSignedUrl) — ver src/lib/storage.ts.
--
-- Observação: mantém-se leitura para qualquer autenticado (a família precisa da
-- foto do seu hóspede e das atividades; a equipe, dos demais anexos). O recorte
-- por perfil já é feito nas tabelas de dados que guardam o caminho — quem não
-- recebe o caminho não consegue assinar a URL. Idempotente.
-- ===========================================================================

-- 1) Buckets → privados (cria se não existir; garante public=false)
insert into storage.buckets (id, name, public) values
  ('residentes-fotos','residentes-fotos', false),
  ('usuarios-fotos','usuarios-fotos', false),
  ('manutencao-fotos','manutencao-fotos', false),
  ('atividades-fotos','atividades-fotos', false),
  ('upselling-comprovantes','upselling-comprovantes', false),
  ('intercorrencias-fotos','intercorrencias-fotos', false),
  ('custos-materiais-comprovantes','custos-materiais-comprovantes', false)
on conflict (id) do update set public = false;

-- 2a) DERRUBA as policies LEGADAS (incluem LEITURA PÚBLICA — o furo LGPD).
--     Os nomes vêm das migrations 0020/0023/0026/0033/0034/0072.
do $$
declare p text;
begin
  foreach p in array array[
    -- residentes-fotos (0033) — tinha leitura PÚBLICA
    'residentes_fotos_leitura_publica','residentes_fotos_escrita_autenticada','residentes_fotos_update_autenticada',
    -- usuarios-fotos (0034) — tinha leitura PÚBLICA
    'usuarios_fotos_leitura_publica','usuarios_fotos_escrita_autenticada','usuarios_fotos_update_autenticada',
    -- manutencao-fotos (0020)
    'manutencao_fotos_select','manutencao_fotos_insert','manutencao_fotos_update','manutencao_fotos_delete',
    -- atividades-fotos (0023)
    'atividades_fotos_select','atividades_fotos_insert','atividades_fotos_update','atividades_fotos_delete',
    -- upselling-comprovantes (0026)
    'upselling_comprovantes_select','upselling_comprovantes_insert','upselling_comprovantes_update','upselling_comprovantes_delete',
    -- custos-materiais (0072)
    'custos_materiais_select','custos_materiais_insert','custos_materiais_update','custos_materiais_delete'
  ] loop
    execute format('drop policy if exists %I on storage.objects;', p);
  end loop;
end $$;

-- 2b) Policies novas: só AUTENTICADO acessa (anon perde tudo).
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

    execute format(
      'create policy %I on storage.objects for select to authenticated using (bucket_id = %L);',
      b || '_select', b);
    execute format(
      'create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L);',
      b || '_insert', b);
    execute format(
      'create policy %I on storage.objects for update to authenticated using (bucket_id = %L) with check (bucket_id = %L);',
      b || '_update', b, b);
    execute format(
      'create policy %I on storage.objects for delete to authenticated using (bucket_id = %L);',
      b || '_delete', b);
  end loop;
end $$;

-- Fim.
