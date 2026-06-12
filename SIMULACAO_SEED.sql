-- ============================================================================
-- BLUE SENIOR LIVING — SEED DA SIMULAÇÃO DE PRODUÇÃO
-- Cenário fictício e COERENTE para a semana de testes manuais (ver SIMULACAO.md).
--
-- Seguro de rodar: NÃO apaga dados reais. Tudo é prefixado "SIM-" e os ids
-- começam com 5eed0010 (hóspedes) / 5eed0020 (usuários) — fáceis de remover.
-- IDEMPOTENTE: começa limpando os dados SIM- e recria do zero. Pode rodar de novo.
--
-- Rode DEPOIS das migrações 0001–0037. Logins: senha "blue".
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 0) LIMPEZA PRÉVIA (mesma do SIMULACAO_LIMPEZA.sql) — torna o seed reexecutável
-- ----------------------------------------------------------------------------
delete from resolucao_medica where referencia_id in (
  select id from intercorrencia where residente_id::text like '5eed0010%'
  union select id from eliminacao_tratamento where residente_id::text like '5eed0010%');
delete from pendencia_tratamento where referencia_id in (
  select id from administracao where residente_id::text like '5eed0010%'
  union select id from intercorrencia where residente_id::text like '5eed0010%');
delete from eliminacao_tratamento where residente_id::text like '5eed0010%';
delete from administracao        where residente_id::text like '5eed0010%';
delete from intercorrencia       where residente_id::text like '5eed0010%';
delete from eliminacao           where residente_id::text like '5eed0010%';
delete from tarefa_registro      where residente_id::text like '5eed0010%';
delete from dispensacao          where residente_id::text like '5eed0010%';
delete from estoque_hospede      where residente_id::text like '5eed0010%';
delete from compromisso_externo  where residente_id::text like '5eed0010%';
delete from prescricao           where residente_id::text like '5eed0010%';
delete from plano_cuidado_item   where residente_id::text like '5eed0010%';
delete from dieta                where residente_id::text like '5eed0010%';
delete from solicitacao_familia  where residente_id::text like '5eed0010%';
delete from upselling            where residente_id::text like '5eed0010%';
delete from pagamento_mensalidade where residente_id::text like '5eed0010%';
delete from avaliacao_ivcf       where residente_id::text like '5eed0010%';
delete from evolucao             where residente_id::text like '5eed0010%';
-- chamado ANTES da inspeção (FK chamado.inspecao_item_id é RESTRICT)
delete from chamado_manutencao   where local like 'SIM-%' or residente_id::text like '5eed0010%';
delete from inspecao_suite       where residente_id::text like '5eed0010%';  -- cascata em inspecao_item
delete from estoque_resgate      where medicamento like 'SIM-%';
delete from pagamento_pessoal    where profissional_id::text like '5eed0020%';
delete from turnos               where profissional_id::text like '5eed0020%' or observacao_interna like 'SIM-%';
delete from cuidador_residente   where cuidador_id::text like '5eed0020%' or residente_id::text like '5eed0010%';
delete from usuarios             where id::text like '5eed0020%';
delete from residentes           where id::text like '5eed0010%';

-- ----------------------------------------------------------------------------
-- 1) HÓSPEDES (6 ativos + 1 recém-chegado sem ficha)
-- ----------------------------------------------------------------------------
insert into residentes
  (id, nome, data_nascimento, grau_dependencia, grau_contratual, modulo, andar, quarto,
   tipo_suite, ocupacao, responsavel_legal, contato, contato_emergencia_nome, contato_emergencia_telefone,
   plano_saude_operadora, plano_saude_numero, hospital_referencia, alergias, proteses,
   mensalidade_valor, historia_vida, data_admissao, celular_proprio)
values
('5eed0010-0000-4000-8000-000000000001','SIM-Aparecida Nunes','1940-02-15','III','III',1,1,'1-1-01',
   'Suíte','individual','SIM-Cláudia Nunes (filha)','(41) 99100-0001','SIM-Cláudia Nunes','(41) 99100-0001',
   'Unimed','UC-0001','Hospital Marcelino','','Prótese dentária total',
   11200,'Costureira aposentada, criou cinco filhos. Diabética. Adora novela e tricô.', current_date - 220,'(41) 98000-0001'),
