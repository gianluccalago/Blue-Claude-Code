-- ===========================================================================
-- 0041 — Hóspedes MOCK para demonstração
-- ---------------------------------------------------------------------------
-- Popula 8 novos hóspedes (ids c0000000-…-0001..0008) com o máximo de
-- informação possível para demonstrar o software: ficha completa, prescrições
-- (uma assinada por 2 médicos, p/ mostrar a receita separada por prescritor),
-- plano de cuidado, dieta, avaliação IVCF, evoluções, intercorrências,
-- compromissos externos, estoque, mensalidade (mix pago/pendente) e extras.
--
-- IDEMPOTENTE: limpa os registros desses ids em todas as tabelas-filhas antes
-- de reinserir, então pode rodar quantas vezes quiser.
-- Médica prescritora: Helena Marques (b…0002). Master/médico: Eduardo (b…0001).
-- ===========================================================================

-- ── Limpeza idempotente (filhos antes do pai; cobre tabelas sem cascade) ─────
do $$
declare ids uuid[] := array[
  'c0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000002',
  'c0000000-0000-0000-0000-000000000003','c0000000-0000-0000-0000-000000000004',
  'c0000000-0000-0000-0000-000000000005','c0000000-0000-0000-0000-000000000006',
  'c0000000-0000-0000-0000-000000000007','c0000000-0000-0000-0000-000000000008']::uuid[];
begin
  delete from upselling             where residente_id = any(ids);
  delete from pagamento_mensalidade where residente_id = any(ids);
  delete from estoque_hospede       where residente_id = any(ids);
  delete from compromisso_externo   where residente_id = any(ids);
  delete from intercorrencia        where residente_id = any(ids);
  delete from avaliacao_ivcf        where residente_id = any(ids);
  delete from evolucao              where residente_id = any(ids);
  delete from evolucao_nutricional  where residente_id = any(ids);
  delete from dieta                 where residente_id = any(ids);
  delete from plano_cuidado_item    where residente_id = any(ids);
  delete from prescricao            where residente_id = any(ids);
  delete from cuidador_residente    where residente_id = any(ids);
  delete from residentes            where id = any(ids);
end $$;

-- ── RESIDENTES (ficha completa) ──────────────────────────────────────────────
insert into residentes
  (id, nome, data_nascimento, grau_dependencia, grau_contratual, modulo, andar, quarto,
   tipo_suite, ocupacao, data_admissao, responsavel_legal, contato,
   contato_emergencia_nome, contato_emergencia_telefone,
   plano_saude_operadora, plano_saude_numero, hospital_referencia,
   alergias, proteses, historia_vida, mensalidade_valor) values
('c0000000-0000-0000-0000-000000000001','Geraldo Tavares','1940-04-18','II','II',2,1,'2-1-04',
   'Suíte','individual', current_date - interval '14 months','Marília Tavares (filha)','(41) 99810-2233',
   'Marília Tavares','(41) 99810-2233','Unimed Curitiba','0099-8812-4471-0','Hospital Marcelino Champagnat',
   'Sulfa','Ponte de safena (2015)',
   'Bancário aposentado, gerente por 30 anos. Apaixonado por futebol e churrasco de domingo. Conta causos do banco.',
   9800),
('c0000000-0000-0000-0000-000000000002','Lourdes Saraiva','1936-09-02','III','III',1,1,'1-1-08',
   'Suíte Modular','individual', current_date - interval '20 months','Pedro Saraiva (filho)','(41) 99721-5566',
   'Pedro Saraiva','(41) 99721-5566','Bradesco Saúde','BR-5521-9087','Hospital Nossa Senhora das Graças',
   null,'Prótese dentária total; cadeira de rodas',
   'Professora de português aposentada. Sofreu AVC em 2021, com sequela motora à direita. Adora poesia e ser lida em voz alta.',
   12400),
('c0000000-0000-0000-0000-000000000003','Aparecido Nogueira','1933-12-27','III','III',2,2,'2-2-06',
   'Suíte','individual', current_date - interval '9 months','Sônia Nogueira (filha)','(41) 99655-7781',
   'Sônia Nogueira','(41) 99655-7781','SulAmérica','SA-7741-2230','Hospital Marcelino Champagnat',
   'Penicilina','Marca-passo; aparelho auditivo',
   'Agricultor a vida toda no interior do Paraná. Doença de Parkinson. Gosta de viola caipira e de histórias da roça.',
   12900),
