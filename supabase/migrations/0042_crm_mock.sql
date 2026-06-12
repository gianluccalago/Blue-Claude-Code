-- ===========================================================================
-- 0042 — CRM: dados MOCK para demonstrar e testar o funil
-- ---------------------------------------------------------------------------
-- 14 contatos (famílias) + 14 oportunidades distribuídas por TODAS as etapas e
-- status (nova, em_andamento, ganha, perdida, pausada), com tarefas (algumas
-- vencidas, visitas agendadas na semana), timeline de eventos e vínculos de
-- origem — exercitando Pipeline (Kanban), Tarefas, Relatórios e Contatos.
--
-- IDEMPOTENTE: remove os ids d1…/d2… antes de reinserir (cascade limpa tarefas
-- e eventos). Requer a 0038 (CRM) e a 0041 (hóspede c…0006, p/ vínculo ganho).
-- ===========================================================================

-- ── Limpeza idempotente (contato cascateia oportunidade → tarefa/evento) ─────
delete from public.crm_oportunidade where id::text like 'd2000000%';
delete from public.crm_contato      where id::text like 'd1000000%';

-- ── Contatos (a FAMÍLIA que decide) + o futuro hóspede ───────────────────────
insert into public.crm_contato
  (id, nome, telefones, emails, relacao, nome_idoso, idade_idoso, grau_estimado, base_legal_lgpd, observacoes) values
('d1000000-0000-0000-0000-000000000001','Marcelo Aragão','{(41) 99600-1101}','{marcelo.aragao@email.com}','Filho(a)','Sebastião Aragão',82,'II','consentimento','Chegou pelo Instagram; pediu valores.'),
('d1000000-0000-0000-0000-000000000002','Patrícia Couto','{(41) 99600-1102}','{}','Filho(a)','Wanda Couto',79,'I','nao_definida','Buscou no Google "casa de repouso Curitiba".'),
('d1000000-0000-0000-0000-000000000003','Dr. Ricardo Mello','{(41) 99600-1103}','{ricardo.mello@email.com}','Outro','Aurora Mello',88,'III','legitimo_interesse','Indicação do geriatra; caso de demência.'),
('d1000000-0000-0000-0000-000000000004','Sandra Vasconcelos','{(41) 99600-1104}','{sandra.v@email.com}','Filho(a)','Norberto Vasconcelos',84,'II','consentimento','Preencheu formulário do site.'),
('d1000000-0000-0000-0000-000000000005','Henrique Pádua','{(41) 99600-1105}','{henrique.padua@email.com}','Filho(a)','Cleusa Pádua',77,'II','consentimento','Indicação de família já hóspede.'),
('d1000000-0000-0000-0000-000000000006','Vera Lúcia Antunes','{(41) 99600-1106}','{vera.antunes@email.com}','Cônjuge','Orlando Antunes',81,'III','consentimento','Alta hospitalar próxima; urgência.'),
('d1000000-0000-0000-0000-000000000007','Fernanda Bastos','{(41) 99600-1107}','{fernanda.bastos@email.com}','Filho(a)','Lúcia Bastos',86,'II','consentimento','Visita realizada, gostou da suíte modular.'),
('d1000000-0000-0000-0000-000000000008','Rogério Tanaka','{(41) 99600-1108}','{rogerio.tanaka@email.com}','Filho(a)','Massao Tanaka',90,'III','consentimento','Proposta enviada; aguardando decisão.'),
('d1000000-0000-0000-0000-000000000009','Cláudia Reis','{(41) 99600-1109}','{claudia.reis@email.com}','Sobrinho(a)','Antônia Reis',83,'II','legitimo_interesse','Viu a placa na frente; ligou.'),
('d1000000-0000-0000-0000-000000000010','Marília Tavares','{(41) 99810-2233}','{marilia.tavares@email.com}','Filho(a)','Geraldo Tavares',86,'II','consentimento','Admitido — virou hóspede da casa.'),
('d1000000-0000-0000-0000-000000000011','Paulo César Lima','{(41) 99600-1111}','{paulo.lima@email.com}','Filho(a)','Dalva Lima',85,'I','consentimento','Fechou após a visita; muito satisfeito.'),
('d1000000-0000-0000-0000-000000000012','Adriana Fonseca','{(41) 99600-1112}','{adriana.fonseca@email.com}','Filho(a)','Geni Fonseca',80,'II','nao_definida','Achou o valor acima do orçamento.'),
('d1000000-0000-0000-0000-000000000013','Marcos Dré','{(41) 99600-1113}','{marcos.dre@email.com}','Filho(a)','Ivo Dré',87,'III','nao_definida','Optou por outro residencial mais perto.'),
('d1000000-0000-0000-0000-000000000014','Beatriz Salgado','{(41) 99600-1114}','{beatriz.salgado@email.com}','Filho(a)','Custódia Salgado',78,'I','consentimento','Família adiou a decisão para depois das festas.');

