-- ============================================================================
-- Blue Senior Living — Migration 0028
-- Portal da Família / Hóspede (BLOCO Família).
--
-- Nova tabela "solicitacao_familia": canal de comunicação da família com a
-- Coordenação Assistencial, o Médico ou a Administração (com resposta e
-- reencaminhamento entre setores).
--
-- Também populamos dados de teste: fotos de atividades e solicitações da
-- "Família Bittencourt" (vinculada à Profª Alzira — ver FAMILIA_ATUAL em
-- src/data/profiles.ts).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

create table if not exists solicitacao_familia (
  id               uuid primary key default gen_random_uuid(),
  residente_id     uuid not null references residentes(id),
  destino          text not null check (destino in ('coordenacao','medico','administracao')),
  assunto          text not null,
  mensagem         text not null,
  status           text not null default 'aberta' check (status in ('aberta','respondida')),
  resposta         text,
  enviada_por      text not null default 'Família',
  respondida_por   text,
  -- Setor de origem, quando a solicitação foi reencaminhada para outro destino.
  redirecionada_de text,
  criada_em        timestamptz not null default now(),
  respondida_em    timestamptz
);

alter table solicitacao_familia disable row level security;

create index if not exists solicitacao_familia_residente_idx on solicitacao_familia (residente_id);
create index if not exists solicitacao_familia_destino_idx on solicitacao_familia (destino, status);

-- ----------------------------------------------------------------------------
-- Fotos de atividades para a tela "Fotos" do portal (Profª Alzira)
-- ----------------------------------------------------------------------------

insert into atividade_execucao (atividade_id, data, descricao_geral, foto_url, realizada_por)
select id, current_date - 1, 'Alongamento e mobilidade em grupo no salão.',
  'https://picsum.photos/seed/blue-fisioterapia-grupo/640/480', 'Equipe Multi'
from atividade where titulo = 'Fisioterapia em grupo'
on conflict (atividade_id, data) do nothing;

insert into atividade_execucao (atividade_id, data, descricao_geral, foto_url, realizada_por)
select id, current_date - 3, 'Roda de música com instrumentos de percussão.',
  'https://picsum.photos/seed/blue-oficina-musica/640/480', 'Equipe Multi'
from atividade where titulo = 'Oficina de música'
on conflict (atividade_id, data) do nothing;

insert into atividade_participacao (atividade_id, data, residente_id, presente, registrado_por)
select id, current_date - 1, 'a0000000-0000-0000-0000-000000000001', true, 'Equipe Multi'
from atividade where titulo = 'Fisioterapia em grupo'
on conflict (atividade_id, data, residente_id) do nothing;

insert into atividade_participacao (atividade_id, data, residente_id, presente, registrado_por)
select id, current_date - 3, 'a0000000-0000-0000-0000-000000000001', true, 'Equipe Multi'
from atividade where titulo = 'Oficina de música'
on conflict (atividade_id, data, residente_id) do nothing;

-- ----------------------------------------------------------------------------
-- Solicitações de teste (Família Bittencourt -> Profª Alzira)
-- ----------------------------------------------------------------------------

insert into solicitacao_familia (residente_id, destino, assunto, mensagem, status, resposta, respondida_por, respondida_em)
select 'a0000000-0000-0000-0000-000000000001', 'coordenacao', 'Troca de fralda à noite',
  'Notamos que a Profª Alzira acordou com a fralda muito cheia algumas vezes essa semana. É possível reforçar a troca durante a madrugada?',
  'respondida',
  'Obrigada pelo retorno! Já orientamos a equipe noturna a reforçar a troca por volta das 2h e 5h. Qualquer recorrência, nos avisem.',
  'Coordenação Assistencial', now() - interval '1 day'
where not exists (
  select 1 from solicitacao_familia
  where residente_id = 'a0000000-0000-0000-0000-000000000001' and assunto = 'Troca de fralda à noite'
);

insert into solicitacao_familia (residente_id, destino, assunto, mensagem)
select 'a0000000-0000-0000-0000-000000000001', 'medico', 'Dúvida sobre nova medicação',
  'Vimos no plano que foi incluído Enalapril. Pode nos explicar o motivo da mudança e se há efeitos colaterais que devemos observar?'
where not exists (
  select 1 from solicitacao_familia
  where residente_id = 'a0000000-0000-0000-0000-000000000001' and assunto = 'Dúvida sobre nova medicação'
);

insert into solicitacao_familia (residente_id, destino, assunto, mensagem)
select 'a0000000-0000-0000-0000-000000000001', 'administracao', 'Solicitação de 2ª via do boleto',
  'Poderiam enviar a 2ª via do boleto deste mês para o e-mail da família?'
where not exists (
  select 1 from solicitacao_familia
  where residente_id = 'a0000000-0000-0000-0000-000000000001' and assunto = 'Solicitação de 2ª via do boleto'
);

-- Fim.