('5eed0010-0000-4000-8000-000000000002','SIM-Otávio Prado','1945-07-09','II','II',1,1,'1-1-02',
   'Apartamento','individual','SIM-Renato Prado (filho)','(41) 99100-0002','SIM-Renato Prado','(41) 99100-0002',
   'Bradesco Saúde','BS-0002','Hospital Marcelino','Dipirona','',
   9500,'Bancário aposentado, torcedor fanático. Caminha todo dia no jardim.', current_date - 180,'(41) 98000-0002'),
('5eed0010-0000-4000-8000-000000000003','SIM-Conceição Dias','1938-11-20','I','I',1,1,'1-1-03',
   'Long Stay','individual','SIM-Marta Dias (sobrinha)','(41) 99100-0003','SIM-Marta Dias','(41) 99100-0003',
   'Particular',null,'Hospital Marcelino','','Óculos',
   8000,'Ex-professora de piano. Independente, gosta de ler e receber visitas.', current_date - 90,'(41) 98000-0003'),
('5eed0010-0000-4000-8000-000000000004','SIM-Henrique Salles','1942-05-03','III','II',1,2,'1-2-01',
   'Suíte Modular','individual','SIM-Júlia Salles (filha)','(41) 99100-0004','SIM-Júlia Salles','(41) 99100-0004',
   'Unimed','UC-0004','Hospital Marcelino','','Prótese de quadril',
   9800,'Engenheiro aposentado. Grau piorou no último ano (divergência contratual a renegociar).', current_date - 140,null),
('5eed0010-0000-4000-8000-000000000005','SIM-Lúcia Moraes','1948-01-28','II','II',1,2,'1-2-02',
   'Suíte','individual','SIM-Pedro Moraes (filho)','(41) 99100-0005','SIM-Pedro Moraes','(41) 99100-0005',
   'SulAmérica','SA-0005','Hospital Marcelino','','',
   10200,'Comerciante aposentada. Hipotireoidismo. Adora jardinagem.', current_date - 60,'(41) 98000-0005'),
('5eed0010-0000-4000-8000-000000000006','SIM-Waldir Campos','1936-09-14','III','III',1,2,'1-2-03',
   'Apartamento','individual','SIM-Inês Campos (filha)','(41) 99100-0006','SIM-Inês Campos','(41) 99100-0006',
   'Unimed','UC-0006','Hospital Marcelino','','Marca-passo',
   10500,'Cardiopata, ex-motorista. Acompanhamento cardiológico de perto.', current_date - 300,null),
-- Recém-chegada: SEM ficha completa, SEM prescrição, SEM plano (admissão no Dia 1)
('5eed0010-0000-4000-8000-000000000007','SIM-Therezinha Alves',null,null,null,null,null,null,
   null,null,null,null,null,null, null,null,null,null,null,
   null,null,null,null);

-- ----------------------------------------------------------------------------
-- 2) EQUIPE / USUÁRIOS (login = e-mail · senha "blue")
-- ----------------------------------------------------------------------------
insert into usuarios
  (id, nome, email, perfil, ativo, funcao, vinculo, registro_profissional, isento_ponto_app,
   residente_vinculado, tipo_remuneracao, valor_mensal, valor_plantao_diurno, valor_plantao_noturno)
