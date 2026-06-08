-- ============================================================================
-- Blue Senior Living — Fundação + módulo Cuidadores
-- Schema inicial (Postgres / Supabase) + dados de teste.
--
-- COMO USAR:
--   1. Abra o Supabase do seu projeto.
--   2. Menu lateral > SQL Editor > New query.
--   3. Cole TODO este arquivo e clique em "Run".
--
-- É seguro rodar mais de uma vez (recria limpo).
-- OBS de segurança: como ainda não há login, as policies abaixo liberam
-- leitura/escrita para o papel anônimo (demo controlada). Ao adicionar
-- autenticação real (LGPD), troque por policies por perfil/usuário.
-- ============================================================================

-- ---------- LIMPEZA (idempotente) ----------
drop table if exists eliminacao_tratamento cascade;
drop table if exists pendencia_tratamento cascade;
drop table if exists modelo_rotina_item cascade;
drop table if exists modelo_rotina cascade;
drop table if exists eliminacao cascade;
drop table if exists tarefa_registro cascade;
drop table if exists administracao cascade;
drop table if exists intercorrencia cascade;
drop table if exists compromisso_externo cascade;
drop table if exists prescricao cascade;
drop table if exists plano_cuidado_item cascade;
drop table if exists cuidador_residente cascade;
drop table if exists usuarios cascade;
drop table if exists residentes cascade;

-- ---------- TABELAS ----------
create table residentes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  data_nascimento date,
  grau_dependencia text check (grau_dependencia in ('I','II','III')),
  modulo int,
  andar int,
  quarto text,
  responsavel_legal text,
  contato text,
  alergias text,
  proteses text,
  historia_vida text,
  data_admissao date
);

create table usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text,
  perfil text not null check (perfil in
    ('master','medico','coordenacao','cuidador','multidisciplinar','farmacia','administracao','familia')),
  ativo boolean not null default true
);

create table cuidador_residente (
  id uuid primary key default gen_random_uuid(),
  cuidador_id uuid not null references usuarios(id) on delete cascade,
  residente_id uuid not null references residentes(id) on delete cascade
);

create table plano_cuidado_item (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  tarefa text not null,
  horario text,
  responsavel text check (responsavel in ('cuidador','enfermagem')),
  tolerancia_minutos int not null default 30,
  ativa boolean not null default true
);

create table tarefa_registro (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  tarefa text not null,
  data date not null default current_date,
  horario text,
  status text not null default 'feito',
  feito_por text,
  feito_em timestamptz not null default now()
);

create table prescricao (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  medicamento text not null,
  dose text,
  via text not null check (via in ('oral','injetavel','insulina','sonda')),
  periodo text not null check (periodo in ('noite','manha','almoco','tarde')),
  horario text,                       -- horário sugerido da prescrição, ex "07:00" (opcional)
  ativa boolean not null default true
);

create table administracao (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  periodo text not null,
  status text not null check (status in ('sim','parcial','nao')),
  itens_faltantes text,
  administrado_por text,
  administrado_em timestamptz not null default now(),
  -- Integração futura com o módulo Farmácia: indica se a baixa de estoque já
  -- foi dada. Nenhuma lógica/tela usa este campo ainda (apenas preparado).
  baixa_farmacia boolean not null default false
);

create table intercorrencia (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  tipo text not null,
  observacao text,
  registrado_por text,
  registrado_em timestamptz not null default now(),
  foto_url text
);

create table compromisso_externo (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  titulo text not null,
  data date,
  horario text,
  horario_transporte text,
  ciente_por text,
  ciente_em timestamptz
);

-- Eliminações: cada registro é um evento pontual (urina/evacuação). A
-- vigilância clínica (sem urina hoje / sem evacuar há 3 dias) é calculada
-- sob demanda no app, não há processo em segundo plano.
create table eliminacao (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  tipo text not null check (tipo in ('urina','evacuacao')),
  registrado_por text,
  registrado_em timestamptz not null default now()
);

-- Modelos de rotina (Coordenação): templates reutilizáveis de plano de cuidado.
create table modelo_rotina (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true
);

create table modelo_rotina_item (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelo_rotina(id) on delete cascade,
  tarefa text not null,
  horario text,
  responsavel text check (responsavel in ('cuidador','enfermagem')),
  tolerancia_minutos int not null default 30
);

-- Tratamento de pendências (Coordenação): marca pendências como resolvidas ou
-- escaladas ao médico, sem alterar as tabelas de origem.
create table pendencia_tratamento (
  id uuid primary key default gen_random_uuid(),
  tipo_origem text not null check (tipo_origem in ('medicacao','intercorrencia','eliminacao','tarefa')),
  referencia_id uuid not null,
  acao text not null check (acao in ('resolvido','escalado_medico')),
  tratado_por text,
  tratado_em timestamptz not null default now(),
  observacao text
);

