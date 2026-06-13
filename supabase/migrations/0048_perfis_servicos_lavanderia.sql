-- ===========================================================================
-- 0048 — Perfis SERVIÇOS GERAIS e LAVANDERIA (separa os operacionais)
-- ---------------------------------------------------------------------------
-- A Hotelaria foi dividida em três perfis:
--   • hotelaria        → inspeção de suítes + governança (reduzida);
--   • servicos_gerais  → manutenção predial/corretiva (chamado_manutencao);
--   • lavanderia       → rouparia/enxoval (rouparia_transito).
--
-- As TELAS e TABELAS já existem (rotas flat reaproveitadas); aqui só ajustamos
-- o banco: enum de perfil, solicitante do chamado, leitura de residentes para
-- Serviços Gerais (a tela de Manutenção lista o hóspede/quarto do chamado) e os
-- dois usuários de teste. Os dados de manutenção e rouparia são PRESERVADOS
-- (mesmas tabelas; nada é movido nem recriado).
--
-- Cobertura de RLS por módulo:
--   • chamado_manutencao e rouparia_transito já são "staff" (0031/0032:
--     app_perfil() <> 'familia') → servicos_gerais e lavanderia leem/gravam o
--     seu módulo. A separação de acesso entre módulos é feita pelo MENU de cada
--     perfil (mesmo modelo já usado por Farmácia/Hotelaria).
--   • residentes: a Lavanderia NÃO precisa (rouparia é por categoria), então
--     não recebe acesso — cada um vê só o que seu módulo usa.
-- Idempotente.
-- ===========================================================================

-- 1) Enum/check do perfil: adiciona servicos_gerais e lavanderia.
alter table public.usuarios drop constraint if exists usuarios_perfil_check;
alter table public.usuarios add constraint usuarios_perfil_check check (perfil in
  ('master','medico','coordenacao','cuidador','enfermagem','multidisciplinar',
   'nutricionista','farmacia','administracao','direcao','hotelaria',
   'servicos_gerais','lavanderia','familia'));

-- 2) chamado_manutencao: Serviços Gerais também é solicitante válido (abre
--    chamados a partir da própria tela de gestão).
alter table public.chamado_manutencao drop constraint if exists chamado_manutencao_perfil_solicitante_check;
alter table public.chamado_manutencao add constraint chamado_manutencao_perfil_solicitante_check
  check (perfil_solicitante in ('hotelaria','servicos_gerais','cuidador','coordenacao','master'));

-- 3) residentes_select: Serviços Gerais lê residentes (a tela de Manutenção
--    rotula o chamado pelo hóspede/quarto). Mantém todos os demais perfis.
drop policy if exists residentes_select on public.residentes;
create policy residentes_select on public.residentes for select to authenticated using (
  public.app_perfil() in
    ('master','coordenacao','medico','enfermagem','multidisciplinar','nutricionista',
     'administracao','direcao','hotelaria','servicos_gerais','farmacia')
  or (public.app_perfil() = 'cuidador'
      and id in (select cr.residente_id from public.cuidador_residente cr
                 where cr.cuidador_id = public.app_usuario_id()))
  or (public.app_perfil() = 'familia'
      and id = (select u.residente_vinculado from public.usuarios u
                where u.id = public.app_usuario_id()))
);

-- 4) Usuários de teste dos novos perfis (nomes sem honoríficos, padrão da casa).
insert into public.usuarios (id, nome, email, perfil, ativo, funcao, isento_ponto_app) values
  ('b0000000-0000-0000-0000-000000000017','Joaquim Brito','servicos@blueseniorliving.com.br','servicos_gerais',true,'Manutenção Predial',true),
  ('b0000000-0000-0000-0000-000000000018','Marta Vasques','lavanderia@blueseniorliving.com.br','lavanderia',true,'Lavanderia',true)
on conflict (id) do update
  set nome = excluded.nome, email = excluded.email, perfil = excluded.perfil,
      ativo = excluded.ativo, funcao = excluded.funcao;
