-- ===========================================================================
-- 0121 — ANEXO VIII (parcelamento das entradas em 6 fases) + NF nº 13.
-- ---------------------------------------------------------------------------
-- O Anexo VIII parcelou o pagamento das ENTRADAS (50%) dos projetos em 6
-- fases, cada uma com seguro garantia. A TRÍADE emitiu a NFS-e nº 13
-- (03/08/2026, R$ 149.580,00 bruto / R$ 140.380,83 líquido) cobrindo a
-- FASE 1 (10 entradas = R$ 142.780) + a Sondagem integral (R$ 6.800).
-- Mapeamento provado pelos valores (todas as somas fecham ao centavo):
--   Fase 1 (vig. 01/08/26): Terraplanagem, Estrutural M5, PPCI,
--     Acessibilidade, PBA, PGRSS, Elétrico, Hidro M5, Tecnologia M5,
--     Hidro M3/4  → entradas somam 142.780,00
--   Fase 2 (02/10/26): Contenções, Fundações M5, Licenciamento,
--     Estrutural M3/4                          → 31.560,00
--   Fase 3 (04/12/26): Impermeabilização, Fundações M3/4 → 17.400,00
--   Fase 4 (08/01/27): Estrutural M1/2, Fundações M1/2   → 27.160,00
--   Fase 5 (19/03/27): Compatibilização BIM              → 11.700,00
--   Fase 6 (12/10/27 [sic]): Hidro M1/2                  → 16.000,00
--   (142.780+31.560+17.400+27.160+11.700+16.000 + 3.400 da sondagem
--    = 250.000 = 50% dos R$ 500.000 ✓)
-- O QUE ESTA MIGRATION FAZ:
-- a) APROVA os marcos de entrada da Fase 1 (10 itens) e a entrega única da
--    Sondagem → eles aparecem no portal da TRÍADE em "Aprovado — pronto
--    para faturar", para ela anexar a NF nº 13 e nós pagarmos.
-- b) Sondagem: dispensa o gate de ART neste marco (laudo já recebido fora
--    do app; pode ser anexado depois no workspace da atividade).
-- c) Anota a fase do Anexo VIII na observação de cada disciplina.
-- d) Registra os 6 seguros garantia como INSUMOS CRÍTICOS a cobrar.
-- Idempotente. Rode após a 0120.
-- ===========================================================================

-- ── a · Fase 1: aprova as 10 entradas ───────────────────────────────────────
update public.obra_disciplina_marcos m
   set status = 'Aprovado',
       data_aprovacao = coalesce(m.data_aprovacao, date '2026-08-03'),
       registrado_por = coalesce(m.registrado_por, 'Anexo VIII — Fase 1')
  from public.obra_disciplinas d
 where d.id = m.disciplina_id
   and m.chave = 'inicio'
   and m.status in ('Pendente', 'Em análise')
   and d.nome in (
     'Projeto de Terraplanagem Geral',
     'Projeto Estrutural - Módulo 5',
     'Projeto PPCI Completo',
     'Projeto de Acessibilidade Completo - Validação NBR 9050',
     'PBA Vigilância Sanitária - Completo',
     'PGRSS Completo',
     'Projeto Elétrico Completo',
     'Projeto Hidrossanitário e Pluvial - Módulo 5',
     'Projeto de Instalações de Tecnologia e Segurança Eletrônica - Módulo 5',
     'Projeto Hidrossanitário e Pluvial - Módulos 3 e 4'
   );

-- ── b · Sondagem: aprova a entrega única e dispensa a ART neste marco ───────
update public.obra_disciplina_marcos m
   set status = 'Aprovado',
       data_aprovacao = coalesce(m.data_aprovacao, date '2026-08-03'),
       exige_entrega = false,
       registrado_por = coalesce(m.registrado_por, 'NF 13 — laudo recebido fora do app')
  from public.obra_disciplinas d
 where d.id = m.disciplina_id
   and d.nome = 'Sondagem SPT + Laudo Geotécnico'
   and m.chave = 'entrega'
   and m.status <> 'Pago';

