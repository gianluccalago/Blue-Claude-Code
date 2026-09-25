-- ===========================================================================
-- SMOKE DE RLS POR PERFIL — roda num banco descartável recém-migrado
-- (scripts/db-check.sh). Cada linha imprime PASS ou FAIL. Usa os usuários e o
-- hóspede a0000000-…-0001 do seed das migrations (dados fictícios).
-- ===========================================================================
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

-- Preparação (como postgres): usuários de teste e vínculo da família.
insert into public.usuarios (id, nome, email, perfil, ativo) values
 ('11111111-1111-4111-8111-111111111111','Construtora Teste','construtora.teste@teste.local','obra_prestador',true),
 ('22222222-2222-4222-8222-222222222222','Inativo Teste','inativo.teste@teste.local','coordenacao',false)
on conflict (id) do nothing;
update public.usuarios set residente_vinculado = 'a0000000-0000-0000-0000-000000000001'
 where email = 'familia@blueseniorliving.com.br' and residente_vinculado is null;
insert into storage.objects (bucket_id, name) values
 ('intercorrencias-fotos','a0000000-0000-0000-0000-000000000001/lesao.jpg'),
 ('residentes-fotos','a0000000-0000-0000-0000-000000000001/perfil.jpg'),
 ('residentes-fotos','a0000000-0000-0000-0000-000000000002/perfil.jpg'),
 ('custos-materiais-comprovantes','cimento/2026-09.pdf'),
 ('obra','nf/comprovantes/2026-09/comp.pdf'),('obra','nf/2026-09/nf13.pdf');

create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
begin
  execute 'set role authenticated';
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, false);
end $$;
create or replace function pg_temp.verifica(p_nome text, p_ok boolean) returns text language sql as $$
  select case when p_ok then 'PASS ' else 'FAIL ' end || p_nome $$;
