-- ===========================================================================
-- 0128 — IPCA pode ser NEGATIVO (deflação).
-- ---------------------------------------------------------------------------
-- Agosto/2026 fechou com IPCA de -0,32%. O app bloqueava índice negativo em
-- dois pontos do reajuste de fase e não dava afordância de sinal no Fluxo de
-- Caixa — o índice de agosto acabou gravado como +0,32%, invertendo o efeito
-- sobre o acumulado corrigido.
--
-- a) Trava de sanidade em fc_ipca.pct: aceita negativo, barra magnitude
--    absurda (o erro clássico é digitar 32 no lugar de 0,32 — o valor é
--    guardado como FRAÇÃO, então 0,32% vira 0.0032).
-- b) Corrige agosto/2026 SE ele estiver gravado como positivo 0.0032.
--    Só toca nesse caso exato; qualquer outro valor fica como está.
--
-- Idempotente. Rode após a 0127.
-- ===========================================================================

-- a) Sanidade: fração entre -1 e 1 (isto é, de -100% a +100%).
alter table public.fc_ipca drop constraint if exists fc_ipca_pct_plausivel;
alter table public.fc_ipca add constraint fc_ipca_pct_plausivel
  check (pct > -1 and pct < 1);

comment on column public.fc_ipca.pct is
  'Índice do mês como FRAÇÃO. Pode ser NEGATIVO em mês de deflação (ex.: -0.0032 = -0,32%).';

-- b) Agosto/2026: -0,32% (deflação). Corrige só se estiver com o sinal trocado.
do $$
declare v_atual numeric;
begin
  select pct into v_atual from public.fc_ipca where mes = '2026-08';
  if v_atual is null then
    insert into public.fc_ipca (mes, pct) values ('2026-08', -0.0032);
    raise notice 'IPCA de ago/2026 cadastrado: -0,32%%.';
  elsif v_atual = 0.0032 then
    update public.fc_ipca set pct = -0.0032 where mes = '2026-08';
    raise notice 'IPCA de ago/2026 corrigido: +0,32%% -> -0,32%% (deflação).';
  else
    raise notice 'IPCA de ago/2026 já está em %; nada alterado.', v_atual;
  end if;
end $$;

-- Fim.
