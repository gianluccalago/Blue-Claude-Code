-- ===========================================================================
-- 0155 — TABELA DE PREÇOS NOVEMBRO/2026, DIÁRIAS, SERVIÇOS À PARTE E MINUTA.
-- ---------------------------------------------------------------------------
-- Fonte: planilha "Tabela preços novembro 2026" do sócio-diretor.
--
-- a) Mensalidades: nova VIGÊNCIA a partir de 01/11/2026 (o histórico fica; quem
--    já é residente continua com a mensalidade dele). O app guarda o preço
--    CHEIO; o "com desconto máximo" da planilha é o cheio com 15% — o desconto
--    que a simulação do pós-visita aplica (conferido em todas as combinações).
--    Faixas novas na mesma tabela: grau 'MC' (Memory Care) e 'REAB'
--    (Reabilitação, preço único — só Apartamento individual na planilha).
--    Tipos novos: "Long Stay Cuidados Intensivos" (grau III individual) e
--    "Suíte Master" (a planilha traz o valor já com desconto; o cheio é ele
--    dividido por 0,85). "Suíte" do app recebe os preços da "Suíte Luxo".
-- b) Diárias (referência para curta permanência e Seniors Day): curta
--    permanência por diária; Seniors Day por plano (2ª a 6ª, 2ª-4ª-6ª, 3ª e 5ª,
--    sábado e domingo) e o pacote de fim de semana (17h de sexta às 10h de
--    segunda). Sem desconto. A referência antiga "período da tarde" sai.
-- c) Serviços cobrados à parte (catálogo editável), com a REMOÇÃO: R$ 850,00
--    por remoção, quando necessário. Os itens sem valor na planilha ficam "a
--    combinar".
-- d) E-mail da minuta: o app passa a gerar a minuta em Word (contrato Blue)
--    preenchida com os dados do CRM; o texto do e-mail é trocado só se ainda
--    for o provisório da 0154.
--
-- Idempotente. Rode após a 0154.
-- ===========================================================================

-- ── a · Mensalidades (preço cheio), vigência 01/11/2026 ─────────────────────
insert into public.tabela_preco (tipo_suite, grau, ocupacao, valor, vigente_a_partir_de)
select t.tipo, t.grau, t.ocup, t.valor, date '2026-11-01' from (values
  ('Apartamento', 'I', 'simples', 23529.41),
  ('Apartamento', 'I', 'duplo', 19764.71),
  ('Apartamento', 'II', 'simples', 27647.06),
  ('Apartamento', 'II', 'duplo', 21529.41),
  ('Apartamento', 'III', 'simples', 32000.00),
  ('Apartamento', 'III', 'duplo', 26352.94),
  ('Apartamento', 'MC', 'simples', 40000.00),
  ('Apartamento', 'REAB', 'simples', 27058.82),
  ('Long Stay', 'I', 'simples', 16117.65),
  ('Long Stay', 'I', 'duplo', 12941.18),
  ('Long Stay', 'II', 'simples', 19176.47),
  ('Long Stay', 'II', 'duplo', 14823.53),
  ('Long Stay', 'III', 'simples', 22235.29),
  ('Long Stay', 'III', 'duplo', 18352.94),
  ('Long Stay', 'MC', 'simples', 24705.88),
  ('Suíte Premium', 'I', 'simples', 14823.53),
  ('Suíte Premium', 'I', 'duplo', 12117.65),
  ('Suíte Premium', 'II', 'simples', 17529.41),
  ('Suíte Premium', 'II', 'duplo', 13529.41),
  ('Suíte Premium', 'III', 'simples', 20235.29),
  ('Suíte Premium', 'III', 'duplo', 16705.88),
  ('Suíte Premium', 'MC', 'simples', 22470.59),
  ('Suíte', 'I', 'simples', 12941.18),
  ('Suíte', 'I', 'duplo', 10470.59),
  ('Suíte', 'II', 'simples', 15529.41),
  ('Suíte', 'II', 'duplo', 12352.94),
  ('Suíte', 'III', 'simples', 18117.65),
  ('Suíte', 'III', 'duplo', 14941.18),
  ('Suíte', 'MC', 'simples', 20117.65),
  ('Long Stay Cuidados Intensivos', 'III', 'simples', 14823.53),
  ('Suíte Master', 'I', 'simples', 17647.06),
  ('Suíte Master', 'I', 'duplo', 11764.71),
  ('Suíte Master', 'II', 'simples', 19411.76),
  ('Suíte Master', 'II', 'duplo', 14117.65),
  ('Suíte Master', 'III', 'simples', 21176.47),
  ('Suíte Master', 'III', 'duplo', 17647.06)
) t(tipo, grau, ocup, valor)
on conflict (tipo_suite, grau, ocupacao, vigente_a_partir_de) do update set valor = excluded.valor;

