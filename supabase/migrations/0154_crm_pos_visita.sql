-- ===========================================================================
-- 0154 — CRM · CONDUÇÃO PÓS-VISITA (função desenhada pelo sócio-diretor).
-- ---------------------------------------------------------------------------
-- Depois da visita física, o consultor registra em 2 minutos (celular): quem
-- visitou, as dores e a objeção da família, "o que ouvimos", a simulação de
-- valor e os próximos passos. O app monta as mensagens de WhatsApp
-- personalizadas (envio manual, com um toque, pelo número do consultor) e a
-- sequência de contatos.
--
-- Decisões (nov/2026):
--  · Funil: Sem contato > Contato feito > Visita agendada > Proposta enviada
--    (é aqui que rodam as mensagens) > Contrato em preparação > Em lista de
--    espera. Fora da fila: Vendido (status ganha), Pausado (nutrição de longo
--    prazo) e Perdido. "Visita realizada" e "Admissão" saem do funil ativo
--    (ficam inativas, para o histórico).
--  · Sem retorno: 3 contatos na primeira semana (D0, D+3, D+7). Sem resposta,
--    o lead é dado como perdido — motivo "Não respondeu mais" (não pausa).
--  · Simulação: preço da tabela; 15% de desconto na longa permanência e na
--    reabilitação; sem desconto no Day Use e na curta permanência; validade de
--    30 dias; "valor estimado, sujeito à avaliação médica".
--  · Avaliação no Google: modelo existe, desligado (ainda sem link).
--  · Contrato: e-mail com minuta PROVISÓRIA (placeholder) e checklist.
--
-- a) Funil e motivos de perda.
-- b) Campos do pós-visita na oportunidade e nas tarefas.
-- c) Biblioteca de dores/objeções e modelos de mensagem (editáveis), com os
--    textos do sócio-diretor (sem os "[confirmar]", Medicar citada).
-- d) crm_salvar_pos_visita(p jsonb): grava tudo numa transação.
-- e) Avançar de etapa, vender, perder, pausar ou opt-out cancela as mensagens
--    automáticas pendentes (no servidor).
--
-- Idempotente. Rode após a 0153.
-- ===========================================================================

-- ── a · Funil ────────────────────────────────────────────────────────────────
insert into public.crm_etapa (nome, ordem, ativo) values
  ('Contrato em preparação', 5, true), ('Em lista de espera', 6, true)
on conflict (nome) do update set ativo = true, ordem = excluded.ordem;
update public.crm_etapa set ativo = true, ordem = 1 where nome = 'Sem contato';
update public.crm_etapa set ativo = true, ordem = 2 where nome = 'Contato feito';
update public.crm_etapa set ativo = true, ordem = 3 where nome = 'Visita agendada';
update public.crm_etapa set ativo = true, ordem = 4 where nome = 'Proposta enviada';
update public.crm_etapa set ativo = false, ordem = 90 where nome = 'Visita realizada';
update public.crm_etapa set ativo = false, ordem = 91 where nome = 'Admissão';

-- Quem estava em "Visita realizada" (ativo) passa para "Proposta enviada".
with movidas as (
  update public.crm_oportunidade set etapa = 'Proposta enviada'
   where etapa = 'Visita realizada' and status in ('nova','em_andamento','pausada')
  returning id
)
insert into public.crm_evento (oportunidade_id, tipo, descricao, autor)
select id, 'mudanca_etapa', 'Funil novo: "Visita realizada" passou a ser "Proposta enviada".', 'Sistema'
  from movidas;

-- ── a · Motivos de perda ─────────────────────────────────────────────────────
do $$
declare r record;
begin
  for r in select * from (values
    ('Família desistiu/cuidado domiciliar', 'Optaram por cuidador em casa'),
    ('Sem vaga na suíte desejada', 'Sem vaga'),
    ('Outro', 'Outros')) x(antigo, novo)
  loop
    if exists (select 1 from public.crm_motivo_perda where nome = r.antigo) then
      if exists (select 1 from public.crm_motivo_perda where nome = r.novo) then
        update public.crm_motivo_perda set ativo = false where nome = r.antigo;
      else
        update public.crm_motivo_perda set nome = r.novo, ativo = true where nome = r.antigo;
      end if;
      update public.crm_oportunidade set motivo_perda = r.novo where motivo_perda = r.antigo;
    end if;
  end loop;
end $$;
update public.crm_motivo_perda set ativo = false where nome = 'Grau de dependência incompatível';
insert into public.crm_motivo_perda (nome, ativo) values
  ('Preço', true), ('Escolheu outro residencial', true), ('Optaram por cuidador em casa', true),
  ('Falecimento', true), ('Sem vaga', true), ('Idoso recusou', true), ('Não respondeu mais', true),
  ('Nós desistimos (ia ser problema)', true), ('Mora em outra cidade', true), ('Não gostaram', true),
  ('Outros', true)