values
('5eed0020-0000-4000-8000-000000000001','SIM-Ana (Cuidadora)','sim.ana@blue.local','cuidador',true,'Cuidadora','CLT',null,true,null,'mensal_fixo',2200,null,null),
('5eed0020-0000-4000-8000-000000000002','SIM-Beatriz (Cuidadora)','sim.beatriz@blue.local','cuidador',true,'Cuidadora','CLT',null,true,null,'mensal_fixo',2200,null,null),
('5eed0020-0000-4000-8000-000000000003','SIM-Carla (Cuidadora)','sim.carla@blue.local','cuidador',true,'Cuidadora','CLT',null,true,null,'mensal_fixo',2100,null,null),
('5eed0020-0000-4000-8000-000000000004','SIM-Patrícia (Cuidadora PJ)','sim.patricia@blue.local','cuidador',true,'Cuidadora','PJ',null,false,null,'por_plantao',null,180,220),
('5eed0020-0000-4000-8000-000000000005','SIM-Rosa (Enfermeira)','sim.rosa@blue.local','enfermagem',true,'Enfermeira','CLT','COREN-PR 654321',true,null,'mensal_fixo',3500,null,null),
('5eed0020-0000-4000-8000-000000000006','SIM-Geraldo (Médico)','sim.medico@blue.local','medico',true,'Médico Geriatra','PJ','CRM-PR 12345',true,null,null,null,null,null),
('5eed0020-0000-4000-8000-000000000007','SIM-Marta (Coordenação)','sim.coord@blue.local','coordenacao',true,'Coordenadora','CLT','COREN-PR 111222',true,null,'mensal_fixo',5200,null,null),
('5eed0020-0000-4000-8000-000000000008','SIM-Paulo (Farmácia)','sim.farmacia@blue.local','farmacia',true,'Farmacêutico','CLT','CRF-PR 333',true,null,null,null,null,null),
('5eed0020-0000-4000-8000-000000000009','SIM-João (Hotelaria)','sim.hotelaria@blue.local','hotelaria',true,'Hotelaria','CLT',null,true,null,null,null,null,null),
('5eed0020-0000-4000-8000-00000000000a','SIM-Sandra (Fisio)','sim.multi@blue.local','multidisciplinar',true,'Fisioterapeuta','PJ','CREFITO 444',true,null,null,null,null,null),
('5eed0020-0000-4000-8000-00000000000b','SIM-Helena (Nutri)','sim.nutri@blue.local','nutricionista',true,'Nutricionista','PJ','CRN 555',true,null,null,null,null,null),
('5eed0020-0000-4000-8000-00000000000c','SIM-Roberto (Administração)','sim.adm@blue.local','administracao',true,'Administrador','CLT',null,true,null,'mensal_fixo',6000,null,null),
('5eed0020-0000-4000-8000-00000000000d','SIM-Diretor (Master)','sim.master@blue.local','master',true,null,null,null,true,null,null,null,null,null),
('5eed0020-0000-4000-8000-00000000000e','SIM-Família Aparecida','sim.familia1@blue.local','familia',true,null,null,null,true,'5eed0010-0000-4000-8000-000000000001',null,null,null,null),
('5eed0020-0000-4000-8000-00000000000f','SIM-Família Otávio','sim.familia2@blue.local','familia',true,null,null,null,true,'5eed0010-0000-4000-8000-000000000002',null,null,null,null);

-- ----------------------------------------------------------------------------
-- 3) DESIGNAÇÃO cuidadora → hóspedes (Ana cobre R1,R2,R3 e a recém-chegada R7)
-- ----------------------------------------------------------------------------
insert into cuidador_residente (cuidador_id, residente_id) values
('5eed0020-0000-4000-8000-000000000001','5eed0010-0000-4000-8000-000000000001'),
('5eed0020-0000-4000-8000-000000000001','5eed0010-0000-4000-8000-000000000002'),
('5eed0020-0000-4000-8000-000000000001','5eed0010-0000-4000-8000-000000000003'),
('5eed0020-0000-4000-8000-000000000001','5eed0010-0000-4000-8000-000000000007'),
('5eed0020-0000-4000-8000-000000000002','5eed0010-0000-4000-8000-000000000004'),
('5eed0020-0000-4000-8000-000000000002','5eed0010-0000-4000-8000-000000000005'),
('5eed0020-0000-4000-8000-000000000003','5eed0010-0000-4000-8000-000000000006');

