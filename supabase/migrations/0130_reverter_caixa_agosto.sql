-- ===========================================================================
-- 0130 — REVERTE a 0129 (lançamentos de agosto/2026 no Fluxo de Caixa).
-- ---------------------------------------------------------------------------
-- Por que reverter: agosto JÁ ESTAVA no app. O extrato do sócio-diretor
-- (fc_extrato, carregado pela 0123) tem as 16 linhas de ago/26 — inclusive a
-- TRÍADE de 149.580. A 0129 digitou parte desse mesmo dinheiro em
-- fc_lancamentos, criando uma segunda cópia.
--
-- Remove EXATAMENTE as três linhas que a 0129 criou, pelos ids fixos dela.
-- Não toca em mais nada: a entrada da Terraplanagem (origem 'marco'), o
-- lançamento de setembro e todo o histórico ficam intactos.
--
-- Seguro rodar mesmo que a 0129 não tenha inserido as três (a de corte de
-- árvores era condicional): apagar id inexistente é no-op.
--
-- Idempotente. Rode após a 0129.
-- ===========================================================================

do $$
declare v_removidos int;
begin
  delete from public.fc_lancamentos
   where id in (
     'fc080026-0000-4000-8000-000000000001',  -- Vendedores 179.618,64
     'fc080026-0000-4000-8000-000000000002',  -- Bacoccini    4.692,50
     'fc080026-0000-4000-8000-000000000003'   -- Corte de árvores 3.500,00
   );
  get diagnostics v_removidos = row_count;
  raise notice 'Linhas da 0129 removidas: %.', v_removidos;
end $$;

-- ── Conferência: como agosto fica depois da reversão ───────────────────────
do $$
declare r record; v_total numeric := 0; v_qtd int := 0;
begin
  for r in
    select data, valor, fornecedor, origem
      from public.fc_lancamentos
     where data >= date '2026-08-01' and data < date '2026-09-01'
     order by data
  loop
    v_qtd := v_qtd + 1;
    v_total := v_total + r.valor;
    raise notice '  % | % | % | origem=%', r.data, r.valor, r.fornecedor, r.origem;
  end loop;
  raise notice 'Agosto/2026 ficou com % lançamento(s), somando %.', v_qtd, v_total;
  raise notice 'O agosto completo do sócio-diretor segue em fc_extrato (Demonstrativo).';
end $$;

-- Fim.
