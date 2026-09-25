-- ===========================================================================
-- 0142 — ESCOPO DO LANÇAMENTO: BLUE × SENIORS CARE.
-- ---------------------------------------------------------------------------
-- A Seniors Care (empresa) administra o aluguel do imóvel antigo e paga, por
-- conta disso, impostos, contabilidade, tarifas e as obras do Seniors Club.
-- Esse dinheiro SAI do mesmo caixa, então continua no Fluxo de Caixa e no
-- Demonstrativo — mas NÃO é custo do Blue: fica fora do custo do
-- empreendimento, da correção IPCA e das análises do Blue.
--
-- Regra de classificação (conferida contra a CustoBlue atualizada, que só
-- tem terreno e projetos do Blue):
--   seniors_care · centros impostos, administrativo, seniors_club, receita
--                  de aluguel e rendimentos; e os rótulos do imóvel antigo
--                  que estavam em centros do Blue: Marlon (mensal), habite-se,
--                  CVCO, laudo Lincoln, "despesas obra pagas por" (2023).
--   blue          · todo o resto (terreno, projetos, construtora, materiais,
--                  indiretos, sócios).
-- Reversível: é uma coluna; o valor pode ser mudado lançamento a lançamento.
-- Idempotente. Rode após a 0141.
-- ===========================================================================

alter table public.fc_lancamentos
  add column if not exists escopo text not null default 'blue';
alter table public.fc_lancamentos drop constraint if exists fc_lancamentos_escopo_check;
alter table public.fc_lancamentos add constraint fc_lancamentos_escopo_check
  check (escopo in ('blue','seniors_care'));
comment on column public.fc_lancamentos.escopo is
  'blue = custo/receita do empreendimento; seniors_care = despesa/receita da empresa pelo imóvel antigo (fica no caixa, sai das análises do Blue).';
create index if not exists idx_fc_lancamentos_escopo on public.fc_lancamentos (escopo);

-- Classificação a partir do centro e do rótulo (função reutilizável para o app).
create or replace function public.fc_escopo_sugerido(p_centro text, p_rotulo text)
returns text language sql immutable as $$
  select case
    when p_centro in ('impostos','administrativo','seniors_club','receita_aluguel','receita_financeira') then 'seniors_care'
    when lower(coalesce(p_rotulo,'')) like 'marlon%'
      or lower(coalesce(p_rotulo,'')) like '%habite-se%'
      or lower(coalesce(p_rotulo,'')) like '%cvco%'
      or lower(coalesce(p_rotulo,'')) like 'laudo lincoln%'
      or lower(coalesce(p_rotulo,'')) like 'despesas obra pagas por%' then 'seniors_care'
    else 'blue'
  end
$$;

-- Marca o que já existe UMA vez (só linhas ainda no padrão 'blue' que a regra
-- reconhece como Seniors Care). Quem já foi marcado à mão não é tocado.
do $$
declare v int;
begin
  update public.fc_lancamentos
     set escopo = 'seniors_care'
   where escopo = 'blue'
     and public.fc_escopo_sugerido(centro_custo, fornecedor) = 'seniors_care';
  get diagnostics v = row_count;
  raise notice 'Lançamentos marcados como Seniors Care: %', v;
  raise notice 'Resumo: blue=% (saídas R$ %) · seniors_care=% (saídas R$ %)',
    (select count(*) from public.fc_lancamentos where escopo='blue'),
    (select round(-coalesce(sum(valor),0),2) from public.fc_lancamentos where escopo='blue' and grupo='saida'),
    (select count(*) from public.fc_lancamentos where escopo='seniors_care'),
    (select round(-coalesce(sum(valor),0),2) from public.fc_lancamentos where escopo='seniors_care' and grupo='saida');
end $$;

-- Fim.