-- ----------------------------------------------------------------------------
-- 4) PRESCRIÇÕES ativas (R1–R6; R1 com insulina; R6 com 1 injetável)
-- ----------------------------------------------------------------------------
insert into prescricao (residente_id, medicamento, dose, via, periodo, horario, quantidade, posologia, ativa) values
-- R1 (diabética/pastosa) — 6 itens, inclui INSULINA
('5eed0010-0000-4000-8000-000000000001','Insulina NPH','10 UI','insulina','jejum','06:00','10 UI','1x/dia em jejum',true),
('5eed0010-0000-4000-8000-000000000001','Losartana','50mg','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000001','Metformina','850mg','oral','manha','08:00','1 comprimido','12/12h',true),
('5eed0010-0000-4000-8000-000000000001','Metformina','850mg','oral','noite','20:00','1 comprimido','12/12h',true),
('5eed0010-0000-4000-8000-000000000001','Sinvastatina','20mg','oral','noite','20:00','1 comprimido','1x/dia à noite',true),
('5eed0010-0000-4000-8000-000000000001','AAS','100mg','oral','almoco','12:00','1 comprimido','1x/dia',true),
-- R2 (alérgico a Dipirona) — 4 itens (SEM dipirona; o médico tentará incluir no Dia 1)
('5eed0010-0000-4000-8000-000000000002','Enalapril','10mg','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000002','Omeprazol','20mg','oral','jejum','06:00','1 comprimido','1x/dia em jejum',true),
('5eed0010-0000-4000-8000-000000000002','Atenolol','25mg','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000002','Paracetamol','500mg','oral','tarde','16:00','1 comprimido','1x/dia',true),
-- R3 (grau I) — 4 itens
('5eed0010-0000-4000-8000-000000000003','Losartana','50mg','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000003','Vitamina D','1000UI','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000003','Cálcio + D','600mg','oral','almoco','12:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000003','Sinvastatina','20mg','oral','noite','20:00','1 comprimido','1x/dia à noite',true),
-- R4 (grau III) — 5 itens
('5eed0010-0000-4000-8000-000000000004','Carbamazepina','200mg','oral','manha','08:00','1 comprimido','12/12h',true),
('5eed0010-0000-4000-8000-000000000004','Carbamazepina','200mg','oral','noite','20:00','1 comprimido','12/12h',true),
('5eed0010-0000-4000-8000-000000000004','Risperidona','1mg','oral','noite','20:00','1 comprimido','1x/dia à noite',true),
('5eed0010-0000-4000-8000-000000000004','Furosemida','40mg','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000004','Omeprazol','20mg','oral','jejum','06:00','1 comprimido','1x/dia em jejum',true),
-- R5 (grau II) — 4 itens
('5eed0010-0000-4000-8000-000000000005','Levotiroxina','50mcg','oral','jejum','06:00','1 comprimido','1x/dia em jejum',true),
('5eed0010-0000-4000-8000-000000000005','Losartana','50mg','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000005','Paracetamol','500mg','oral','tarde','16:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000005','Sinvastatina','20mg','oral','noite','20:00','1 comprimido','1x/dia à noite',true),
-- R6 (grau III, cardiopata) — 6 itens, inclui 1 INJETÁVEL
('5eed0010-0000-4000-8000-000000000006','Enalapril','20mg','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000006','Espironolactona','25mg','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000006','Furosemida','40mg','oral','manha','08:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000006','Digoxina','0,25mg','oral','almoco','12:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000006','AAS','100mg','oral','almoco','12:00','1 comprimido','1x/dia',true),
('5eed0010-0000-4000-8000-000000000006','Enoxaparina','40mg','injetavel','noite','20:00','1 ampola','1x/dia à noite',true);

