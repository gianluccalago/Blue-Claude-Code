-- ============================================================================
-- Blue Senior Living — Migration 0013
-- MASTER-3: Gestão de usuários e acessos (fundação da autenticação).
--
-- Estende a tabela `usuarios` (NÃO cria tabela paralela) para que o Master
-- possa criar/editar/ativar todos os usuários de todos os perfis. É a base do
-- login que será ligado em seguida: o EMAIL será o identificador de login e
-- cada usuário cairá direto no seu perfil. Tudo aqui é ADITIVO e não quebra
-- quem referencia usuarios (cuidador_residente, turnos, registros, escalas).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

-- 1. Dois novos perfis do sistema: Nutricionista e Hotelaria.
--    (Mantemos 'enfermagem' como valor interno: as funções de enfermagem são
--    geridas sob o grupo "Cuidadores/Enfermagem" e o perfil é derivado da
--    função — Cuidadora → cuidador; demais → enfermagem.)
alter table usuarios drop constraint if exists usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check check (perfil in
  ('master','medico','coordenacao','cuidador','enfermagem','multidisciplinar',
   'nutricionista','farmacia','administracao','hotelaria','familia'));

-- 2. Vínculo do usuário-família ao residente que ele acompanha.
--    Quando a autenticação existir, cada login de família verá APENAS este
--    residente. Permite vários usuarios-família para o mesmo residente (vários
--    mantenedores) — por isso NÃO é unique.
alter table usuarios add column if not exists residente_vinculado uuid references residentes(id);
create index if not exists usuarios_residente_vinculado_idx on usuarios (residente_vinculado);

-- 3. Remuneração (base dos custos de pessoal que a Administração usará).
--    'mensal' = salário fixo; 'plantao' = pago por plantão realizado.
--    Os campos ficam nos próprios usuarios para o módulo de Custos somar
--    (mensal fixo + por plantão) sem tabela paralela.
alter table usuarios add column if not exists tipo_remuneracao text
  check (tipo_remuneracao is null or tipo_remuneracao in ('mensal','plantao'));
alter table usuarios add column if not exists valor_mensal numeric;
alter table usuarios add column if not exists valor_plantao numeric;

-- Fim.
