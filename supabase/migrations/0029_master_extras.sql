-- ============================================================================
-- Blue Senior Living — Migration 0029
-- Master: campos extras da ficha do residente e da gestão de usuários que NÃO
-- são cobertos pelas migrations do financeiro/admin (0025 tipo_suite/ocupacao/
-- mensalidade; 0027 remuneração). Apenas ADITIVO; não recria colunas já
-- criadas por outras migrations e não quebra nada.
--
-- COMO USAR: Supabase > SQL Editor > cole tudo > Run. Idempotente.
-- ============================================================================

-- ---------- RESIDENTES: ficha clínica/contratual (colunas exclusivas) ----------
alter table residentes add column if not exists grau_contratual text
  check (grau_contratual is null or grau_contratual in ('I','II','III'));
alter table residentes add column if not exists plano_saude_operadora text;
alter table residentes add column if not exists plano_saude_numero text;
alter table residentes add column if not exists hospital_referencia text;
alter table residentes add column if not exists contato_emergencia_nome text;
alter table residentes add column if not exists contato_emergencia_telefone text;
-- (tipo_suite, ocupacao, mensalidade_valor, mensalidade_ajuste_obs vêm da 0025.)

-- ---------- USUARIOS: vínculo família e horário fixo (colunas exclusivas) ----------
alter table usuarios add column if not exists residente_vinculado uuid references residentes(id);
create index if not exists usuarios_residente_vinculado_idx on usuarios (residente_vinculado);
alter table usuarios add column if not exists horario_trabalho text;
-- (tipo_remuneracao, valor_mensal, valor_plantao_diurno/noturno vêm da 0027.)

-- ---------- Perfis novos no enum (nutricionista, hotelaria) ----------
alter table usuarios drop constraint if exists usuarios_perfil_check;
alter table usuarios add constraint usuarios_perfil_check check (perfil in
  ('master','medico','coordenacao','cuidador','enfermagem','multidisciplinar',
   'nutricionista','farmacia','administracao','hotelaria','familia'));

-- ---------- Usuários de teste p/ os perfis sem seed (login das telas) ----------
insert into usuarios (id, nome, email, perfil, ativo) values
  ('b0000000-0000-0000-0000-000000000014','Nut. Camila Nutrição','nutri@blueseniorliving.com.br','nutricionista',true),
  ('b0000000-0000-0000-0000-000000000015','Sr. Hélio Hotelaria','hotelaria@blueseniorliving.com.br','hotelaria',true)
on conflict (id) do nothing;

-- ---------- Vínculo da família de teste ao seu residente ----------
-- Família Bittencourt acompanha a Profª Alzira (Portal da Família sob login).
update usuarios
  set residente_vinculado = 'a0000000-0000-0000-0000-000000000001'
  where id = 'b0000000-0000-0000-0000-000000000008'
    and residente_vinculado is null;

-- Fim.