-- ── c · Anota a fase do Anexo VIII em cada disciplina ───────────────────────
update public.obra_disciplinas
   set observacao = case
     when observacao like '%Anexo VIII%' then observacao
     else coalesce(observacao || ' · ', '') || 'Anexo VIII: entrada na ' ||
       case nome
         when 'Projeto de Terraplanagem Geral' then 'Fase 1 (vig. 01/08/26)'
         when 'Projeto Estrutural - Módulo 5' then 'Fase 1 (vig. 01/08/26)'
         when 'Projeto PPCI Completo' then 'Fase 1 (vig. 01/08/26)'
         when 'Projeto de Acessibilidade Completo - Validação NBR 9050' then 'Fase 1 (vig. 01/08/26)'
         when 'PBA Vigilância Sanitária - Completo' then 'Fase 1 (vig. 01/08/26)'
         when 'PGRSS Completo' then 'Fase 1 (vig. 01/08/26)'
         when 'Projeto Elétrico Completo' then 'Fase 1 (vig. 01/08/26)'
         when 'Projeto Hidrossanitário e Pluvial - Módulo 5' then 'Fase 1 (vig. 01/08/26)'
         when 'Projeto de Instalações de Tecnologia e Segurança Eletrônica - Módulo 5' then 'Fase 1 (vig. 01/08/26)'
         when 'Projeto Hidrossanitário e Pluvial - Módulos 3 e 4' then 'Fase 1 (vig. 01/08/26)'
         when 'Projeto de Contenções' then 'Fase 2 (vig. 02/10/26)'
         when 'Projeto de Fundações - Módulo 5' then 'Fase 2 (vig. 02/10/26)'
         when 'Protocolos de Licenciamento Ambiental e Movimentação de Terra' then 'Fase 2 (vig. 02/10/26)'
         when 'Projeto Estrutural - Módulos 3 e 4' then 'Fase 2 (vig. 02/10/26)'
         when 'Projeto de Impermeabilização de Elementos' then 'Fase 3 (vig. 04/12/26)'
         when 'Projeto de Fundações - Módulos 3 e 4' then 'Fase 3 (vig. 04/12/26)'
         when 'Projeto Estrutural - Módulos 1 e 2' then 'Fase 4 (vig. 08/01/27)'
         when 'Projeto de Fundações - Módulos 1 e 2' then 'Fase 4 (vig. 08/01/27)'
         when 'Compatibilização BIM Total' then 'Fase 5 (vig. 19/03/27)'
         when 'Projeto Hidrossanitário e Pluvial - Módulos 1 e 2' then 'Fase 6 (vig. 12/10/27 — conferir: provável 12/10/26)'
       end
   end
 where nome in (
   'Projeto de Terraplanagem Geral','Projeto Estrutural - Módulo 5','Projeto PPCI Completo',
   'Projeto de Acessibilidade Completo - Validação NBR 9050','PBA Vigilância Sanitária - Completo',
   'PGRSS Completo','Projeto Elétrico Completo','Projeto Hidrossanitário e Pluvial - Módulo 5',
   'Projeto de Instalações de Tecnologia e Segurança Eletrônica - Módulo 5',
   'Projeto Hidrossanitário e Pluvial - Módulos 3 e 4','Projeto de Contenções',
   'Projeto de Fundações - Módulo 5','Protocolos de Licenciamento Ambiental e Movimentação de Terra',
   'Projeto Estrutural - Módulos 3 e 4','Projeto de Impermeabilização de Elementos',
   'Projeto de Fundações - Módulos 3 e 4','Projeto Estrutural - Módulos 1 e 2',
   'Projeto de Fundações - Módulos 1 e 2','Compatibilização BIM Total',
   'Projeto Hidrossanitário e Pluvial - Módulos 1 e 2'
 );

-- ── d · Seguros garantia do Anexo VIII → insumos críticos (a cobrar) ────────
insert into public.obra_insumos_criticos (nome, dependencia, responsavel, prazo_limite, status, observacao)
select v.nome, 'Anexo VIII — condição do pagamento da entrada da fase', 'TRÍADE', v.prazo::date, 'pendente', v.obs
from (values
  ('Seguro garantia — Anexo VIII Fase 1 (R$ 142.780)', '2026-08-01', 'Vigência a partir de 01/08/26, validade 90 dias.'),
  ('Seguro garantia — Anexo VIII Fase 2 (R$ 31.560)',  '2026-10-02', 'Vigência a partir de 02/10/26, validade 60 dias.'),
  ('Seguro garantia — Anexo VIII Fase 3 (R$ 17.400)',  '2026-12-04', 'Vigência a partir de 04/12/26, validade 30 dias.'),
  ('Seguro garantia — Anexo VIII Fase 4 (R$ 27.160)',  '2027-01-08', 'Vigência a partir de 08/01/27, validade 60 dias.'),
  ('Seguro garantia — Anexo VIII Fase 5 (R$ 11.700)',  '2027-03-19', 'Vigência a partir de 19/03/27, validade 30 dias.'),
  ('Seguro garantia — Anexo VIII Fase 6 (R$ 16.000)',  '2027-10-12', 'Vigência conforme anexo (12/10/27) — data a conferir com a TRÍADE (provável 12/10/26).')
) as v(nome, prazo, obs)
where not exists (
  select 1 from public.obra_insumos_criticos i where i.nome = v.nome
);

-- Fim.