-- ----------------------------------------------------------------------------
-- 5) PLANOS DE CUIDADO (R1–R6 variando por grau; R7 sem plano)
-- ----------------------------------------------------------------------------
insert into plano_cuidado_item (residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
-- R1 grau III
('5eed0010-0000-4000-8000-000000000001','Aferição de sinais vitais','07:00','enfermagem',30,true),
('5eed0010-0000-4000-8000-000000000001','Administração de medicação','07:30','cuidador',30,true),
('5eed0010-0000-4000-8000-000000000001','Banho e troca','08:00','cuidador',45,true),
('5eed0010-0000-4000-8000-000000000001','Mudança de decúbito','10:00','cuidador',30,true),
('5eed0010-0000-4000-8000-000000000001','Hidratação','15:00','cuidador',30,true),
-- R2 grau II
('5eed0010-0000-4000-8000-000000000002','Administração de medicação','08:00','cuidador',30,true),
('5eed0010-0000-4000-8000-000000000002','Banho assistido','09:00','cuidador',30,true),
('5eed0010-0000-4000-8000-000000000002','Caminhada no jardim','16:00','cuidador',30,true),
-- R3 grau I
('5eed0010-0000-4000-8000-000000000003','Administração de medicação','08:00','cuidador',30,true),
('5eed0010-0000-4000-8000-000000000003','Estímulo à autonomia (banho supervisionado)','09:00','cuidador',30,true),
-- R4 grau III
('5eed0010-0000-4000-8000-000000000004','Aferição de sinais vitais','07:00','enfermagem',30,true),
('5eed0010-0000-4000-8000-000000000004','Administração de medicação','07:30','cuidador',30,true),
('5eed0010-0000-4000-8000-000000000004','Banho e troca','08:00','cuidador',45,true),
('5eed0010-0000-4000-8000-000000000004','Mudança de decúbito','11:00','cuidador',30,true),
-- R5 grau II
('5eed0010-0000-4000-8000-000000000005','Administração de medicação','08:00','cuidador',30,true),
('5eed0010-0000-4000-8000-000000000005','Banho assistido','09:00','cuidador',30,true),
('5eed0010-0000-4000-8000-000000000005','Atividade de jardinagem','15:00','cuidador',30,true),
-- R6 grau III (cardiopata)
('5eed0010-0000-4000-8000-000000000006','Aferição de sinais vitais e PA','07:00','enfermagem',30,true),
('5eed0010-0000-4000-8000-000000000006','Administração de medicação','07:30','cuidador',30,true),
('5eed0010-0000-4000-8000-000000000006','Banho e troca','08:00','cuidador',45,true),
('5eed0010-0000-4000-8000-000000000006','Controle de peso e edema','17:00','enfermagem',30,true);

-- ----------------------------------------------------------------------------
-- 6) DIETA ativa (R1 pastosa/diabética; "com alimento" dispara o selo)
-- ----------------------------------------------------------------------------
insert into dieta (residente_id, consistencia, restricoes, observacoes) values
('5eed0010-0000-4000-8000-000000000001','Pastosa','{Diabético}','Espessar líquidos; administrar medicação com alimento.');

-- ----------------------------------------------------------------------------
-- 7) ESCALA DA SEMANA (cobertura + 1 VAGO amanhã à noite + PJ 4 plantões/2 realizados)
-- ----------------------------------------------------------------------------
-- Cuidadoras CLT (isentas) cobrindo os dias; Enfermeira diurna; PJ Patrícia nos plantões.
insert into turnos (profissional_id, categoria, data, inicio, fim, tag, observacao_interna, check_in, check_out, check_in_manual, check_out_manual) values
-- PJ Patrícia — 2 plantões JÁ REALIZADOS (com ponto)
('5eed0020-0000-4000-8000-000000000004','cuidadoras', current_date - 2, (current_date - 2) + time '07:00', (current_date - 2) + time '19:00','diurno','SIM- PJ plantão realizado', (current_date - 2) + time '07:05', (current_date - 2) + time '19:03', false, false),
('5eed0020-0000-4000-8000-000000000004','cuidadoras', current_date - 1, (current_date - 1) + time '07:00', (current_date - 1) + time '19:00','diurno','SIM- PJ plantão realizado', (current_date - 1) + time '07:02', (current_date - 1) + time '19:10', false, false),
-- PJ Patrícia — 2 plantões FUTUROS (sem ponto): noturno hoje e noturno em 2 dias
('5eed0020-0000-4000-8000-000000000004','cuidadoras', current_date,     current_date + time '19:00',     (current_date + 1) + time '07:00','noturno','SIM- PJ plantão previsto', null, null, false, false),
('5eed0020-0000-4000-8000-000000000004','cuidadoras', current_date + 2, (current_date + 2) + time '19:00',(current_date + 3) + time '07:00','noturno','SIM- PJ plantão previsto', null, null, false, false),
-- Cobertura CLT
('5eed0020-0000-4000-8000-000000000001','cuidadoras', current_date,     current_date + time '07:00',     current_date + time '19:00','diurno','SIM- diurno hoje', null, null, false, false),
('5eed0020-0000-4000-8000-000000000002','cuidadoras', current_date + 1, (current_date + 1) + time '07:00',(current_date + 1) + time '19:00','diurno','SIM- diurno amanhã', null, null, false, false),
('5eed0020-0000-4000-8000-000000000003','cuidadoras', current_date + 2, (current_date + 2) + time '07:00',(current_date + 2) + time '19:00','diurno','SIM- diurno', null, null, false, false),
-- Enfermeira diurna hoje
('5eed0020-0000-4000-8000-000000000005','enfermeiras', current_date,    current_date + time '07:00',     current_date + time '19:00','diurno','SIM- enfermagem diurno', null, null, false, false),
-- TURNO VAGO — amanhã à noite (a cobrir no Dia 5)
(null,'cuidadoras', current_date + 1, (current_date + 1) + time '19:00',(current_date + 2) + time '07:00','noturno','SIM- VAGO a cobrir', null, null, false, false);