('c0000000-0000-0000-0000-000000000004','Therezinha Quadros','1942-06-11','I','I',1,2,'1-2-02',
   'Long Stay','individual', current_date - interval '5 months','Cláudio Quadros (sobrinho)','(41) 99540-3398',
   'Cláudio Quadros','(41) 99540-3398','Unimed Curitiba','0099-3321-7765-1','Hospital VITA Batel',
   null,'Óculos multifocais',
   'Ex-comerciária, dona de uma loja de tecidos. Muito independente e comunicativa. Lidera o bingo das quartas.',
   7600),
('c0000000-0000-0000-0000-000000000005','Salim Haddad','1938-02-23','II','II',2,1,'2-1-02',
   'Suíte','individual', current_date - interval '11 months','Tânia Haddad (filha)','(41) 99488-1102',
   'Tânia Haddad','(41) 99488-1102','Amil','AM-2098-5512','Hospital VITA Batel',
   'AAS','Oxigenoterapia noturna',
   'Engenheiro civil, construiu pontes pelo estado. DPOC, usa O2 à noite. Conversa sobre obras e história por horas.',
   10500),
('c0000000-0000-0000-0000-000000000006','Dirce Fontana','1945-10-05','I','I',1,1,'1-1-03',
   'Apartamento','individual', current_date - interval '3 months','Renato Fontana (filho)','(41) 99377-6640',
   'Renato Fontana','(41) 99377-6640','Unimed Curitiba','0099-7766-3322-2','Hospital Nossa Senhora das Graças',
   null,'Prótese de joelho (esquerdo)',
   'Costureira por 40 anos, fez vestidos de noiva da cidade toda. Artrose nas mãos. Adora crochê e música italiana.',
   8200),
('c0000000-0000-0000-0000-000000000007','Waldemar Pires','1931-07-30','III','III',2,2,'2-2-08',
   'Suíte Modular','individual', current_date - interval '17 months','Inês Pires (filha)','(41) 99260-8893',
   'Inês Pires','(41) 99260-8893','Bradesco Saúde','BR-1190-4456','Hospital Marcelino Champagnat',
   'Iodo','Sonda enteral (gastrostomia); acamado',
   'Ferroviário aposentado, maquinista da antiga RFFSA. Demência avançada, acamado. A família pede música dos anos 50 no quarto.',
   13500),
('c0000000-0000-0000-0000-000000000008','Neusa Bittencourt','1939-03-14','II','I',1,2,'1-2-06b',
   'Suíte','dupla', current_date - interval '7 months','Fábio Bittencourt (filho)','(41) 99150-2271',
   'Fábio Bittencourt','(41) 99150-2271','SulAmérica','SA-3312-9980','Hospital VITA Batel',
   'Dipirona','Prótese auditiva bilateral',
   'Secretária executiva aposentada. Quadro de depressão e osteoporose; queda recente. Gosta de tricô e novelas.',
   9900);

-- ── VÍNCULO CUIDADOR ↔ HÓSPEDE (distribui entre a equipe existente) ──────────
insert into cuidador_residente (cuidador_id, residente_id) values
('b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000002'),
('b0000000-0000-0000-0000-000000000009','c0000000-0000-0000-0000-000000000003'),
('b0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000004'),
('b0000000-0000-0000-0000-000000000010','c0000000-0000-0000-0000-000000000005'),
('b0000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000006'),
('b0000000-0000-0000-0000-000000000011','c0000000-0000-0000-0000-000000000007'),
('b0000000-0000-0000-0000-000000000004','c0000000-0000-0000-0000-000000000008');

-- ── PRESCRIÇÕES (assinadas pela médica Helena; Geraldo tem 2 prescritores) ───
insert into prescricao
  (residente_id, medicamento, dose, via, periodo, horario, quantidade, posologia, ativa, prescrito_por) values