-- ── Oportunidades (origem por subquery em nome) ──────────────────────────────
insert into public.crm_oportunidade
  (id, nome, contato_id, origem_id, qualificacao, valor_mensalidade_estimado, tipo_suite_interesse,
   previsao_fechamento, etapa, status, motivo_perda, responsavel, residente_id, criado_em, fechado_em) values
-- SEM CONTATO (novas)
('d2000000-0000-0000-0000-000000000001','Família Aragão — Sebastião','d1000000-0000-0000-0000-000000000001',
  (select id from public.crm_origem where nome='Instagram'),2,9000,'Suíte',
  current_date + 25,'Sem contato','nova',null,'Cláudia Ferreira',null, now() - interval '2 days', null),
('d2000000-0000-0000-0000-000000000002','Família Couto — Wanda','d1000000-0000-0000-0000-000000000002',
  (select id from public.crm_origem where nome='Google'),3,7800,'Long Stay',
  current_date + 30,'Sem contato','nova',null,'Eduardo Nogueira',null, now() - interval '1 days', null),
-- CONTATO FEITO
('d2000000-0000-0000-0000-000000000003','Família Mello — Aurora','d1000000-0000-0000-0000-000000000003',
  (select id from public.crm_origem where nome='Indicação médica'),4,12800,'Suíte Modular',
  current_date + 20,'Contato feito','em_andamento',null,'Cláudia Ferreira',null, now() - interval '9 days', null),
('d2000000-0000-0000-0000-000000000004','Família Vasconcelos — Norberto','d1000000-0000-0000-0000-000000000004',
  (select id from public.crm_origem where nome='Site'),3,9500,'Suíte',
  current_date + 18,'Contato feito','em_andamento',null,'Eduardo Nogueira',null, now() - interval '12 days', null),
-- VISITA AGENDADA
('d2000000-0000-0000-0000-000000000005','Família Pádua — Cleusa','d1000000-0000-0000-0000-000000000005',
  (select id from public.crm_origem where nome='Indicação de família'),4,10200,'Suíte',
  current_date + 12,'Visita agendada','em_andamento',null,'Cláudia Ferreira',null, now() - interval '7 days', null),
('d2000000-0000-0000-0000-000000000006','Família Antunes — Orlando','d1000000-0000-0000-0000-000000000006',
  (select id from public.crm_origem where nome='Hospital'),5,13200,'Suíte Modular',
  current_date + 8,'Visita agendada','em_andamento',null,'Cláudia Ferreira',null, now() - interval '5 days', null),
-- VISITA REALIZADA
('d2000000-0000-0000-0000-000000000007','Família Bastos — Lúcia','d1000000-0000-0000-0000-000000000007',
  (select id from public.crm_origem where nome='Indicação médica'),4,11000,'Suíte Modular',
  current_date + 14,'Visita realizada','em_andamento',null,'Eduardo Nogueira',null, now() - interval '18 days', null),
-- PROPOSTA ENVIADA
('d2000000-0000-0000-0000-000000000008','Família Tanaka — Massao','d1000000-0000-0000-0000-000000000008',
  (select id from public.crm_origem where nome='Google'),5,13500,'Suíte',
  current_date + 6,'Proposta enviada','em_andamento',null,'Cláudia Ferreira',null, now() - interval '25 days', null),
('d2000000-0000-0000-0000-000000000009','Família Reis — Antônia','d1000000-0000-0000-0000-000000000009',
  (select id from public.crm_origem where nome='Placa'),4,9800,'Suíte',
  current_date + 10,'Proposta enviada','em_andamento',null,'Eduardo Nogueira',null, now() - interval '30 days', null),
