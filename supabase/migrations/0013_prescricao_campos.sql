-- Adiciona quantidade, posologia e grupo_prescricao à tabela prescricao.
-- Compatível com as telas de medicação existentes (cuidador e enfermagem).

alter table prescricao
  add column if not exists quantidade text,
  add column if not exists posologia text,
  add column if not exists grupo_prescricao uuid;

-- Migra prescrições existentes: cada linha recebe um grupo próprio e
-- quantidade padrão, mantendo compatibilidade com as telas de medicação.
update prescricao
set
  grupo_prescricao = gen_random_uuid(),
  quantidade = '1 comprimido'
where grupo_prescricao is null;
