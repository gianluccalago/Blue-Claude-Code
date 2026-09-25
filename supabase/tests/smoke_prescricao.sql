-- ===========================================================================
-- SMOKE DAS RPCs DE PRESCRIÇÃO E ADMISSÃO (migration 0135) — roda num banco
-- descartável recém-migrado (scripts/db-check.sh). Cada linha imprime PASS ou
-- FAIL. Usa o médico, a cuidadora e o hóspede a0000000-…-0001 do seed.
-- Cobre: edição com linha inválida mantém a antiga ATIVA e intacta; a mesma
-- chave de idempotência não duplica; admissão com falha no meio não deixa
-- prescrição gravada; admissão repetida no mesmo dia não duplica; cuidadora
-- não chama as RPCs; suspensão preserva o histórico (sem DELETE).
-- ===========================================================================
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
begin
  execute 'set role authenticated';
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, false);
end $$;
create or replace function pg_temp.verifica(p_nome text, p_ok boolean) returns text language sql as $$
  select case when p_ok then 'PASS ' else 'FAIL ' end || p_nome $$;
-- Executa um comando e devolve TRUE se ele FALHOU (esperado quando a RPC deve barrar).
create or replace function pg_temp.falha(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;

-- ── Médico: criar ──────────────────────────────────────────────────────────
select pg_temp.como('medico@blueseniorliving.com.br');

select public.criar_prescricao(
  '{"residente_id":"a0000000-0000-0000-0000-000000000001","medicamento":"  smoke   losartana ","dose":"50mg","via":"oral","posologia":"12/12h",
    "periodos":[{"periodo":"manha","quantidade":"1 comprimido"},{"periodo":"noite","quantidade":"1 comprimido"}],
    "grupo_prescricao":"c0000000-0000-4000-8000-000000000001"}'::jsonb,
  'c0000000-0000-4000-8000-0000000000a1'::uuid);