-- ADMISSÃO (ganhas)
('d2000000-0000-0000-0000-000000000010','Família Tavares — Geraldo','d1000000-0000-0000-0000-000000000010',
  (select id from public.crm_origem where nome='Indicação médica'),5,9800,'Suíte',
  current_date - 8,'Admissão','ganha',null,'Cláudia Ferreira','c0000000-0000-0000-0000-000000000001', now() - interval '50 days', now() - interval '8 days'),
('d2000000-0000-0000-0000-000000000011','Família Lima — Dalva','d1000000-0000-0000-0000-000000000011',
  (select id from public.crm_origem where nome='Indicação de família'),5,8600,'Long Stay',
  current_date - 15,'Admissão','ganha',null,'Eduardo Nogueira',null, now() - interval '40 days', now() - interval '15 days'),
-- PERDIDAS
('d2000000-0000-0000-0000-000000000012','Família Fonseca — Geni','d1000000-0000-0000-0000-000000000012',
  (select id from public.crm_origem where nome='Instagram'),2,9000,'Suíte',
  null,'Proposta enviada','perdida','Preço','Cláudia Ferreira',null, now() - interval '35 days', now() - interval '10 days'),
('d2000000-0000-0000-0000-000000000013','Família Dré — Ivo','d1000000-0000-0000-0000-000000000013',
  (select id from public.crm_origem where nome='Google'),3,12000,'Suíte Modular',
  null,'Visita realizada','perdida','Escolheu outro residencial','Eduardo Nogueira',null, now() - interval '28 days', now() - interval '6 days'),
-- PAUSADA
('d2000000-0000-0000-0000-000000000014','Família Salgado — Custódia','d1000000-0000-0000-0000-000000000014',
  (select id from public.crm_origem where nome='Site'),3,7600,'Apartamento',
  current_date + 40,'Contato feito','pausada',null,'Cláudia Ferreira',null, now() - interval '20 days', null);

-- ── Tarefas (vencidas, visitas na semana, futuras e concluídas) ──────────────
insert into public.crm_tarefa (oportunidade_id, tipo, assunto, descricao, responsavel, data, hora, concluida) values
-- Futuras (pendentes)
('d2000000-0000-0000-0000-000000000003','Ligar','Ligar para apresentar a casa','Explicar plano de cuidado e valores.','Cláudia Ferreira', current_date + 1,'10:00',false),
('d2000000-0000-0000-0000-000000000007','Email','Enviar proposta formal','Anexar tabela e contrato.','Eduardo Nogueira', current_date + 2,'09:00',false),
('d2000000-0000-0000-0000-000000000009','Ligar','Follow-up da proposta','Verificar dúvidas sobre o contrato.','Eduardo Nogueira', current_date + 3,'14:00',false),
-- VENCIDAS (data passada, não concluídas) — aparecem no topo de Tarefas e badge no card
('d2000000-0000-0000-0000-000000000004','WhatsApp','Retornar contato do site','Família preencheu formulário e aguarda retorno.','Eduardo Nogueira', current_date - 3,'11:00',false),
('d2000000-0000-0000-0000-000000000008','Ligar','Cobrar retorno da proposta','Proposta enviada há dias, sem resposta.','Cláudia Ferreira', current_date - 2,'15:00',false),
-- VISITAS AGENDADAS NA SEMANA (alimentam o card do Painel da Administração)
('d2000000-0000-0000-0000-000000000005','Visita agendada','Visita à casa com a família','Mostrar suíte e áreas comuns.','Cláudia Ferreira', current_date + 2,'10:30',false),
('d2000000-0000-0000-0000-000000000006','Visita agendada','Visita com alta hospitalar próxima','Família virá direto do hospital.','Cláudia Ferreira', current_date + 4,'16:00',false),
-- Concluídas (histórico)
('d2000000-0000-0000-0000-000000000007','Visita agendada','Visita realizada','Conheceram a suíte modular.','Eduardo Nogueira', current_date - 5,'10:00',true),
('d2000000-0000-0000-0000-000000000010','Reunião','Assinatura do contrato','Admissão concluída.','Cláudia Ferreira', current_date - 8,'14:00',true);