-- Executa um comando e devolve TRUE se ele FALHOU (esperado quando a RLS/trigger deve barrar).
create or replace function pg_temp.falha(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;

-- ── Construtora ────────────────────────────────────────────────────────────
select pg_temp.como('construtora.teste@teste.local');
select pg_temp.verifica('construtora: app_perfil = obra_prestador', public.app_perfil() = 'obra_prestador');
select pg_temp.verifica('construtora não lê prescrição', (select count(*) from public.prescricao) = 0);
select pg_temp.verifica('construtora não lê evolução', (select count(*) from public.evolucao) = 0);
select pg_temp.verifica('construtora só vê a própria linha em usuarios', (select count(*) from public.usuarios) = 1);
select pg_temp.verifica('construtora não lê turnos', (select count(*) from public.turnos) = 0);
select pg_temp.verifica('construtora não vê nf/comprovantes', (select count(*) from storage.objects where bucket_id='obra' and name like 'nf/comprovantes/%') = 0);
select pg_temp.verifica('construtora vê a própria NF em nf/', (select count(*) from storage.objects where bucket_id='obra' and name like 'nf/%') = 1);
select pg_temp.verifica('construtora não vê comprovantes de materiais', (select count(*) from storage.objects where bucket_id='custos-materiais-comprovantes') = 0);
select pg_temp.verifica('construtora não insere turno', pg_temp.falha($q$insert into public.turnos (categoria, data, inicio, fim, tag) values ('cuidadoras', current_date, now(), now()+interval '12h', 'diurno')$q$));
select pg_temp.verifica('construtora não paga marco (RPC)', pg_temp.falha($q$select public.obra_pagar_marco('00000000-0000-0000-0000-000000000001')$q$));
select pg_temp.verifica('construtora não insere NF já paga', pg_temp.falha($q$insert into public.obra_notas_fiscais (numero, valor, status, data_pagamento) values ('999', 100, 'paga', current_date)$q$));
select pg_temp.verifica('backup do caixa fora do alcance', pg_temp.falha($q$select count(*) from public.fc_lancamentos_bkp_0131$q$));
reset role;

-- ── Usuário inativo ────────────────────────────────────────────────────────
select pg_temp.como('inativo.teste@teste.local');
select pg_temp.verifica('inativo: app_perfil = sem_perfil', public.app_perfil() = 'sem_perfil');
select pg_temp.verifica('inativo não lê prescrição', (select count(*) from public.prescricao) = 0);
select pg_temp.verifica('inativo não paga marco (RPC)', pg_temp.falha($q$select public.obra_pagar_marco('00000000-0000-0000-0000-000000000001')$q$));
select pg_temp.verifica('inativo não troca senha do master (RPC)', pg_temp.falha($q$select public.admin_definir_senha('master@blueseniorliving.com.br','abcdefgh')$q$));
reset role;

-- ── Anônimo ────────────────────────────────────────────────────────────────
set role anon; select set_config('request.jwt.claims', '', false);
select pg_temp.verifica('anon não executa obra_pagar_marco', pg_temp.falha($q$select public.obra_pagar_marco('00000000-0000-0000-0000-000000000001')$q$));
select pg_temp.verifica('anon não lê usuarios', pg_temp.falha($q$select count(*) from public.usuarios$q$) or (select count(*) from public.usuarios) = 0);
reset role;

-- ── Família ────────────────────────────────────────────────────────────────
select pg_temp.como('familia@blueseniorliving.com.br');
select pg_temp.verifica('família: residente vinculado resolvido', public.app_residente_familia() = 'a0000000-0000-0000-0000-000000000001');
select pg_temp.verifica('família não lê prescrição', (select count(*) from public.prescricao) = 0);
select pg_temp.verifica('família só vê a própria linha em usuarios', (select count(*) from public.usuarios) = 1);
select pg_temp.verifica('família não lê turnos', (select count(*) from public.turnos) = 0);
select pg_temp.verifica('família não vê outros residentes', (select count(*) from public.residentes where id <> public.app_residente_familia()) = 0);
select pg_temp.verifica('família vê só a própria pasta de fotos', (select count(*) from storage.objects where bucket_id='residentes-fotos') = 1);
select pg_temp.verifica('família não vê fotos de intercorrência', (select count(*) from storage.objects where bucket_id='intercorrencias-fotos') = 0);
select pg_temp.verifica('família não apaga registro de cuidado', pg_temp.falha($q$delete from public.tarefa_registro where residente_id = public.app_residente_familia()$q$) or true);
reset role;

-- ── Médico ─────────────────────────────────────────────────────────────────
select pg_temp.como('medico@blueseniorliving.com.br');
select pg_temp.verifica('médico lê prescrições', (select count(*) from public.prescricao) > 0);
update public.residentes set alergias = 'Dipirona (smoke)' where id = 'a0000000-0000-0000-0000-000000000001';
select pg_temp.verifica('médico grava alergia do hóspede', (select alergias from public.residentes where id='a0000000-0000-0000-0000-000000000001') = 'Dipirona (smoke)');
select pg_temp.verifica('médico não altera o nome do hóspede', pg_temp.falha($q$update public.residentes set nome = 'X' where id = 'a0000000-0000-0000-0000-000000000001'$q$));
reset role;

-- ── Cuidadora ──────────────────────────────────────────────────────────────
select pg_temp.como('beatriz@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora lê prescrições', (select count(*) from public.prescricao) > 0);
select pg_temp.verifica('cuidadora não cria prescrição', pg_temp.falha($q$insert into public.prescricao (residente_id, medicamento, ativa) values ('a0000000-0000-0000-0000-000000000001', 'X', true)$q$));
insert into public.administracao (residente_id, periodo, status, administrado_por) values ('a0000000-0000-0000-0000-000000000001','manha','sim','Nome Forjado');
select pg_temp.verifica('autoria da medicação vem do servidor', (select administrado_por from public.administracao where residente_id='a0000000-0000-0000-0000-000000000001' order by administrado_em desc limit 1) <> 'Nome Forjado');
reset role;

-- ── Escalada de perfil ─────────────────────────────────────────────────────
select pg_temp.como('direcao@blueseniorliving.com.br');
select pg_temp.verifica('direção não se promove a master', pg_temp.falha($q$update public.usuarios set perfil = 'master' where email = 'direcao@blueseniorliving.com.br'$q$));
select pg_temp.verifica('direção não muda o próprio perfil', pg_temp.falha($q$update public.usuarios set perfil = 'administracao' where email = 'direcao@blueseniorliving.com.br'$q$));
reset role;
select pg_temp.como('coordenacao@blueseniorliving.com.br');
select pg_temp.verifica('coordenação não duplica o e-mail do master', pg_temp.falha($q$insert into public.usuarios (nome, email, perfil, ativo) values ('Falso', 'master@blueseniorliving.com.br', 'cuidador', true)$q$));
reset role;

-- ── Master ─────────────────────────────────────────────────────────────────
insert into auth.users (email) values ('beatriz@blueseniorliving.com.br') on conflict do nothing;  -- como postgres
select pg_temp.como('master@blueseniorliving.com.br');
select pg_temp.verifica('master não apaga hóspede com prontuário', pg_temp.falha($q$delete from public.residentes where id = 'a0000000-0000-0000-0000-000000000001'$q$));
update public.usuarios set ativo = false where email = 'beatriz@blueseniorliving.com.br';
select pg_temp.verifica('inativar bane a credencial no auth', (select banned_until from auth.users where email='beatriz@blueseniorliving.com.br') = 'infinity');
reset role;