-- ----------------------------------------------------------------------------
-- 8) ESTOQUE provisionado do mês para 4 dos 6 (R1–R4). R5 e R6 ficam SEM.
-- ----------------------------------------------------------------------------
insert into estoque_hospede (residente_id, medicamento, mes_referencia, quantidade_provisionada, quantidade_atual, unidade)
select p.residente_id, p.medicamento, to_char(current_date,'YYYY-MM'), 30, 30,
       case when p.via='insulina' then 'UI' when p.via='injetavel' then 'ampola' else 'comprimido' end
from prescricao p
where p.residente_id in (
  '5eed0010-0000-4000-8000-000000000001','5eed0010-0000-4000-8000-000000000002',
  '5eed0010-0000-4000-8000-000000000003','5eed0010-0000-4000-8000-000000000004')
on conflict (residente_id, medicamento, mes_referencia) do nothing;

-- Estoque de resgate com 1 item em saldo BAIXO (2)
insert into estoque_resgate (medicamento, quantidade_atual, unidade) values
('SIM-Escopolamina 10mg', 2, 'comprimido');

-- ----------------------------------------------------------------------------
-- 9) SOLICITAÇÕES DA FAMÍLIA (2 abertas)
-- ----------------------------------------------------------------------------
insert into solicitacao_familia (residente_id, destino, assunto, mensagem, status, enviada_por) values
('5eed0010-0000-4000-8000-000000000001','medico','Dúvida sobre a insulina',
 'Vimos que a dona Aparecida usa insulina à noite também? Gostaríamos de entender melhor a rotina.','aberta','SIM-Família Aparecida'),
('5eed0010-0000-4000-8000-000000000002','administracao','Segunda via do boleto',
 'Poderiam reenviar o boleto deste mês? Não localizamos no e-mail.','aberta','SIM-Família Otávio');

-- ----------------------------------------------------------------------------
-- 10) CHAMADO DE MANUTENÇÃO (aberto, urgência ALTA, prazo vencido)
-- ----------------------------------------------------------------------------
insert into chamado_manutencao (local, residente_id, problema, urgencia, status, aberto_por, perfil_solicitante, prazo) values
('SIM-Quarto 1-1-02 (Otávio)','5eed0010-0000-4000-8000-000000000002',
 'Vazamento na pia do banheiro do quarto.','alta','aberto','SIM-João (Hotelaria)','hotelaria', current_date - 1);

-- ----------------------------------------------------------------------------
-- 11) INSPEÇÃO DE SUÍTE de ONTEM com NÃO-CONFORMIDADE
-- ----------------------------------------------------------------------------
with ins as (
  insert into inspecao_suite (residente_id, quarto, tipo, data, inspecionado_por, tem_nao_conformidade)
  values ('5eed0010-0000-4000-8000-000000000005','1-2-02','diaria', current_date - 1,'SIM-João (Hotelaria)', true)
  returning id)
insert into inspecao_item (inspecao_id, item, status, observacao)
select id, 'Climatização funcionando','nao_conforme','SIM- Ar-condicionado com ruído — verificar' from ins
union all
select id, 'Iluminação e tomadas','conforme',null from ins;

-- ----------------------------------------------------------------------------
-- 12) MENSALIDADES do mês: 4 pagas (R1–R4). R5 e R6 ficam pendentes (sem registro).
-- ----------------------------------------------------------------------------
insert into pagamento_mensalidade (residente_id, mes_referencia, valor, status, pago_em, registrado_por)
select id, to_char(current_date,'YYYY-MM'), mensalidade_valor, 'pago', now() - interval '3 days','SIM-Roberto (Administração)'
from residentes
where id in ('5eed0010-0000-4000-8000-000000000001','5eed0010-0000-4000-8000-000000000002',
             '5eed0010-0000-4000-8000-000000000003','5eed0010-0000-4000-8000-000000000004')
on conflict (residente_id, mes_referencia) do nothing;