-- Tratamento dos alertas de eliminação (condição contínua): silenciar por 24h
-- ou escalar ao médico. Não encerra o alerta; ele reaparece se persistir.
create table eliminacao_tratamento (
  id uuid primary key default gen_random_uuid(),
  residente_id uuid not null references residentes(id) on delete cascade,
  tipo_alerta text not null check (tipo_alerta in ('urina','evacuacao')),
  acao text not null check (acao in ('silenciado','escalado_medico')),
  observacao text,
  tratado_por text,
  tratado_em timestamptz not null default now()
);

-- ---------- ÍNDICES úteis ----------
create index on cuidador_residente (cuidador_id);
create index on plano_cuidado_item (residente_id);
create index on tarefa_registro (residente_id, data);
create index on prescricao (residente_id, periodo);
create index on compromisso_externo (residente_id);
create index on eliminacao (residente_id, registrado_em);
create index on modelo_rotina_item (modelo_id);
create index on pendencia_tratamento (tipo_origem, referencia_id);
create index on eliminacao_tratamento (residente_id, tipo_alerta, tratado_em);

-- ---------- RLS (demo sem login) ----------
do $$
declare t text;
begin
  foreach t in array array[
    'residentes','usuarios','cuidador_residente','plano_cuidado_item',
    'tarefa_registro','prescricao','administracao','intercorrencia','compromisso_externo',
    'eliminacao','modelo_rotina','modelo_rotina_item','pendencia_tratamento',
    'eliminacao_tratamento'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists demo_all on %I;', t);
    execute format(
      'create policy demo_all on %I for all to anon, authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================================
-- DADOS DE TESTE
-- ============================================================================

-- ---------- RESIDENTES ----------
insert into residentes (id, nome, data_nascimento, grau_dependencia, modulo, andar, quarto,
  responsavel_legal, contato, alergias, proteses, historia_vida, data_admissao) values
('a0000000-0000-0000-0000-000000000001','Profª Alzira Bittencourt','1938-03-12','III',1,2,'1-2-04',
  'Marcos Bittencourt (filho)','(11) 99812-4455','Dipirona','Dentária total superior',
  'Professora de história aposentada, lecionou por 40 anos. Adora música clássica e jardinagem.','2023-06-10'),
('a0000000-0000-0000-0000-000000000002','Sr. Otávio Lemos','1935-09-28','III',1,2,'1-2-06',
  'Helena Lemos (filha)','(11) 99744-1290','Penicilina','Prótese de quadril (direita)',
  'Engenheiro civil aposentado, construiu pontes pelo interior. Torcedor fanático, gosta de dominó.','2023-02-22'),
('a0000000-0000-0000-0000-000000000003','Dona Iracema Nunes','1941-12-05','II',1,1,'1-1-02',
  'Paulo Nunes (sobrinho)','(11) 99655-7788',null,'Óculos',
  'Costureira durante toda a vida, criou quatro filhos. Gosta de novelas e tricô.','2024-01-15'),
('a0000000-0000-0000-0000-000000000004','Sr. Benedito Faria','1933-07-19','III',2,1,'2-1-08',
  'Sandra Faria (filha)','(11) 99533-2211','Frutos do mar','Marca-passo',
  'Ferroviário aposentado. Conta histórias das antigas estações. Aprecia café forte pela manhã.','2023-11-03'),
('a0000000-0000-0000-0000-000000000005','Dona Cecília Andrade','1944-05-30','I',2,2,'2-2-03',
  'Roberto Andrade (filho)','(11) 99420-6677',null,null,
  'Pianista e professora de música. Ainda toca no salão aos domingos.','2024-03-08'),
('a0000000-0000-0000-0000-000000000006','Sr. Walter Krause','1937-10-14','II',1,1,'1-1-05',
  'Mônica Krause (esposa)','(11) 99388-9900','Sulfa','Aparelho auditivo (bilateral)',
  'Comerciante, dono de uma padaria tradicional do bairro. Madrugador, gosta de pão fresco.','2023-09-17');

-- ---------- USUÁRIOS (um por perfil) ----------
insert into usuarios (id, nome, email, perfil, ativo) values
('b0000000-0000-0000-0000-000000000001','Dr. Eduardo Master','master@blueseniorliving.com.br','master',true),
('b0000000-0000-0000-0000-000000000002','Dra. Helena Geriatra','medico@blueseniorliving.com.br','medico',true),
('b0000000-0000-0000-0000-000000000003','Enf. Patrícia Coordenação','coordenacao@blueseniorliving.com.br','coordenacao',true),
('b0000000-0000-0000-0000-000000000004','Ana Paula','anapaula@blueseniorliving.com.br','cuidador',true),
('b0000000-0000-0000-0000-000000000005','Dra. Renata Fisio','multi@blueseniorliving.com.br','multidisciplinar',true),
('b0000000-0000-0000-0000-000000000006','Farm. Lucas Farmácia','farmacia@blueseniorliving.com.br','farmacia',true),
('b0000000-0000-0000-0000-000000000007','Cláudia Administração','admin@blueseniorliving.com.br','administracao',true),
('b0000000-0000-0000-0000-000000000008','Família Bittencourt','familia@blueseniorliving.com.br','familia',true);

-- ---------- VÍNCULOS cuidador_residente (Ana Paula -> Alzira, Otávio) ----------
insert into cuidador_residente (cuidador_id, residente_id) values
('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001'),
('b0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000002');

-- ---------- PLANO DE CUIDADO da Alzira ----------
insert into plano_cuidado_item (residente_id, tarefa, horario, responsavel, tolerancia_minutos, ativa) values
('a0000000-0000-0000-0000-000000000001','Aferição de sinais vitais','07:00','enfermagem',30,true),
('a0000000-0000-0000-0000-000000000001','Administração de medicação','07:30','cuidador',30,true),
('a0000000-0000-0000-0000-000000000001','Banho e troca','08:00','cuidador',45,true),
('a0000000-0000-0000-0000-000000000001','Higiene oral','08:00','cuidador',30,true),
('a0000000-0000-0000-0000-000000000001','Hidratação','08:30','cuidador',30,true),
('a0000000-0000-0000-0000-000000000001','Mudança de decúbito','09:00','cuidador',30,true),
('a0000000-0000-0000-0000-000000000001','Banho de sol','09:15','cuidador',30,true),
('a0000000-0000-0000-0000-000000000001','Condução à fisioterapia','10:00','cuidador',30,true);

-- ---------- PRESCRIÇÃO da Alzira ----------
insert into prescricao (residente_id, medicamento, dose, via, periodo, horario, ativa) values
('a0000000-0000-0000-0000-000000000001','Losartana','50mg','oral','manha','07:00',true),
('a0000000-0000-0000-0000-000000000001','Metformina','850mg','oral','manha','08:00',true),
('a0000000-0000-0000-0000-000000000001','Insulina NPH','10UI','insulina','manha','07:00',true),
('a0000000-0000-0000-0000-000000000001','Sinvastatina','20mg','oral','noite','21:00',true),
('a0000000-0000-0000-0000-000000000001','AAS','100mg','oral','almoco','12:00',true),
('a0000000-0000-0000-0000-000000000001','Enalapril','10mg','oral','tarde','16:00',true);

-- ---------- COMPROMISSOS EXTERNOS (2 de teste) ----------
insert into compromisso_externo (residente_id, titulo, data, horario, horario_transporte) values
('a0000000-0000-0000-0000-000000000001','Consulta oftalmológica', current_date + 1,'14:30','13:45'),
('a0000000-0000-0000-0000-000000000002','Sessão de hemodiálise', current_date,'09:00','08:15');

-- ---------- ELIMINAÇÕES da Alzira (2 urinas hoje, 1 evacuação anteontem) ----------
insert into eliminacao (residente_id, tipo, registrado_por, registrado_em) values
('a0000000-0000-0000-0000-000000000001','urina','Ana Paula', now() - interval '3 hours'),
('a0000000-0000-0000-0000-000000000001','urina','Ana Paula', now() - interval '30 minutes'),
('a0000000-0000-0000-0000-000000000001','evacuacao','Ana Paula', now() - interval '2 days');

-- ---------- MODELO DE ROTINA de teste (Coordenação) ----------
do $$
declare m_id uuid;
begin
  insert into modelo_rotina (nome) values ('Rotina padrão grau III') returning id into m_id;
  insert into modelo_rotina_item (modelo_id, tarefa, horario, responsavel, tolerancia_minutos) values
    (m_id,'Sinais vitais','07:00','enfermagem',30),
    (m_id,'Medicação','07:30','cuidador',30),
    (m_id,'Higiene oral','08:00','cuidador',30),
    (m_id,'Banho e troca','08:00','cuidador',30),
    (m_id,'Hidratação','08:30','cuidador',30),
    (m_id,'Mudança de decúbito','09:00','cuidador',30),
    (m_id,'Banho de sol','09:15','cuidador',30);
end $$;

-- Fim.