-- ── b · Diárias (referência) ─────────────────────────────────────────────────
alter table public.tabela_diaria drop constraint if exists tabela_diaria_tipo_valor_check;
alter table public.tabela_diaria add constraint tabela_diaria_tipo_valor_check
  check (tipo_valor in ('diaria','day_care_periodo','sd_2a_6a','sd_2a_4a_6a','sd_3a_5a','sd_sab_dom','fds_pacote'));
delete from public.tabela_diaria where modalidade = 'day_care' and tipo_valor = 'day_care_periodo';
insert into public.tabela_diaria (modalidade, grau, tipo_valor, valor_referencia, observacao)
select t.modalidade, t.grau, t.tipo, t.valor, 'Tabela de preços nov/2026' from (values
  ('day_care', 'I', 'sd_2a_6a', 346.50),
  ('day_care', 'I', 'sd_2a_4a_6a', 367.50),
  ('day_care', 'I', 'sd_3a_5a', 383.25),
  ('day_care', 'I', 'sd_sab_dom', 367.50),
  ('day_care', 'I', 'fds_pacote', 1627.50),
  ('curta_permanencia', 'I', 'diaria', 546.00),
  ('day_care', 'II', 'sd_2a_6a', 421.58),
  ('day_care', 'II', 'sd_2a_4a_6a', 462.00),
  ('day_care', 'II', 'sd_3a_5a', 477.75),
  ('day_care', 'II', 'sd_sab_dom', 462.00),
  ('day_care', 'II', 'fds_pacote', 2021.25),
  ('curta_permanencia', 'II', 'diaria', 682.50),
  ('day_care', 'III', 'sd_2a_6a', 551.25),
  ('day_care', 'III', 'sd_2a_4a_6a', 588.00),
  ('day_care', 'III', 'sd_3a_5a', 614.25),
  ('day_care', 'III', 'sd_sab_dom', 588.00),
  ('day_care', 'III', 'fds_pacote', 2483.25),
  ('curta_permanencia', 'III', 'diaria', 819.00)
) t(modalidade, grau, tipo, valor)
on conflict (modalidade, grau, tipo_valor) do update
  set valor_referencia = excluded.valor_referencia, observacao = excluded.observacao, atualizado_em = now();

-- ── c · Serviços cobrados à parte ────────────────────────────────────────────
create table if not exists public.tabela_servico (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null unique,
  valor               numeric check (valor is null or valor >= 0),   -- null = a combinar
  unidade             text not null,                                  -- mensal, anual, diária, por sessão…
  categoria_upselling text not null default 'Outros',                 -- categoria ao lançar como extra
  ativo               boolean not null default true,
  ordem               int not null default 0,
  atualizado_em       timestamptz not null default now(),
  atualizado_por      text
);
comment on table public.tabela_servico is 'Serviços cobrados à parte (Anexo II do contrato) com o preço de tabela.';
alter table public.tabela_servico enable row level security;
drop policy if exists tabela_servico_select on public.tabela_servico;
drop policy if exists tabela_servico_write on public.tabela_servico;
create policy tabela_servico_select on public.tabela_servico for select to authenticated
  using (public.app_perfil() in ('administracao','direcao','master'));