-- ----------------------------------------------------------------------------
-- 13) UPSELLING: 3 lançamentos no mês
-- ----------------------------------------------------------------------------
insert into upselling (residente_id, categoria, descricao, valor, data, mes_referencia, lancado_por) values
('5eed0010-0000-4000-8000-000000000001','Manicure/cabeleireiro','Corte e escova', 60.00, current_date - 5, to_char(current_date,'YYYY-MM'),'SIM-Roberto (Administração)'),
('5eed0010-0000-4000-8000-000000000002','Fisioterapia avulsa','Sessão extra de RPG', 150.00, current_date - 4, to_char(current_date,'YYYY-MM'),'SIM-Roberto (Administração)'),
('5eed0010-0000-4000-8000-000000000004','Medicamentos','Pomada não coberta pelo plano', 45.90, current_date - 3, to_char(current_date,'YYYY-MM'),'SIM-Roberto (Administração)');

-- ----------------------------------------------------------------------------
-- 14) LOGINS (senha "blue") para os usuários SIM- — mesmo padrão da 0030
-- ----------------------------------------------------------------------------
do $$
declare u record; uid uuid; ok int := 0;
begin
  for u in select * from public.usuarios where email ilike 'sim.%@blue.local' loop
    begin
      delete from auth.identities i using auth.users au
        where au.id = i.user_id and lower(au.email) = lower(u.email);
      delete from auth.users where lower(email) = lower(u.email);
      uid := gen_random_uuid();
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, created_at, updated_at, last_sign_in_at,
        raw_app_meta_data, raw_user_meta_data,
        confirmation_token, recovery_token, email_change,
        email_change_token_new, email_change_token_current,
        phone_change, phone_change_token, reauthentication_token
      ) values (
        '00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated',
        lower(u.email), crypt('blue', gen_salt('bf')),
        now(), now(), now(), now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        '', '', '', '', '', '', '', ''
      );
      begin
        insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
        values (gen_random_uuid(), lower(u.email), uid,
          jsonb_build_object('sub', uid::text, 'email', lower(u.email), 'email_verified', true),
          'email', now(), now(), now());
      exception when others then
        insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
        values (lower(u.email), uid,
          jsonb_build_object('sub', uid::text, 'email', lower(u.email), 'email_verified', true),
          'email', now(), now(), now());
      end;
      ok := ok + 1;
    exception when others then
      raise notice 'login FALHOU para %: %', u.email, sqlerrm;
    end;
  end loop;
  raise notice 'Logins SIM- criados: %', ok;
end $$;

-- ----------------------------------------------------------------------------
-- 15) CONFERÊNCIA: contagem de registros SIM- criados
-- ----------------------------------------------------------------------------
select 'residentes' as tabela, count(*) from residentes where id::text like '5eed0010%'
union all select 'usuarios',            count(*) from usuarios where id::text like '5eed0020%'
union all select 'cuidador_residente',  count(*) from cuidador_residente where residente_id::text like '5eed0010%'
union all select 'prescricao',          count(*) from prescricao where residente_id::text like '5eed0010%'
union all select 'plano_cuidado_item',  count(*) from plano_cuidado_item where residente_id::text like '5eed0010%'
union all select 'dieta',               count(*) from dieta where residente_id::text like '5eed0010%'
union all select 'turnos',              count(*) from turnos where observacao_interna like 'SIM-%'
union all select 'estoque_hospede',     count(*) from estoque_hospede where residente_id::text like '5eed0010%'
union all select 'estoque_resgate(SIM)',count(*) from estoque_resgate where medicamento like 'SIM-%'
union all select 'solicitacao_familia', count(*) from solicitacao_familia where residente_id::text like '5eed0010%'
union all select 'chamado_manutencao',  count(*) from chamado_manutencao where local like 'SIM-%'
union all select 'inspecao_suite',      count(*) from inspecao_suite where residente_id::text like '5eed0010%'
union all select 'pagamento_mensalidade',count(*) from pagamento_mensalidade where residente_id::text like '5eed0010%'
union all select 'upselling',           count(*) from upselling where residente_id::text like '5eed0010%'
union all select 'logins(auth.users)',  count(*) from auth.users where email like 'sim.%@blue.local'
order by 1;
-- Fim do seed.