-- C1 Geraldo (diabético/hipertenso) — Helena assina a maioria…
('c0000000-0000-0000-0000-000000000001','Losartana','50mg','oral','manha','08:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000001','Metformina','850mg','oral','almoco','12:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000001','Sinvastatina','20mg','oral','noite','20:00','1 comprimido','1x/dia à noite',true,'b0000000-0000-0000-0000-000000000002'),
-- …e o cardiologista (Master/médico Eduardo) assina os cardiológicos → 2ª receita
('c0000000-0000-0000-0000-000000000001','Carvedilol','6,25mg','oral','manha','08:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000001'),
('c0000000-0000-0000-0000-000000000001','AAS','100mg','oral','almoco','12:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000001'),
-- C2 Lourdes (pós-AVC, disfagia)
('c0000000-0000-0000-0000-000000000002','Clopidogrel','75mg','oral','manha','08:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000002','Atorvastatina','40mg','oral','noite','20:00','1 comprimido','1x/dia à noite',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000002','Enalapril','10mg','oral','manha','08:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000002','Sertralina','50mg','oral','manha','08:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
-- C3 Aparecido (Parkinson)
('c0000000-0000-0000-0000-000000000003','Levodopa + Carbidopa','250/25mg','oral','manha','07:00','1 comprimido','8/8h',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000003','Levodopa + Carbidopa','250/25mg','oral','almoco','13:00','1 comprimido','8/8h',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000003','Levodopa + Carbidopa','250/25mg','oral','noite','21:00','1 comprimido','8/8h',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000003','Pramipexol','0,25mg','oral','almoco','12:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000003','Omeprazol','20mg','oral','jejum','06:00','1 comprimido','1x/dia em jejum',true,'b0000000-0000-0000-0000-000000000002'),
-- C4 Therezinha (grau I, leve HAS)
('c0000000-0000-0000-0000-000000000004','Hidroclorotiazida','25mg','oral','manha','08:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000004','Cálcio + Vitamina D','600mg','oral','almoco','12:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
-- C5 Salim (DPOC)
('c0000000-0000-0000-0000-000000000005','Formoterol + Budesonida','12/400mcg','oral','manha','08:00','1 inalação','12/12h',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000005','Formoterol + Budesonida','12/400mcg','oral','noite','20:00','1 inalação','12/12h',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000005','Tiotrópio','18mcg','oral','manha','09:00','1 inalação','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000005','Enalapril','5mg','oral','manha','08:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
-- C6 Dirce (grau I, artrose)
('c0000000-0000-0000-0000-000000000006','Paracetamol','750mg','oral','almoco','12:00','1 comprimido','8/8h se dor',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000006','Glucosamina + Condroitina','1500mg','oral','manha','08:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
-- C7 Waldemar (acamado, sonda enteral)
('c0000000-0000-0000-0000-000000000007','Ácido valproico','250mg','sonda','manha','08:00','10 ml','12/12h',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000007','Ácido valproico','250mg','sonda','noite','20:00','10 ml','12/12h',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000007','Omeprazol','40mg','sonda','jejum','06:00','1 comprimido diluído','1x/dia em jejum',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000007','Enoxaparina','40mg','injetavel','noite','20:00','1 ampola','1x/dia à noite',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000007','Risperidona','1mg','sonda','noite','21:00','5 ml','1x/dia à noite',true,'b0000000-0000-0000-0000-000000000002'),
-- C8 Neusa (depressão, osteoporose)
('c0000000-0000-0000-0000-000000000008','Escitalopram','10mg','oral','manha','08:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000008','Alendronato de sódio','70mg','oral','jejum','06:00','1 comprimido','1x/semana (segunda), em jejum',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000008','Carbonato de cálcio + D','600mg','oral','almoco','12:00','1 comprimido','1x/dia',true,'b0000000-0000-0000-0000-000000000002'),
('c0000000-0000-0000-0000-000000000008','Trazodona','50mg','oral','noite','21:00','1 comprimido','1x/dia à noite',true,'b0000000-0000-0000-0000-000000000002');

-- ── DIETAS ───────────────────────────────────────────────────────────────────
insert into dieta (residente_id, consistencia, restricoes, observacoes, ativa, definida_por) values
('c0000000-0000-0000-0000-000000000001','Normal/livre','{Diabético,Hipossódica}','Evitar açúcar de adição; controle glicêmico antes do café.',true,'Camila Rocha'),
('c0000000-0000-0000-0000-000000000002','Pastosa','{"Disfagia (espessante)",Hipossódica}','Espessante nível néctar em todos os líquidos. Supervisão na refeição.',true,'Camila Rocha'),
('c0000000-0000-0000-0000-000000000003','Branda','{Hiperproteica}','Cortar alimentos em pedaços pequenos; ritmo lento (tremor).',true,'Camila Rocha'),
('c0000000-0000-0000-0000-000000000004','Normal/livre','{}','Sem restrições. Aprecia saladas e frutas.',true,'Camila Rocha'),
('c0000000-0000-0000-0000-000000000005','Normal/livre','{Hipossódica}','Fracionar refeições; dispneia melhora com porções menores.',true,'Camila Rocha'),
('c0000000-0000-0000-0000-000000000006','Normal/livre','{Hipocalórica}','Controle de peso; reforço de cálcio.',true,'Camila Rocha'),
('c0000000-0000-0000-0000-000000000007','Líquida','{"Enteral (sonda)",Hiperproteica}','Dieta enteral por gastrostomia, 6x/dia em bomba. Cabeceira elevada 45°.',true,'Camila Rocha'),
('c0000000-0000-0000-0000-000000000008','Branda','{Hiperproteica,"Sem lactose"}','Reforço proteico p/ osteoporose; intolerância à lactose.',true,'Camila Rocha');

-- ── PLANO DE CUIDADO (itens por hóspede; responsavel cuidador/enfermagem) ────
insert into plano_cuidado_item (residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
('c0000000-0000-0000-0000-000000000001','Glicemia capilar antes do café','06:30','enfermagem',20,true),
('c0000000-0000-0000-0000-000000000001','Aferir pressão arterial','08:00','enfermagem',30,true),
('c0000000-0000-0000-0000-000000000001','Caminhada assistida no jardim','16:00','cuidador',45,true),
('c0000000-0000-0000-0000-000000000002','Mudança de decúbito (2/2h)','08:00','cuidador',20,true),
('c0000000-0000-0000-0000-000000000002','Higiene oral pós-refeições','09:00','cuidador',30,true),
('c0000000-0000-0000-0000-000000000002','Avaliar deglutição na refeição','12:00','enfermagem',15,true),
('c0000000-0000-0000-0000-000000000003','Auxílio na marcha (risco de queda)','10:00','cuidador',30,true),
('c0000000-0000-0000-0000-000000000003','Exercícios de fonoarticulação','15:00','cuidador',30,true),
('c0000000-0000-0000-0000-000000000004','Estimular hidratação','10:00','cuidador',60,true),
('c0000000-0000-0000-0000-000000000005','Verificar saturação de O2','22:00','enfermagem',20,true),
('c0000000-0000-0000-0000-000000000005','Instalar oxigênio noturno','21:30','enfermagem',20,true),
('c0000000-0000-0000-0000-000000000006','Compressas mornas nas mãos','09:00','cuidador',30,true),
('c0000000-0000-0000-0000-000000000007','Mudança de decúbito (2/2h)','06:00','cuidador',20,true),
('c0000000-0000-0000-0000-000000000007','Cuidados com gastrostomia','08:00','enfermagem',20,true),
('c0000000-0000-0000-0000-000000000007','Higiene íntima e prevenção de escara','10:00','cuidador',30,true),
('c0000000-0000-0000-0000-000000000008','Acompanhar deambulação (pós-queda)','09:00','cuidador',30,true),
('c0000000-0000-0000-0000-000000000008','Estimular participação em atividades','15:00','cuidador',60,true);

-- ── AVALIAÇÃO IVCF-20 (uma por hóspede, coerente com o grau) ─────────────────
insert into avaliacao_ivcf
  (residente_id, respostas, pontuacao_total, classificacao, dominios_alterados, registrado_por, registrado_em) values
('c0000000-0000-0000-0000-000000000001','{}'::jsonb,14,'Grau II','{Comorbidade,Medicação}','Helena Marques', now() - interval '40 days'),
('c0000000-0000-0000-0000-000000000002','{}'::jsonb,28,'Grau III','{Mobilidade,Comunicação,AVD}','Helena Marques', now() - interval '25 days'),
('c0000000-0000-0000-0000-000000000003','{}'::jsonb,26,'Grau III','{Mobilidade,Humor,Comorbidade}','Helena Marques', now() - interval '30 days'),
('c0000000-0000-0000-0000-000000000004','{}'::jsonb,6,'Grau I','{}','Helena Marques', now() - interval '20 days'),
('c0000000-0000-0000-0000-000000000005','{}'::jsonb,15,'Grau II','{Comorbidade,Mobilidade}','Helena Marques', now() - interval '35 days'),
('c0000000-0000-0000-0000-000000000006','{}'::jsonb,7,'Grau I','{Comorbidade}','Helena Marques', now() - interval '18 days'),
('c0000000-0000-0000-0000-000000000007','{}'::jsonb,34,'Grau III','{Mobilidade,Cognição,Comunicação,AVD}','Helena Marques', now() - interval '15 days'),
('c0000000-0000-0000-0000-000000000008','{}'::jsonb,16,'Grau II','{Humor,Mobilidade}','Helena Marques', now() - interval '22 days');

-- ── EVOLUÇÕES CLÍNICAS (médica) ──────────────────────────────────────────────
insert into evolucao (residente_id, texto, registrado_por, registrado_em) values
('c0000000-0000-0000-0000-000000000001','Glicemias estáveis na última semana (média 130). PA controlada. Mantém conduta.','Helena Marques', now() - interval '6 days'),
('c0000000-0000-0000-0000-000000000002','Deglutição segura para consistência pastosa. Sem sinais de broncoaspiração. Fono acompanhando.','Helena Marques', now() - interval '4 days'),
('c0000000-0000-0000-0000-000000000003','Tremor de repouso estável. Ajustada Levodopa para 8/8h com boa resposta motora.','Helena Marques', now() - interval '9 days'),
('c0000000-0000-0000-0000-000000000005','Saturação noturna 92-94% com O2 a 2L. Sem exacerbação de DPOC. Orientado fracionamento de dieta.','Helena Marques', now() - interval '3 days'),
('c0000000-0000-0000-0000-000000000007','Mantém-se acamado, estável hemodinamicamente. Gastrostomia sem sinais flogísticos. Profilaxia de TVP mantida.','Helena Marques', now() - interval '2 days'),
('c0000000-0000-0000-0000-000000000008','Humor em melhora após ajuste de Escitalopram. Sem novas quedas. Mantém fisioterapia.','Helena Marques', now() - interval '5 days');

-- ── EVOLUÇÕES NUTRICIONAIS ───────────────────────────────────────────────────
insert into evolucao_nutricional (residente_id, texto, registrado_por, registrado_em) values
('c0000000-0000-0000-0000-000000000002','Aceitação de 80% da dieta pastosa. Mantido espessante néctar. Peso estável.','Camila Rocha', now() - interval '7 days'),
('c0000000-0000-0000-0000-000000000007','Dieta enteral 1500 kcal/dia bem tolerada, sem resíduo gástrico aumentado.','Camila Rocha', now() - interval '6 days'),
('c0000000-0000-0000-0000-000000000004','Boa aceitação alimentar, hidratação adequada. Orientada manutenção.','Camila Rocha', now() - interval '10 days');

-- ── INTERCORRÊNCIAS (registradas pela equipe de ponta) ───────────────────────
insert into intercorrencia (residente_id, tipo, observacao, registrado_por, registrado_em) values
('c0000000-0000-0000-0000-000000000008','Queda','Queda — Hematoma. Queda da própria altura no banheiro, hematoma em quadril D. Sem perda de consciência. Médica avisada.','Beatriz Lima', now() - interval '12 days'),
('c0000000-0000-0000-0000-000000000003','Humor/sono','Humor/sono — Insônia. Noite agitada, dificuldade para iniciar o sono. Aceitou chá e música.','Joana Ribeiro', now() - interval '3 days'),
('c0000000-0000-0000-0000-000000000005','Alteração de consciência','Alteração de consciência — Sonolência. Mais sonolento pela manhã, saturação 90%. Ajustado O2 e reavaliado.','Carla Mendes', now() - interval '5 days'),
('c0000000-0000-0000-0000-000000000002','Recusa','Recusa — Alimentação. Recusou parte do almoço, aceitou complemento à tarde.','Mariana Souza', now() - interval '2 days'),
('c0000000-0000-0000-0000-000000000001','Recusa','Recusa — Medicação. Recusou a sinvastatina à noite; orientado e reapresentado, aceitou.','Ana Paula Dias', now() - interval '8 days');

-- ── COMPROMISSOS EXTERNOS ────────────────────────────────────────────────────
insert into compromisso_externo (residente_id, titulo, data, horario, horario_transporte, detalhes) values
('c0000000-0000-0000-0000-000000000001','Consulta cardiologista', current_date + 3,'10:30','09:45','Levar últimos exames de sangue e ECG.'),
('c0000000-0000-0000-0000-000000000003','Neurologista — Parkinson', current_date + 6,'14:00','13:00','Levar diário de sintomas motores.'),
('c0000000-0000-0000-0000-000000000005','Pneumologista — revisão DPOC', current_date + 1,'09:00','08:00','Jejum não necessário. Levar oxímetro.'),
('c0000000-0000-0000-0000-000000000008','Densitometria óssea', current_date + 9,'08:30','07:40','Não usar cremes na pele no dia do exame.'),
('c0000000-0000-0000-0000-000000000002','Sessão de fonoaudiologia', current_date + 2,'15:00',null,'Atendimento na própria casa — sem transporte.');

-- ── ESTOQUE INDIVIDUAL (mês atual) ───────────────────────────────────────────
insert into estoque_hospede (residente_id, medicamento, mes_referencia, quantidade_provisionada, quantidade_atual, unidade) values
('c0000000-0000-0000-0000-000000000001','Losartana', to_char(current_date,'YYYY-MM'),30,22,'comprimido'),
('c0000000-0000-0000-0000-000000000001','Metformina', to_char(current_date,'YYYY-MM'),30,24,'comprimido'),
('c0000000-0000-0000-0000-000000000003','Levodopa + Carbidopa', to_char(current_date,'YYYY-MM'),90,61,'comprimido'),
('c0000000-0000-0000-0000-000000000005','Tiotrópio', to_char(current_date,'YYYY-MM'),30,19,'cápsula'),
('c0000000-0000-0000-0000-000000000007','Enoxaparina', to_char(current_date,'YYYY-MM'),30,17,'ampola'),
('c0000000-0000-0000-0000-000000000008','Escitalopram', to_char(current_date,'YYYY-MM'),30,26,'comprimido');

-- ── MENSALIDADES DO MÊS (mix pago/pendente) ──────────────────────────────────
insert into pagamento_mensalidade (residente_id, mes_referencia, valor, status, pago_em, registrado_por) values
('c0000000-0000-0000-0000-000000000001', to_char(current_date,'YYYY-MM'), 9800,'pago',  now() - interval '4 days','Administração'),
('c0000000-0000-0000-0000-000000000002', to_char(current_date,'YYYY-MM'),12400,'pago',  now() - interval '6 days','Administração'),
('c0000000-0000-0000-0000-000000000003', to_char(current_date,'YYYY-MM'),12900,'pendente', null,'Administração'),
('c0000000-0000-0000-0000-000000000004', to_char(current_date,'YYYY-MM'), 7600,'pago',  now() - interval '2 days','Administração'),
('c0000000-0000-0000-0000-000000000005', to_char(current_date,'YYYY-MM'),10500,'pendente', null,'Administração'),
('c0000000-0000-0000-0000-000000000006', to_char(current_date,'YYYY-MM'), 8200,'pago',  now() - interval '8 days','Administração'),
('c0000000-0000-0000-0000-000000000007', to_char(current_date,'YYYY-MM'),13500,'pago',  now() - interval '1 days','Administração'),
('c0000000-0000-0000-0000-000000000008', to_char(current_date,'YYYY-MM'), 9900,'pendente', null,'Administração');

-- ── EXTRAS / UPSELLING (mês atual) ───────────────────────────────────────────
insert into upselling (residente_id, categoria, descricao, valor, data, mes_referencia, lancado_por) values
('c0000000-0000-0000-0000-000000000001','Manicure/cabeleireiro','Corte e barba', 70.00, current_date - 5, to_char(current_date,'YYYY-MM'),'Administração'),
('c0000000-0000-0000-0000-000000000002','Fisioterapia avulsa','Sessão extra de RPG', 150.00, current_date - 4, to_char(current_date,'YYYY-MM'),'Administração'),
('c0000000-0000-0000-0000-000000000003','Fonoaudiologia','Pacote semanal', 320.00, current_date - 3, to_char(current_date,'YYYY-MM'),'Administração'),
('c0000000-0000-0000-0000-000000000005','Medicamentos','Inalador não coberto pelo plano', 189.90, current_date - 6, to_char(current_date,'YYYY-MM'),'Farmácia'),
('c0000000-0000-0000-0000-000000000008','Manicure/cabeleireiro','Escova e hidratação', 90.00, current_date - 2, to_char(current_date,'YYYY-MM'),'Administração');