create policy tabela_servico_write on public.tabela_servico for all to authenticated
  using (public.app_perfil() in ('direcao','master'))
  with check (public.app_perfil() in ('direcao','master'));
revoke all on public.tabela_servico from anon;

insert into public.tabela_servico (nome, valor, unidade, categoria_upselling, ordem) values
  ('Lavagem e passadoria de roupas', 750, 'mensal', 'Lavanderia extra', 1),
  ('Enxoval e etiquetagem de roupas', 1200, 'anual', 'Outros', 2),
  ('Cuidador exclusivo 12 horas', 300, 'diária', 'Outros', 3),
  ('Cuidador exclusivo 12h (período inferior a 3 meses)', 7600, 'mensal', 'Outros', 4),
  ('Cuidador exclusivo 12h diurno (período acima de 3 meses)', 12700, 'mensal', 'Outros', 5),
  ('Cuidador exclusivo 12h noturno (período acima de 3 meses)', 15600, 'mensal', 'Outros', 6),
  ('Room service', 2000, 'mensal', 'Outros', 7),
  ('Fisioterapia individual', 150, 'por sessão', 'Fisioterapia avulsa', 8),
  ('Fonoaudiologia individual', 150, 'por sessão', 'Terapia avulsa', 9),
  ('Terapia ocupacional individual', 150, 'por sessão', 'Terapia avulsa', 10),
  ('Personal trainer', 150, 'por sessão', 'Outros', 11),
  ('Salão de beleza', null, 'por uso', 'Manicure/cabeleireiro', 12),
  ('Acompanhamento a consultas e exames', null, 'por saída', 'Acompanhamento externo', 13),
  ('Passeios externos', null, 'por passeio', 'Passeios', 14),
  ('Medicamentos, fraldas e produtos de higiene', null, 'por uso', 'Medicamentos', 15),
  ('Dietas especiais', null, 'por uso', 'Outros', 16),
  ('Pernoite de familiar', null, 'diária', 'Outros', 17),
  ('Ar-condicionado split frio/quente (equipamento e instalação)', 3000, 'única', 'Equipamentos', 18),
  ('Sistema de monitoramento individual', 300, 'mensal', 'Equipamentos', 19),
  ('Remoção (quando necessário)', 850, 'por remoção', 'Deslocamentos', 20)
on conflict (nome) do update set valor = excluded.valor, unidade = excluded.unidade,
  categoria_upselling = excluded.categoria_upselling, ordem = excluded.ordem;

-- ── d · E-mail da minuta (troca só o texto provisório da 0154) ───────────────
update public.crm_modelo_mensagem set
  nome = 'E-mail com a minuta do contrato',
  quando = 'Na etapa Contrato em preparação. Baixe a minuta preenchida (Word) na oportunidade e anexe ao e-mail.',
  texto = $t$Olá, {visitante}!

Conforme combinamos, segue em anexo a minuta do contrato de {residente} com o Blue Senior Living, já com os dados que temos preenchidos (em amarelo). Os campos em branco destacados são os que vamos completar juntos.

Para prepararmos a entrada, precisamos de:
☐ RG, CPF e comprovante de endereço de {residente} e de quem assina como mantenedor responsável
☐ Data de nascimento, estado civil, telefone e e-mail de cada um
☐ Plano de saúde: operadora, tipo de plano e número da carteirinha
☐ Relatório médico, receitas e prescrições atuais, alergias, exames recentes e carteira de vacinação
☐ Dois contatos para urgências (Anexo IV)
☐ Termo de curatela, se houver (Anexo V)
☐ Autorização de uso de imagem, se quiserem (Anexo VI)
☐ Diretivas antecipadas de vontade, se houver (Anexo VII)
☐ Forma de pagamento e data prevista de entrada

Qualquer dúvida, estou à disposição.
{consultor}
Blue Senior Living$t$,
  atualizado_em = now()
 where codigo = 'MINUTA_EMAIL' and texto like '%[MINUTA PROVISÓRIA%';

-- Fim.
