-- ============================================================================
-- Blue Senior Living — Migration 0008
-- Módulo de Escalas (ETAPA 1): cadastro de profissionais.
-- As profissionais de escala SÃO os usuarios do sistema (sem tabela paralela);
-- aqui apenas estendemos a tabela usuarios. É tudo ADITIVO.
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

-- 1. Novos campos de escala (todos nullable, exceto isento com default).
alter table usuarios add column if not exists funcao text;                 -- Cuidadora | Técnica de Enfermagem | Enfermeira
alter table usuarios add column if not exists vinculo text;                -- CLT | PJ
alter table usuarios add column if not exists registro_profissional text;  -- COREN p/ enfermagem
alter table usuarios add column if not exists isento_ponto_app boolean not null default true;

-- 2. Permitir o perfil "enfermagem" (usado pelas funções de enfermagem).
--    A constraint inline criada em 0001 chama-se usuarios_perfil_check.
alter table usuarios drop constraint if exists usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check check (perfil in
  ('master','medico','coordenacao','cuidador','enfermagem','multidisciplinar','farmacia','administracao','familia'));

-- 3. Atualiza Ana Paula (já existe) em vez de duplicar.
update usuarios
  set funcao = 'Cuidadora', vinculo = 'CLT', isento_ponto_app = true
  where id = 'b0000000-0000-0000-0000-000000000004';

-- 4. Profissionais de teste (idempotente via on conflict no id).
insert into usuarios (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, isento_ponto_app) values
  ('b0000000-0000-0000-0000-000000000009','Mariana Souza','mariana@blueseniorliving.com.br','cuidador',true,'Cuidadora','CLT',null,true),
  ('b0000000-0000-0000-0000-000000000010','Joana Ribeiro','joana@blueseniorliving.com.br','cuidador',true,'Cuidadora','CLT',null,true),
  ('b0000000-0000-0000-0000-000000000011','Beatriz Lima','beatriz@blueseniorliving.com.br','cuidador',true,'Cuidadora','PJ',null,false),
  ('b0000000-0000-0000-0000-000000000012','Enf. Carla Mendes','carla@blueseniorliving.com.br','enfermagem',true,'Enfermeira','CLT','COREN-SP 123456',true),
  ('b0000000-0000-0000-0000-000000000013','Téc. Patrícia Gomes','patricia.tec@blueseniorliving.com.br','enfermagem',true,'Técnica de Enfermagem','CLT','COREN-SP 654321',true)
on conflict (id) do nothing;

-- Fim.