on conflict (nome) do update set ativo = true;

-- ── b · Campos do pós-visita ─────────────────────────────────────────────────
alter table public.crm_oportunidade
  add column if not exists dores                   text[] not null default '{}',
  add column if not exists objecoes                text[] not null default '{}',
  add column if not exists o_que_ouvimos           text,
  add column if not exists detalhe_pessoal         text,
  add column if not exists residente_chamar        text,     -- como chamar nas mensagens: "Dona Maria"
  add column if not exists residente_tratamento    text,     -- "sua mãe", "seu pai"
  add column if not exists perfil_visita           text,
  add column if not exists visita_em               timestamptz,
  add column if not exists visita_positiva         boolean,
  add column if not exists simulacao               jsonb,
  add column if not exists simulacao_validade      date,
  add column if not exists proximos_passos         jsonb not null default '[]',
  add column if not exists pergunta_confirmacao    text,
  add column if not exists consentimento_whatsapp  boolean not null default false,
  add column if not exists opt_out                 boolean not null default false,
  add column if not exists ultimo_retorno_em       timestamptz,
  add column if not exists visita_agendamento_id   uuid references public.visita_agendamento(id) on delete set null;
alter table public.crm_oportunidade drop constraint if exists crm_oportunidade_perfil_visita_check;
alter table public.crm_oportunidade add constraint crm_oportunidade_perfil_visita_check
  check (perfil_visita is null or perfil_visita in ('familia','proprio_idoso','casal'));
comment on column public.crm_oportunidade.simulacao is
  'Simulação entregue na visita: {opcoes:[{modalidade,tipo_suite,ocupacao,grau,valor_tabela,desconto_pct,valor_final,unidade}]}.';

alter table public.crm_tarefa
  add column if not exists modelo              text,            -- M1, M2, M4… (mensagem gerada)
  add column if not exists mensagem            text,            -- texto já personalizado
  add column if not exists canal               text,
  add column if not exists tentativa           smallint,        -- 1, 2, 3 = contatos da primeira semana
  add column if not exists automatica          boolean not null default false,
  add column if not exists cancelada           boolean not null default false,
  add column if not exists motivo_cancelamento text,
  add column if not exists concluida_em        timestamptz;
alter table public.crm_tarefa drop constraint if exists crm_tarefa_canal_check;
alter table public.crm_tarefa add constraint crm_tarefa_canal_check
  check (canal is null or canal in ('whatsapp','email','telefone'));
alter table public.crm_tarefa drop constraint if exists crm_tarefa_tentativa_check;
alter table public.crm_tarefa add constraint crm_tarefa_tentativa_check
  check (tentativa is null or tentativa between 1 and 3);
create index if not exists crm_tarefa_pendente_idx on public.crm_tarefa (data) where not concluida and not cancelada;

-- ── c · Biblioteca e modelos ─────────────────────────────────────────────────
create table if not exists public.crm_biblioteca (
  codigo          text primary key,                  -- D01…D10, O01…O06
  tipo            text not null check (tipo in ('dor','objecao')),
  titulo          text not null,
  sinais          text,
  o_que_ouvimos   text,
  como_resolve    text,
  prova_social    text,
  conteudo_titulo text,                              -- conteúdo específico da dor
  conteudo_link   text,                              -- vai junto com o material (M2)
  texto_whatsapp  text not null,
  observacoes     text,
  ativo           boolean not null default true,
  ordem           int not null default 0,
  atualizado_em   timestamptz not null default now()
);
comment on table public.crm_biblioteca is 'Dores e objeções da conversa de visita, com o texto de WhatsApp de cada uma (pós-visita).';

create table if not exists public.crm_modelo_mensagem (
  codigo           text primary key,                 -- M1…M7, OPTOUT, AVISO_CONTRATO, MINUTA_EMAIL
  nome             text not null,
  dias_apos_visita int,
  quando           text,
  texto            text not null,
  ativo            boolean not null default true,
  ordem            int not null default 0,
  atualizado_em    timestamptz not null default now()
);
comment on table public.crm_modelo_mensagem is 'Modelos de mensagem do pós-visita, com {variáveis} preenchidas pelo app.';