select pg_temp.verifica('criar: 2 linhas ativas no grupo, nome normalizado',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001' and ativa and medicamento='SMOKE LOSARTANA') = 2);
select pg_temp.verifica('criar: prescrito_por = médico autenticado',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001' and prescrito_por = public.app_usuario_id()) = 2);

-- Mesma chave de novo: devolve o mesmo resultado e NÃO grava de novo.
select public.criar_prescricao(
  '{"residente_id":"a0000000-0000-0000-0000-000000000001","medicamento":"SMOKE LOSARTANA","via":"oral","posologia":"12/12h",
    "periodos":[{"periodo":"manha","quantidade":"1 comprimido"},{"periodo":"noite","quantidade":"1 comprimido"}],
    "grupo_prescricao":"c0000000-0000-4000-8000-000000000001"}'::jsonb,
  'c0000000-0000-4000-8000-0000000000a1'::uuid);
select pg_temp.verifica('criar: repetir a mesma chave não duplica',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001') = 2);
select pg_temp.verifica('criar: quantidade em branco é recusada (CLI-13)', pg_temp.falha($q$
  select public.criar_prescricao('{"residente_id":"a0000000-0000-0000-0000-000000000001","medicamento":"SMOKE SEM QTD","via":"oral",
    "periodos":[{"periodo":"manha","quantidade":"  "}]}'::jsonb, gen_random_uuid())$q$));
select pg_temp.verifica('criar: sem quantidade nada fica gravado',
  (select count(*) from public.prescricao where medicamento='SMOKE SEM QTD') = 0);

-- ── Médico: editar com linha inválida → antiga ATIVA e intacta ─────────────
select pg_temp.verifica('editar: linha inválida (período inexistente) falha', pg_temp.falha($q$
  select public.editar_prescricao('c0000000-0000-4000-8000-000000000001',
    '{"residente_id":"a0000000-0000-0000-0000-000000000001","medicamento":"SMOKE LOSARTANA","via":"oral","posologia":"8/8h",
      "periodos":[{"periodo":"manha","quantidade":"1"},{"periodo":"madrugada","quantidade":"1"}]}'::jsonb, gen_random_uuid())$q$));
select pg_temp.verifica('editar: após falha a prescrição antiga segue ATIVA (2 linhas)',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001' and ativa) = 2);
select pg_temp.verifica('editar: após falha nada novo foi gravado no grupo',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001') = 2);
select pg_temp.verifica('editar: após falha as linhas antigas estão intactas (dose/periodos)',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001' and ativa and dose='50mg' and periodo in ('manha','noite')) = 2);

-- Edição válida: novas entram, antigas ficam com ativa=false (histórico).
select public.editar_prescricao('c0000000-0000-4000-8000-000000000001',
  '{"residente_id":"a0000000-0000-0000-0000-000000000001","medicamento":"SMOKE LOSARTANA","dose":"100mg","via":"oral","posologia":"8/8h",
    "periodos":[{"periodo":"manha","quantidade":"1"},{"periodo":"almoco","quantidade":"1"},{"periodo":"noite","quantidade":"1"}]}'::jsonb,
  'c0000000-0000-4000-8000-0000000000a2'::uuid);
select pg_temp.verifica('editar: 3 novas linhas ativas',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001' and ativa and dose='100mg') = 3);
select pg_temp.verifica('editar: antigas preservadas com ativa=false (nunca DELETE)',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001' and not ativa and dose='50mg' and suspensa_em is not null) = 2);
select public.editar_prescricao('c0000000-0000-4000-8000-000000000001',
  '{"residente_id":"a0000000-0000-0000-0000-000000000001","medicamento":"SMOKE LOSARTANA","dose":"100mg","via":"oral","posologia":"8/8h",
    "periodos":[{"periodo":"manha","quantidade":"1"},{"periodo":"almoco","quantidade":"1"},{"periodo":"noite","quantidade":"1"}]}'::jsonb,
  'c0000000-0000-4000-8000-0000000000a2'::uuid);
select pg_temp.verifica('editar: repetir a mesma chave não duplica nem suspende de novo',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001') = 5
  and (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001' and ativa) = 3);
select pg_temp.verifica('editar: grupo de outro hóspede é recusado', pg_temp.falha($q$
  select public.editar_prescricao('c0000000-0000-4000-8000-000000000001',
    '{"residente_id":"a0000000-0000-0000-0000-000000000002","medicamento":"X","via":"oral","periodos":[{"periodo":"manha","quantidade":"1"}]}'::jsonb, gen_random_uuid())$q$));

-- ── Médico: suspender ──────────────────────────────────────────────────────
select public.suspender_prescricao('c0000000-0000-4000-8000-000000000001', 'smoke: suspensa', 'c0000000-0000-4000-8000-0000000000a3'::uuid);
select pg_temp.verifica('suspender: nenhuma linha ativa, 5 no histórico',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001' and ativa) = 0
  and (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001') = 5);
select pg_temp.verifica('suspender: motivo gravado nas linhas suspensas agora',
  (select count(*) from public.prescricao where grupo_prescricao='c0000000-0000-4000-8000-000000000001' and suspensa_motivo='smoke: suspensa') = 3);
select pg_temp.verifica('editar grupo já suspenso é recusado', pg_temp.falha($q$
  select public.editar_prescricao('c0000000-0000-4000-8000-000000000001',
    '{"medicamento":"SMOKE LOSARTANA","via":"oral","periodos":[{"periodo":"manha","quantidade":"1"}]}'::jsonb, gen_random_uuid())$q$));

-- ── Médico: admissão com falha no meio → nada gravado ──────────────────────
select pg_temp.verifica('admissão: 2ª medicação inválida faz a RPC falhar', pg_temp.falha($q$
  select public.registrar_admissao('{"residente_id":"a0000000-0000-0000-0000-000000000001","texto_evolucao":"EVOLUÇÃO DE ADMISSÃO (smoke falha)",
    "dados":{"dataAdmissao":"2026-09-01","comorbidades":["Smoke HAS"],"alergias":"","peso":"70,5","altura":"1,70",
      "medicacoes":[{"medicamento":"SMOKE ADM OK","dose":"","via":"oral","posologia":"1x/dia","periodos":["manha"],"quantidade":"1 comprimido"},
                    {"medicamento":"SMOKE ADM RUIM","dose":"","via":"oral","posologia":"1x/dia","periodos":["manha"],"quantidade":""}]}}'::jsonb,
    'c0000000-0000-4000-8000-0000000000b1'::uuid)$q$));
select pg_temp.verifica('admissão com falha: nenhuma prescrição gravada',
  (select count(*) from public.prescricao where medicamento like 'SMOKE ADM%') = 0);
select pg_temp.verifica('admissão com falha: nenhum documento nem evolução',
  (select count(*) from public.evolucao_admissao where residente_id='a0000000-0000-0000-0000-000000000001') = 0
  and (select count(*) from public.evolucao where texto like 'EVOLUÇÃO DE ADMISSÃO (smoke%') = 0);
select pg_temp.verifica('admissão com falha: patologia e peso desfeitos',
  (select count(*) from public.patologia_residente where residente_id='a0000000-0000-0000-0000-000000000001' and descricao='Smoke HAS') = 0
  and (select count(*) from public.registro_peso where residente_id='a0000000-0000-0000-0000-000000000001' and peso_kg=70.5) = 0);
-- A chave de uma tentativa que falhou não fica consumida: repetir com ela
-- executa de novo (e falha de novo), em vez de devolver um "sucesso" guardado.
select pg_temp.verifica('admissão com falha: chave não foi consumida (repetir falha de novo)', pg_temp.falha($q$
  select public.registrar_admissao('{"residente_id":"a0000000-0000-0000-0000-000000000001",
    "dados":{"medicacoes":[{"medicamento":"SMOKE ADM RUIM","via":"oral","periodos":["manha"],"quantidade":""}]}}'::jsonb,
    'c0000000-0000-4000-8000-0000000000b1'::uuid)$q$));

-- ── Médico: admissão válida + repetições ───────────────────────────────────
select public.registrar_admissao('{"residente_id":"a0000000-0000-0000-0000-000000000001","texto_evolucao":"EVOLUÇÃO DE ADMISSÃO (smoke ok)",
  "dados":{"dataAdmissao":"2026-09-01","comorbidades":["Smoke HAS","smoke  has"],"alergias":"Smoke alergia","peso":"70,5","altura":"1,70",
    "medicacoes":[{"medicamento":"smoke adm ok","dose":"25mg","via":"oral","posologia":"12/12h","periodos":["manha","noite"],"quantidade":"1 comprimido"}]}}'::jsonb,
  'c0000000-0000-4000-8000-0000000000b2'::uuid);
select pg_temp.verifica('admissão: documento criado com médico/CRM do servidor',
  (select count(*) from public.evolucao_admissao where residente_id='a0000000-0000-0000-0000-000000000001' and medico_id=public.app_usuario_id() and prescricoes_geradas) = 1);
select pg_temp.verifica('admissão: prescrição gerada (2 linhas, 1 grupo)',
  (select count(*) from public.prescricao where medicamento='SMOKE ADM OK' and ativa) = 2
  and (select count(distinct grupo_prescricao) from public.prescricao where medicamento='SMOKE ADM OK') = 1);
select pg_temp.verifica('admissão: comorbidade deduplicada (1 patologia)',
  (select count(*) from public.patologia_residente where residente_id='a0000000-0000-0000-0000-000000000001' and lower(descricao) like 'smoke%has') = 1);
select pg_temp.verifica('admissão: peso, altura, alergia e evolução gravados',
  (select count(*) from public.registro_peso where residente_id='a0000000-0000-0000-0000-000000000001' and peso_kg=70.5 and imc=24.4 and observacao='Peso de admissão') = 1
  and (select altura_m from public.residentes where id='a0000000-0000-0000-0000-000000000001') = 1.70
  and (select alergias from public.residentes where id='a0000000-0000-0000-0000-000000000001') = 'Smoke alergia'
  and (select count(*) from public.evolucao where texto='EVOLUÇÃO DE ADMISSÃO (smoke ok)') = 1);
select pg_temp.verifica('admissão: autoria do peso vem do servidor',
  (select registrado_por from public.registro_peso where residente_id='a0000000-0000-0000-0000-000000000001' and peso_kg=70.5) = (select nome from public.usuarios where id=public.app_usuario_id()));

-- Mesma chave: nada muda.
select public.registrar_admissao('{"residente_id":"a0000000-0000-0000-0000-000000000001","texto_evolucao":"EVOLUÇÃO DE ADMISSÃO (smoke ok)",
  "dados":{"dataAdmissao":"2026-09-01","comorbidades":["Smoke HAS"],"alergias":"Smoke alergia","peso":"70,5","altura":"1,70",
    "medicacoes":[{"medicamento":"smoke adm ok","dose":"25mg","via":"oral","posologia":"12/12h","periodos":["manha","noite"],"quantidade":"1 comprimido"}]}}'::jsonb,
  'c0000000-0000-4000-8000-0000000000b2'::uuid);
-- Chave nova, mesmo hóspede, mesmo dia: cai na edição do documento.
select public.registrar_admissao('{"residente_id":"a0000000-0000-0000-0000-000000000001","texto_evolucao":"EVOLUÇÃO DE ADMISSÃO (smoke ok)",
  "dados":{"dataAdmissao":"2026-09-01","comorbidades":["Smoke HAS"],"alergias":"Smoke alergia","peso":"70,5","altura":"1,70","hma":"editado",
    "medicacoes":[{"medicamento":"smoke adm ok","dose":"25mg","via":"oral","posologia":"12/12h","periodos":["manha","noite"],"quantidade":"1 comprimido"}]}}'::jsonb,
  gen_random_uuid());
select pg_temp.verifica('admissão repetida (mesma chave e chave nova no mesmo dia) não duplica prescrição',
  (select count(*) from public.prescricao where medicamento='SMOKE ADM OK') = 2);
select pg_temp.verifica('admissão repetida não duplica documento, peso nem evolução',
  (select count(*) from public.evolucao_admissao where residente_id='a0000000-0000-0000-0000-000000000001') = 1
  and (select count(*) from public.registro_peso where residente_id='a0000000-0000-0000-0000-000000000001' and peso_kg=70.5) = 1
  and (select count(*) from public.evolucao where texto='EVOLUÇÃO DE ADMISSÃO (smoke ok)') = 1);
select pg_temp.verifica('admissão repetida no mesmo dia atualiza o documento',
  (select dados->>'hma' from public.evolucao_admissao where residente_id='a0000000-0000-0000-0000-000000000001') = 'editado');
select pg_temp.verifica('admissão: existente_id de outro hóspede é recusado', pg_temp.falha($q$
  select public.registrar_admissao(jsonb_build_object('residente_id','a0000000-0000-0000-0000-000000000002','existente_id',
    (select id from public.evolucao_admissao where residente_id='a0000000-0000-0000-0000-000000000001'),'dados','{}'::jsonb), gen_random_uuid())$q$));
reset role;

-- ── Cuidadora: nenhuma RPC ─────────────────────────────────────────────────
select pg_temp.como('beatriz@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora não cria prescrição (RPC)', pg_temp.falha($q$
  select public.criar_prescricao('{"residente_id":"a0000000-0000-0000-0000-000000000001","medicamento":"SMOKE CUIDADORA","via":"oral","periodos":[{"periodo":"manha","quantidade":"1"}]}'::jsonb, gen_random_uuid())$q$));
select pg_temp.verifica('cuidadora não edita prescrição (RPC)', pg_temp.falha($q$
  select public.editar_prescricao((select grupo_prescricao from public.prescricao where medicamento='SMOKE ADM OK' limit 1),
    '{"medicamento":"SMOKE ADM OK","via":"oral","periodos":[{"periodo":"manha","quantidade":"1"}]}'::jsonb, gen_random_uuid())$q$));
select pg_temp.verifica('cuidadora não suspende prescrição (RPC)', pg_temp.falha($q$
  select public.suspender_prescricao((select grupo_prescricao from public.prescricao where medicamento='SMOKE ADM OK' limit 1), null, gen_random_uuid())$q$));
select pg_temp.verifica('cuidadora não registra admissão (RPC)', pg_temp.falha($q$
  select public.registrar_admissao('{"residente_id":"a0000000-0000-0000-0000-000000000001","dados":{}}'::jsonb, gen_random_uuid())$q$));
select pg_temp.verifica('cuidadora não lê a tabela de idempotência', pg_temp.falha($q$select count(*) from public.operacao_idempotente$q$));
select pg_temp.verifica('cuidadora não chama os helpers internos', pg_temp.falha($q$select public.fn_idempotente_guardar(gen_random_uuid(), '{}'::jsonb)$q$));
reset role;
-- Conferência como postgres (sem RLS): nada mudou com as tentativas da cuidadora.
select pg_temp.verifica('cuidadora: nada gravado pelas tentativas',
  (select count(*) from public.prescricao where medicamento='SMOKE CUIDADORA') = 0
  and (select count(*) from public.prescricao where medicamento='SMOKE ADM OK' and ativa) = 2);

-- ── Anônimo ────────────────────────────────────────────────────────────────
set role anon; select set_config('request.jwt.claims', '', false);
select pg_temp.verifica('anon não executa criar_prescricao', pg_temp.falha($q$
  select public.criar_prescricao('{"residente_id":"a0000000-0000-0000-0000-000000000001","medicamento":"X","via":"oral","periodos":[{"periodo":"manha","quantidade":"1"}]}'::jsonb, gen_random_uuid())$q$));
select pg_temp.verifica('anon não executa registrar_admissao', pg_temp.falha($q$
  select public.registrar_admissao('{"residente_id":"a0000000-0000-0000-0000-000000000001","dados":{}}'::jsonb, gen_random_uuid())$q$));
reset role;