-- ── Timeline (eventos) ───────────────────────────────────────────────────────
insert into public.crm_evento (oportunidade_id, tipo, descricao, autor, criado_em) values
-- Criação de cada oportunidade
('d2000000-0000-0000-0000-000000000001','criacao','Oportunidade criada na etapa "Sem contato".','Cláudia Ferreira', now() - interval '2 days'),
('d2000000-0000-0000-0000-000000000002','criacao','Oportunidade criada na etapa "Sem contato".','Eduardo Nogueira', now() - interval '1 days'),
('d2000000-0000-0000-0000-000000000003','criacao','Oportunidade criada na etapa "Contato feito".','Cláudia Ferreira', now() - interval '9 days'),
('d2000000-0000-0000-0000-000000000004','criacao','Oportunidade criada na etapa "Contato feito".','Eduardo Nogueira', now() - interval '12 days'),
('d2000000-0000-0000-0000-000000000005','criacao','Oportunidade criada na etapa "Contato feito".','Cláudia Ferreira', now() - interval '7 days'),
('d2000000-0000-0000-0000-000000000006','criacao','Oportunidade criada na etapa "Contato feito".','Cláudia Ferreira', now() - interval '5 days'),
('d2000000-0000-0000-0000-000000000007','criacao','Oportunidade criada na etapa "Contato feito".','Eduardo Nogueira', now() - interval '18 days'),
('d2000000-0000-0000-0000-000000000008','criacao','Oportunidade criada na etapa "Contato feito".','Cláudia Ferreira', now() - interval '25 days'),
('d2000000-0000-0000-0000-000000000009','criacao','Oportunidade criada na etapa "Contato feito".','Eduardo Nogueira', now() - interval '30 days'),
('d2000000-0000-0000-0000-000000000010','criacao','Oportunidade criada na etapa "Sem contato".','Cláudia Ferreira', now() - interval '50 days'),
('d2000000-0000-0000-0000-000000000011','criacao','Oportunidade criada na etapa "Sem contato".','Eduardo Nogueira', now() - interval '40 days'),
('d2000000-0000-0000-0000-000000000012','criacao','Oportunidade criada na etapa "Sem contato".','Cláudia Ferreira', now() - interval '35 days'),
('d2000000-0000-0000-0000-000000000013','criacao','Oportunidade criada na etapa "Sem contato".','Eduardo Nogueira', now() - interval '28 days'),
('d2000000-0000-0000-0000-000000000014','criacao','Oportunidade criada na etapa "Sem contato".','Cláudia Ferreira', now() - interval '20 days'),
-- Avanços de etapa / anotações nas mais maduras
('d2000000-0000-0000-0000-000000000005','mudanca_etapa','Etapa alterada de "Contato feito" para "Visita agendada".','Cláudia Ferreira', now() - interval '3 days'),
('d2000000-0000-0000-0000-000000000006','anotacao','Família pediu para agendar logo após a alta hospitalar.','Cláudia Ferreira', now() - interval '4 days'),
('d2000000-0000-0000-0000-000000000007','mudanca_etapa','Etapa alterada de "Visita agendada" para "Visita realizada".','Eduardo Nogueira', now() - interval '5 days'),
('d2000000-0000-0000-0000-000000000008','anotacao','Proposta enviada por e-mail; aguardando decisão da família.','Cláudia Ferreira', now() - interval '6 days'),
-- Admissões (ganhas)
('d2000000-0000-0000-0000-000000000010','mudanca_etapa','Etapa alterada de "Proposta enviada" para "Admissão".','Cláudia Ferreira', now() - interval '9 days'),
('d2000000-0000-0000-0000-000000000010','admissao','Oportunidade marcada como ADMISSÃO (ganha).','Cláudia Ferreira', now() - interval '8 days'),
('d2000000-0000-0000-0000-000000000010','admissao','Cadastro de residente criado a partir desta oportunidade.','Cláudia Ferreira', now() - interval '8 days'),
('d2000000-0000-0000-0000-000000000011','admissao','Oportunidade marcada como ADMISSÃO (ganha).','Eduardo Nogueira', now() - interval '15 days'),
-- Perdas
('d2000000-0000-0000-0000-000000000012','perda','Oportunidade perdida — motivo: Preço.','Cláudia Ferreira', now() - interval '10 days'),
('d2000000-0000-0000-0000-000000000013','perda','Oportunidade perdida — motivo: Escolheu outro residencial.','Eduardo Nogueira', now() - interval '6 days');