do $$ declare t text;
begin
  foreach t in array array['crm_biblioteca','crm_modelo_mensagem'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists crm_admin_all on public.%I', t);
    execute format('create policy crm_admin_all on public.%I for all to authenticated '
      || 'using (public.app_perfil() in (''master'',''direcao'')) '
      || 'with check (public.app_perfil() in (''master'',''direcao''))', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Textos do sócio-diretor (biblioteca de dores/objeções e sequência de mensagens). Só entram se ainda
-- não existirem: edições feitas no app são preservadas.
insert into public.crm_biblioteca (codigo, tipo, titulo, sinais, o_que_ouvimos, como_resolve, prova_social, conteudo_titulo, texto_whatsapp, observacoes, ordem) values
  ($t$D01$t$, 'dor', $t$Quedas e segurança física$t$, $t$"ele já caiu", "tenho medo que caia no banheiro", "mora em casa com escada", "fica sozinho à noite".$t$, $t$Vocês nos contaram que {residente} [já teve quedas / mora em casa com escadas] e que o maior medo é que algo aconteça quando não há ninguém por perto.$t$, $t$Ambientes adaptados: barras de apoio, piso antiderrapante, sem degraus
Sistema de chamada/campainha no quarto e banheiro
Equipe presente 24h, inclusive de madrugada
Protocolo de atendimento em caso de queda$t$, $t$depoimento de filho(a) cujo pai/mãe caía em casa e parou de cair (ou foi socorrido rapidamente) no Blue.$t$, $t$7 pontos da casa que mais causam quedas em idosos — e como corrigir$t$, $t$Sobre a preocupação com quedas: aqui no Blue os ambientes foram pensados para isso — barras de apoio, piso antiderrapante e campainha de chamada no quarto e no banheiro — e há equipe acordada a noite toda. Se {residente} precisar de ajuda às 3h da manhã, alguém chega em minutos.$t$, null, 1),
  ($t$D02$t$, 'dor', $t$Solidão e isolamento$t$, $t$"ela fica o dia todo vendo TV", "perdeu os amigos", "ficou viúvo", "está triste/apática", "não sai mais de casa".$t$, $t$Vocês comentaram que, desde [que ficou viúva / que parou de sair], {residente} tem passado muito tempo sozinha e anda mais desanimada.$t$, $t$Agenda diária de atividades (física, cognitiva, social, cultural)
Refeições em grupo
Convivência com pessoas da mesma geração
Eventos e passeios$t$, $t$foto/relato de residente que chegou retraído e hoje participa das atividades; depoimento de família ("minha mãe voltou a sorrir").$t$, $t$Solidão na terceira idade: por que faz tão mal à saúde quanto o cigarro (com dados de fonte confiável)$t$, $t$Vocês comentaram que {residente} anda passando muito tempo sozinha. Isso é uma das coisas que mais muda aqui: tem atividade todos os dias, refeição em grupo e gente da mesma geração para conversar. Segue a agenda desta semana para vocês verem como é a rotina 👇$t$, null, 2),
  ($t$D03$t$, 'dor', $t$Medicação e acompanhamento de saúde$t$, $t$"esquece os remédios", "toma muitos remédios", "tem diabetes/pressão", "toma remédio errado", "precisa medir glicemia".$t$, $t$Vocês nos contaram que {residente} toma [vários medicamentos] e que tem sido difícil garantir que tome tudo certo, na hora certa.$t$, $t$Administração de medicação pela equipe de enfermagem, com registro
Controle de sinais vitais e acompanhamento de doenças crônicas
Relação com o médico da família / geriatra
Diferencial Medicar: retaguarda de atendimento de urgência$t$, $t$depoimento de família que vivia o estresse do "será que tomou?".$t$, $t$Erros de medicação em idosos: os 5 mais comuns$t$, $t$Sobre os remédios: aqui quem administra é a nossa equipe de enfermagem, no horário certo e com registro de cada dose. Vocês não precisam mais ficar com aquela dúvida de "será que ela tomou?".$t$, null, 3),
  ($t$D04$t$, 'dor', $t$Demência / Alzheimer / declínio cognitivo$t$, $t$"está esquecendo as coisas", "se perdeu na rua", "deixou o gás aberto", "tem diagnóstico de Alzheimer", "repete as perguntas".$t$, $t$Vocês compartilharam que {residente} tem [esquecido coisas importantes / diagnóstico de Alzheimer] e que isso tem trazido situações de risco em casa.$t$, $t$Ambiente seguro e supervisionado
Estimulação cognitiva planejada
Equipe treinada em cuidado de demência
Rotina estruturada (reduz confusão e agitação)$t$, $t$depoimento de família que viveu um episódio de risco (fogão, sair de casa) e encontrou tranquilidade.$t$, $t$Alzheimer: como saber em que fase está e que tipo de cuidado cada fase pede$t$, $t$Sabemos que lidar com a perda de memória de quem a gente ama é muito difícil. Aqui {residente} teria uma rotina organizada, estimulação cognitiva planejada e um ambiente seguro — sem o risco do fogão, da porta da rua, dos remédios trocados.$t$, $t$Atenção: confirmar se o Blue atende todos os graus de demência. Se não atende os graus avançados, não prometer.$t$, 4),
  ($t$D05$t$, 'dor', $t$Alimentação inadequada$t$, $t$"não come direito", "está emagrecendo", "come só bolacha", "tem dieta especial", "não cozinha mais".$t$, $t$Vocês notaram que {residente} [tem emagrecido / não tem se alimentado bem] desde que passou a ficar mais sozinha.$t$, $t$Cardápio elaborado por nutricionista
6 refeições por dia
Dietas especiais (diabetes, hipossódica, pastosa)
Refeições em grupo, o que estimula o apetite$t$, $t$foto do cardápio e das refeições; residente que recuperou peso.$t$, $t$Por que idosos perdem o apetite — e o que fazer$t$, $t$Sobre a alimentação: aqui são 6 refeições por dia, com cardápio feito por nutricionista e adaptado às necessidades de cada residente. E comer acompanhado faz muita diferença no apetite. Segue o cardápio da semana 👇$t$, null, 5),
  ($t$D06$t$, 'dor', $t$Família mora longe / não consegue acompanhar$t$, $t$"moro em outra cidade", "trabalho o dia todo", "sou o único filho aqui", "não consigo ir todo dia".$t$, $t$Vocês comentaram que [moram longe / têm uma rotina de trabalho intensa] e que fica difícil acompanhar o dia a dia de {residente}.$t$, $t$Comunicação ativa com a família (fotos, notícias, WhatsApp/app)
Horários de visita flexíveis
Contato imediato em qualquer intercorrência$t$, $t$depoimento de filho(a) que mora longe ("hoje eu durmo tranquilo").$t$, $t$Cuidando à distância: como acompanhar a saúde dos pais morando longe$t$, $t$Para quem mora longe, a tranquilidade vem da informação. Aqui a família recebe fotos e recados da equipe pelo portal da família e é avisada na hora se acontecer qualquer coisa. Vocês continuam presentes, mesmo à distância.$t$, null, 6),
  ($t$D07$t$, 'dor', $t$Problemas com cuidador em casa$t$, $t$"a cuidadora pediu demissão", "falta muito", "não confio", "já troquei 3 vezes", "folga de fim de semana é um caos".$t$, $t$Vocês contaram que a experiência com cuidadores em casa tem sido difícil — [faltas, trocas frequentes, falta de preparo].$t$, $t$Equipe completa, com escala e cobertura de folgas e férias
Profissionais treinados e supervisionados
A família deixa de ser "gestora de RH"$t$, $t$depoimento de família que saiu do ciclo de trocas de cuidador.$t$, $t$Comparativo de custo real: cuidador 24h em casa × Blue (ver O01)$t$, $t$Vocês contaram das dificuldades com cuidadores. Aqui vocês nunca mais vão precisar resolver falta, folga, férias ou substituição — isso é responsabilidade nossa. Vocês voltam a ser filhos, e não gestores.$t$, null, 7),
  ($t$D08$t$, 'dor', $t$Sobrecarga e esgotamento do familiar cuidador$t$, $t$"não aguento mais", "não tenho vida", "estou doente também", "minha saúde está indo embora", "brigas na família", choro durante a visita.$t$, $t$Percebemos o quanto vocês têm se dedicado a {residente} — e o quanto isso tem pesado.$t$, $t$Devolve à família o papel de afeto, não de cuidado técnico
Visitas de qualidade em vez de rotina de exaustão$t$, $t$depoimento de filha ("hoje eu visito minha mãe para conversar, não para dar banho").$t$, $t$Síndrome do cuidador: sinais de que você precisa de ajuda$t$, $t$Percebemos o quanto vocês têm se dedicado a {residente}. Cuidar de quem cuida também importa. Muitas famílias nos contam que, depois da mudança, a relação melhorou: as visitas viraram momentos de carinho, e não de tarefa.$t$, $t$Atenção: muito acolhedor. Nunca insinuar que o familiar "não está dando conta".$t$, 8),
  ($t$D09$t$, 'dor', $t$Mobilidade reduzida / dependência para atividades diárias$t$, $t$"precisa de ajuda para tomar banho", "usa andador/cadeira de rodas", "não consegue se vestir sozinho".$t$, $t$Vocês nos contaram que {residente} hoje precisa de ajuda para [banho / vestir-se / locomoção].$t$, $t$Apoio nas atividades diárias, preservando a autonomia possível
Acessibilidade total
Fisioterapia / atividade física adaptada$t$, $t$residente que ganhou mobilidade com fisioterapia.$t$, $t$Como preservar a autonomia do idoso no dia a dia$t$, $t$Aqui {residente} recebe ajuda no que precisa — banho, vestir-se, locomoção — mas sempre estimulando a fazer sozinha o que ainda consegue. Autonomia é saúde.$t$, null, 9),
  ($t$D10$t$, 'dor', $t$Pós-alta hospitalar / recuperação$t$, $t$"acabou de sair do hospital", "fez cirurgia", "teve AVC", "precisa de reabilitação".$t$, $t$Vocês nos contaram que {residente} [saiu recentemente do hospital / está se recuperando de ...].$t$, $t$Estadia temporária / de recuperação
Acompanhamento de enfermagem e reabilitação$t$, $t$caso de recuperação pós-cirúrgica.$t$, null, $t$Para esse momento de recuperação, temos a curta permanência e a reabilitação, com acompanhamento médico e de enfermagem. Muitas famílias começam assim — e decidem depois com calma.$t$, null, 10),
  ($t$O01$t$, 'objecao', $t$É caro / preço$t$, null, null, null, null, null, $t$Sabemos que é uma decisão importante também financeiramente. Muitas famílias se surpreendem quando colocam tudo na ponta do lápis: um cuidador 24h em casa envolve 3 a 4 profissionais em escala, encargos trabalhistas, folgas, férias, substituições, alimentação, adaptação da casa... Preparei um comparativo simples para vocês verem lado a lado 👇$t$, $t$Abordagem: não dar desconto de cara. Comparar com o custo real da alternativa.
Material: planilha/PDF "Cuidador em casa × Blue" com números reais.$t$, 11),
  ($t$O02$t$, 'objecao', $t$Culpa (sinto que estou abandonando)$t$, null, null, null, null, null, $t$É muito comum sentir culpa nesse momento — sinal do quanto vocês amam {residente}. Mas escolher um lugar onde ela vai estar segura, cuidada e acompanhada não é abandono; é cuidado. E vocês continuam presentes, do jeito de sempre.$t$, null, 12),
  ($t$O03$t$, 'objecao', $t$Meu pai/minha mãe não quer$t$, null, null, null, null, null, $t$É natural {residente} resistir no começo — é uma mudança grande. O que mais ajuda é ela conhecer o Blue sem compromisso. Que tal trazê-la para um almoço, um café ou uma atividade aqui? Muitas vezes é ela mesma que decide depois disso.$t$, $t$Próximo passo: convite para almoço/atividade experiência.$t$, 13),
  ($t$O04$t$, 'objecao', $t$Preciso conversar com a família$t$, null, null, null, null, null, $t$Claro! É uma decisão para ser tomada em família. Para facilitar, segue um resumo do Blue que vocês podem encaminhar para os demais 👇 E se for útil, podemos marcar uma nova visita ou uma videochamada com todos.$t$, $t$Próximo passo: visita/videochamada com os demais familiares.$t$, 14),
  ($t$O05$t$, 'objecao', $t$Ainda não é a hora / Ele ainda está bem$t$, null, null, null, null, null, $t$Faz todo sentido. Muitas famílias nos procuram com antecedência justamente para decidir com calma, sem a pressão de uma emergência. Fica aqui nosso contato — e se quiserem, podemos manter vocês informados sobre eventos abertos e disponibilidade de vagas.$t$, $t$Próximo passo: nutrição de longo prazo (D+30, D+60).$t$, 15),
  ($t$O06$t$, 'objecao', $t$Estamos visitando outros lugares$t$, null, null, null, null, null, $t$Ótimo — é assim que se faz uma boa escolha! Se ajudar, preparamos uma lista de perguntas importantes para fazer em cada visita (vale para qualquer lugar) 👇$t$, $t$Material: "10 perguntas para fazer ao visitar uma residência sênior". Material de autoridade, e as perguntas naturalmente favorecem os diferenciais do Blue.$t$, 16)
on conflict (codigo) do nothing;

insert into public.crm_modelo_mensagem (codigo, nome, dias_apos_visita, quando, texto, ativo, ordem) values
  ($t$M1$t$, $t$Agradecimento + o que ouvimos$t$, 0, $t$Contato 1 (D0), até 2h depois da visita. No máximo 2 dores e 1 objeção.$t$, $t$Olá, {visitante}! Aqui é {consultor}, do Blue. 😊

Muito obrigado(a) pela visita {dia_visita}. Foi um prazer conhecer vocês{detalhe_pessoal}.

Fiquei pensando na nossa conversa. Vocês nos contaram que {frase_o_que_ouvimos}.

{blocos_dores}

{bloco_objecao}

Qualquer dúvida, pode me chamar aqui mesmo, a qualquer hora.$t$, true, 1),
  ($t$M2$t$, $t$Material + simulação + conteúdo das dores$t$, 0, $t$Contato 1 (D0), logo depois da M1. Anexe o PDF institucional.$t$, $t$Segue o material do Blue com as principais informações: estrutura, serviços e rotina. 👇

Segue também a simulação que fizemos juntos, para vocês terem à mão e compartilharem com a família:

{simulacao}

{conteudos_dores}

Fique à vontade para encaminhar a quem também participa da decisão.$t$, true, 2),
  ($t$M3$t$, $t$Avaliação Google$t$, 1, $t$D+1 de manhã, só se a visita foi positiva. Desligada até termos o link de avaliação.$t$, $t$Bom dia, {visitante}! Aqui é {consultor}, do Blue.

Um pedido rápido: se a visita de vocês foi boa, poderia nos deixar uma avaliação no Google? Isso ajuda muito outras famílias que estão passando pelo mesmo momento.

É bem simples, leva menos de 1 minuto:
👉 Toque no link abaixo
👉 Escolha as estrelas
👉 Se quiser, escreva uma frase (não é obrigatório)

{link_google}

Muito obrigado(a)!$t$, false, 3),
  ($t$M4$t$, $t$Próximos passos com datas$t$, 3, $t$Contato 2 (D+3). Sempre termina com uma pergunta.$t$, $t$Olá, {visitante}! Tudo bem?

Para facilitar, organizei os próximos passos que conversamos:

{proximos_passos}

{pergunta_confirmacao}

{opt_out}

Fico à disposição!
{consultor}$t$, true, 4),
  ($t$M5$t$, $t$Retomada com depoimento$t$, 7, $t$Contato 3 (D+7). Preencha a situação parecida e o depoimento antes de enviar.$t$, $t$Olá, {visitante}! Aqui é {consultor}, do Blue.

Lembrei de vocês esta semana. A família de uma residente nossa, que também {situacao_parecida}, contou assim:

"{depoimento}"

Como vocês estão pensando sobre {residente}? Se surgiu alguma dúvida, estou aqui.$t$, true, 5),
  ($t$M6$t$, $t$Convite para evento ou almoço$t$, null, $t$Quando a família respondeu e ainda não decidiu. Preencha a data e o evento.$t$, $t$Oi, {visitante}! Tudo bem com vocês e com {residente}?

No dia {data_evento} teremos {evento} aqui no Blue. Seria uma ótima oportunidade para {residente} conhecer o ambiente sem compromisso.

Querem vir? É só me avisar.$t$, true, 6),
  ($t$M7$t$, $t$Nutrição de longo prazo$t$, 30, $t$Lead pausado: 30 e 60 dias depois.$t$, $t$Olá, {visitante}! Aqui é {consultor}, do Blue.

Vi este conteúdo e lembrei da nossa conversa sobre {residente}:
{conteudo_util}

Espero que esteja tudo bem por aí. Quando quiserem, estamos aqui.$t$, true, 7),
  ($t$OPTOUT$t$, $t$Opt-out (LGPD)$t$, null, $t$Vai uma única vez, no fim da M4.$t$, $t$Se preferir não receber mais mensagens, é só me avisar.$t$, true, 8),
  ($t$AVISO_CONTRATO$t$, $t$Aviso de contrato enviado por e-mail$t$, null, $t$Pelo WhatsApp, quando a minuta for por e-mail.$t$, $t${visitante}, te enviei por e-mail a minuta do contrato e a lista do que precisamos. Qualquer dúvida, me chama aqui.$t$, true, 9),
  ($t$MINUTA_EMAIL$t$, $t$E-mail com a minuta do contrato (PROVISÓRIO)$t$, null, $t$Na etapa Contrato em preparação. Texto e minuta provisórios: troque quando a minuta oficial estiver pronta.$t$, $t$Olá, {visitante}!

Conforme combinamos, segue a minuta do contrato de {residente} com o Blue Senior Living para vocês lerem com calma. Os campos que mudam de família para família estão destacados.

[MINUTA PROVISÓRIA — substituir pela minuta oficial aprovada pelo advogado]

Para prepararmos a entrada, precisamos de:
☐ Dados e documentos do responsável financeiro e de {residente} (RG, CPF, comprovante de endereço)
☐ Relatório médico, receitas e prescrições atuais
☐ Alergias, exames recentes e carteira de vacinação
☐ Nome e contato do médico que acompanha {residente}
☐ Dois contatos de emergência
☐ Procuração ou curatela, se houver
☐ Autorizações: uso de imagem, saídas e visitas
☐ Forma de pagamento e data prevista de entrada

Qualquer dúvida, estou à disposição.
{consultor}
Blue Senior Living$t$, true, 10)
on conflict (codigo) do nothing;

-- ── d · Salvar o pós-visita numa transação ───────────────────────────────────
-- p: { oportunidade_id?, visita_agendamento_id?,
--      contato: { nome, telefone, email, relacao, nome_idoso, idade_idoso, grau_estimado },
--      oportunidade: { dores[], objecoes[], o_que_ouvimos, detalhe_pessoal, residente_chamar,
--        residente_tratamento, perfil_visita, visita_em, visita_positiva, simulacao,
--        simulacao_validade, proximos_passos, pergunta_confirmacao, consentimento_whatsapp,
--        valor_mensalidade_estimado, tipo_suite_interesse },
--      tarefas: [{ tipo, assunto, modelo, mensagem, canal, tentativa, data, hora }] }
-- Refazer o pós-visita cancela as mensagens automáticas ainda pendentes e gera as novas.
create or replace function public.crm_salvar_pos_visita(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_nome   text := (select nome from public.usuarios where id = public.app_usuario_id());
  v_op     public.crm_oportunidade;
  v_op_id  uuid := nullif(p ->> 'oportunidade_id', '')::uuid;
  v_vis_id uuid := nullif(p ->> 'visita_agendamento_id', '')::uuid;
  v_cont   uuid;
  c        jsonb := coalesce(p -> 'contato', '{}'::jsonb);
  o        jsonb := coalesce(p -> 'oportunidade', '{}'::jsonb);
  t        jsonb;
  v_ordem_atual int;
  v_ordem_proposta int := (select ordem from public.crm_etapa where nome = 'Proposta enviada');
  v_n int := 0;
  v_cancel int;
begin
  if coalesce(public.app_perfil(), '') not in ('master','direcao') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if length(trim(coalesce(c ->> 'nome', ''))) = 0 then raise exception 'Informe quem visitou.'; end if;

  -- Visita da agenda já ligada a uma oportunidade: usa a mesma.
  if v_op_id is null and v_vis_id is not null then
    select oportunidade_id into v_op_id from public.visita_agendamento where id = v_vis_id;
  end if;

  if v_op_id is null then
    insert into public.crm_contato (nome, telefones, emails, relacao, nome_idoso, idade_idoso, grau_estimado, base_legal_lgpd)
    values (trim(c ->> 'nome'),
            case when nullif(trim(c ->> 'telefone'), '') is null then '{}' else array[trim(c ->> 'telefone')] end,
            case when nullif(trim(c ->> 'email'), '') is null then '{}' else array[trim(c ->> 'email')] end,
            nullif(c ->> 'relacao', ''), nullif(trim(c ->> 'nome_idoso'), ''), nullif(c ->> 'idade_idoso', '')::int,
            nullif(c ->> 'grau_estimado', ''),
            case when (o ->> 'consentimento_whatsapp')::boolean then 'consentimento' else 'nao_definida' end)
    returning id into v_cont;
    insert into public.crm_oportunidade (nome, contato_id, etapa, status, responsavel)
    values (concat_ws(' — ', trim(c ->> 'nome'), nullif(trim(c ->> 'nome_idoso'), '')), v_cont, 'Proposta enviada', 'em_andamento', v_nome)
    returning id into v_op_id;
    insert into public.crm_evento (oportunidade_id, tipo, descricao, autor)
    values (v_op_id, 'criacao', 'Oportunidade criada no registro do pós-visita.', v_nome);
  else
    select * into v_op from public.crm_oportunidade where id = v_op_id for update;
    if v_op.id is null then raise exception 'Oportunidade não encontrada.'; end if;
    if v_op.status in ('ganha','perdida') then raise exception 'Esta oportunidade já foi encerrada (vendida ou perdida).'; end if;
    update public.crm_contato set
      nome = trim(c ->> 'nome'),
      telefones = case when nullif(trim(c ->> 'telefone'), '') is null then telefones
                       else array[trim(c ->> 'telefone')] || array_remove(telefones, trim(c ->> 'telefone')) end,
      emails = case when nullif(trim(c ->> 'email'), '') is null then emails
                    else array[trim(c ->> 'email')] || array_remove(emails, trim(c ->> 'email')) end,
      relacao = coalesce(nullif(c ->> 'relacao', ''), relacao),
      nome_idoso = coalesce(nullif(trim(c ->> 'nome_idoso'), ''), nome_idoso),
      idade_idoso = coalesce(nullif(c ->> 'idade_idoso', '')::int, idade_idoso),
      grau_estimado = coalesce(nullif(c ->> 'grau_estimado', ''), grau_estimado),
      base_legal_lgpd = case when (o ->> 'consentimento_whatsapp')::boolean then 'consentimento' else base_legal_lgpd end
     where id = v_op.contato_id;
    v_ordem_atual := (select ordem from public.crm_etapa where nome = v_op.etapa and ativo);
    if coalesce(v_ordem_atual, 0) < coalesce(v_ordem_proposta, 4) then
      update public.crm_oportunidade set etapa = 'Proposta enviada', status = 'em_andamento' where id = v_op_id;
      insert into public.crm_evento (oportunidade_id, tipo, descricao, autor)
      values (v_op_id, 'mudanca_etapa', format('Etapa alterada de "%s" para "Proposta enviada" (pós-visita).', v_op.etapa), v_nome);
    elsif v_op.status = 'pausada' then
      update public.crm_oportunidade set status = 'em_andamento' where id = v_op_id;
    end if;
  end if;

  update public.crm_oportunidade set
    dores = coalesce(array(select jsonb_array_elements_text(o -> 'dores')), '{}'),
    objecoes = coalesce(array(select jsonb_array_elements_text(o -> 'objecoes')), '{}'),
    o_que_ouvimos = nullif(trim(o ->> 'o_que_ouvimos'), ''),
    detalhe_pessoal = nullif(trim(o ->> 'detalhe_pessoal'), ''),
    residente_chamar = nullif(trim(o ->> 'residente_chamar'), ''),
    residente_tratamento = nullif(trim(o ->> 'residente_tratamento'), ''),
    perfil_visita = nullif(o ->> 'perfil_visita', ''),
    visita_em = coalesce(nullif(o ->> 'visita_em', '')::timestamptz, now()),
    visita_positiva = (o ->> 'visita_positiva')::boolean,
    simulacao = o -> 'simulacao',
    simulacao_validade = nullif(o ->> 'simulacao_validade', '')::date,
    proximos_passos = coalesce(o -> 'proximos_passos', '[]'::jsonb),
    pergunta_confirmacao = nullif(trim(o ->> 'pergunta_confirmacao'), ''),
    consentimento_whatsapp = coalesce((o ->> 'consentimento_whatsapp')::boolean, false),
    valor_mensalidade_estimado = coalesce(nullif(o ->> 'valor_mensalidade_estimado', '')::numeric, valor_mensalidade_estimado),
    tipo_suite_interesse = coalesce(nullif(o ->> 'tipo_suite_interesse', ''), tipo_suite_interesse),
    visita_agendamento_id = coalesce(v_vis_id, visita_agendamento_id),
    responsavel = coalesce(responsavel, v_nome)
   where id = v_op_id;

  if v_vis_id is not null then
    update public.visita_agendamento set oportunidade_id = v_op_id where id = v_vis_id;
  end if;

  -- Refazer: as mensagens automáticas pendentes dão lugar às novas.
  update public.crm_tarefa set cancelada = true, motivo_cancelamento = 'Pós-visita registrado de novo'
   where oportunidade_id = v_op_id and automatica and not concluida and not cancelada;
  get diagnostics v_cancel = row_count;

  for t in select * from jsonb_array_elements(coalesce(p -> 'tarefas', '[]'::jsonb)) loop
    insert into public.crm_tarefa (oportunidade_id, tipo, assunto, descricao, responsavel, data, hora,
                                   modelo, mensagem, canal, tentativa, automatica)
    values (v_op_id, coalesce(nullif(t ->> 'tipo', ''), 'WhatsApp'), coalesce(nullif(trim(t ->> 'assunto'), ''), 'Mensagem'),
            nullif(t ->> 'descricao', ''), v_nome, nullif(t ->> 'data', '')::date, nullif(t ->> 'hora', ''),
            nullif(t ->> 'modelo', ''), nullif(t ->> 'mensagem', ''), nullif(t ->> 'canal', ''),
            nullif(t ->> 'tentativa', '')::smallint, true);
    v_n := v_n + 1;
  end loop;

  insert into public.crm_evento (oportunidade_id, tipo, descricao, autor)
  values (v_op_id, 'pos_visita',
          format('Pós-visita registrado: %s dor(es), %s objeção(ões), %s mensagem(ns) programada(s)%s.',
                 coalesce(jsonb_array_length(o -> 'dores'), 0), coalesce(jsonb_array_length(o -> 'objecoes'), 0), v_n,
                 case when v_cancel > 0 then format(' (%s pendente(s) anterior(es) cancelada(s))', v_cancel) else '' end),
          v_nome);
  return v_op_id;
end $$;
revoke all on function public.crm_salvar_pos_visita(jsonb) from public, anon;
grant execute on function public.crm_salvar_pos_visita(jsonb) to authenticated;

-- ── e · Avançar, vender, perder, pausar ou opt-out cancela a sequência ──────
create or replace function public.fn_crm_cancela_sequencia()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_motivo text;
  v_ordem_nova int;
  v_ordem_proposta int;
begin
  if new.status is distinct from old.status and new.status in ('ganha','perdida','pausada') then
    v_motivo := case new.status when 'ganha' then 'Vendido' when 'perdida' then 'Perdido' else 'Pausado' end;
  elsif new.opt_out and not old.opt_out then
    v_motivo := 'Família pediu para não receber mensagens';
  elsif new.etapa is distinct from old.etapa then
    select ordem into v_ordem_nova from public.crm_etapa where nome = new.etapa;
    select ordem into v_ordem_proposta from public.crm_etapa where nome = 'Proposta enviada';
    if v_ordem_nova > v_ordem_proposta and v_ordem_nova < 90 then
      v_motivo := format('Avançou para "%s"', new.etapa);
    end if;
  end if;
  if v_motivo is not null then
    update public.crm_tarefa set cancelada = true, motivo_cancelamento = v_motivo
     where oportunidade_id = new.id and automatica and not concluida and not cancelada;
  end if;
  return new;
end $$;
drop trigger if exists trg_crm_cancela_sequencia on public.crm_oportunidade;
create trigger trg_crm_cancela_sequencia after update of etapa, status, opt_out on public.crm_oportunidade
  for each row execute function public.fn_crm_cancela_sequencia();

-- Fim.
