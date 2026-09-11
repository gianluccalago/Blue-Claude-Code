-- ===========================================================================
-- ATENÇÃO: ESTA MIGRATION FOI REVERTIDA PELA 0130.
-- Agosto/2026 já estava no app — as 16 linhas do extrato do sócio-diretor
-- (fc_extrato, carregado pela 0123). Esta migration criava uma segunda cópia
-- de parte desse dinheiro em fc_lancamentos. NÃO RODE. Mantida apenas como
-- registro histórico, porque chegou a ser executada em produção.
-- ===========================================================================

-- ===========================================================================
-- 0129 — FLUXO DE CAIXA: lançamentos de AGOSTO/2026.
-- ---------------------------------------------------------------------------
-- Por que faltava: o seed da 0120 carregou a planilha CustoBlue, que termina
-- em 18/07/2026. Agosto só tinha os R$ 10.000 da entrada da Terraplanagem,
-- que vieram sozinhos do módulo Obra. Nada foi apagado — os lançamentos
-- nunca existiram.
--
-- Fonte destes valores: planilha mensal do sócio-diretor, aba "ago26".
-- Mantida a convenção das 43 competências já carregadas: as três parcelas
-- de terreno viram UMA linha "Vendedores" (o detalhe fica na descrição), e
-- os dias seguem o padrão do histórico (terreno dia 10, Bacoccini dia 5,
-- corte de árvores dia 18).
--
-- SEGURANÇA — esta migration é ADITIVA:
--   · não há delete nem update de linha existente em fc_lancamentos;
--   · ids fixos + "on conflict do nothing" → rodar duas vezes não duplica;
--   · os R$ 10.000 da Terraplanagem e tudo o mais ficam intactos.
--
-- NÃO ENTRA AQUI o pagamento da TRÍADE de R$ 149.580 (a NF 13). Ele deve ser
-- registrado pelo Financeiro → "Notas fiscais da construtora" → Registrar
-- pagamento, porque assim o app: (a) lança o LÍQUIDO de R$ 140.380,83 e as
-- retenções de R$ 9.199,17 em linhas separadas, como o caixa real aconteceu;
-- (b) marca os 11 marcos cobertos como pagos; (c) guarda o comprovante.
-- Inserir aqui à mão criaria linha duplicada quando a NF fosse registrada.
--
-- Idempotente. Rode após a 0128.
-- ===========================================================================

-- Parcelas dos três terrenos — soma conferida: 78.439,12 + 54.096,00 +
-- 47.083,52 = 179.618,64.
insert into public.fc_lancamentos
  (id, data, valor, centro_custo, fornecedor, descricao, pagador, origem, registrado_por)
values
  ('fc080026-0000-4000-8000-000000000001', date '2026-08-10', 179618.64, 'terreno', 'Vendedores',
   'Parcelas de agosto: 37/44 terreno 2 (78.439,12) + 4/50 terreno 4 (54.096,00) + 33/36 terreno 3 (47.083,52)',
   'seniors', 'planilha', 'planilha dos sócios · ago/26'),
  ('fc080026-0000-4000-8000-000000000002', date '2026-08-05', 4692.50, 'projetos', 'Bacoccini',
   'Honorários de arquitetura — parcela 31/36 e 5/16',
   'seniors', 'planilha', 'planilha dos sócios · ago/26')
on conflict (id) do nothing;

-- Corte de árvores (R$ 3.500). CUIDADO: existe um lançamento de R$ 3.500 em
-- setembro/2026 que pode ser exatamente este, com a data trocada. Só insere
-- se não houver nenhum R$ 3.500 entre agosto e setembro — melhor faltar e
-- você conferir do que lançar o mesmo dinheiro duas vezes.
do $$
declare v_existe int;
begin
  select count(*) into v_existe
    from public.fc_lancamentos
   where valor = 3500 and data >= date '2026-08-01' and data <= date '2026-09-30';

  if v_existe = 0 then
    insert into public.fc_lancamentos
      (id, data, valor, centro_custo, fornecedor, descricao, pagador, origem, registrado_por)
    values
      ('fc080026-0000-4000-8000-000000000003', date '2026-08-18', 3500.00, 'terreno', 'Corte árvores',
       'Corte de árvores no terreno', 'seniors', 'planilha', 'planilha dos sócios · ago/26')
    on conflict (id) do nothing;
    raise notice 'Corte de árvores de ago/26 (R$ 3.500) inserido.';
  else
    raise notice 'PULADO: já existe % lançamento(s) de R$ 3.500 entre ago e set/26. Confira se o de setembro não é, na verdade, o corte de árvores de agosto — se for, corrija a DATA dele na tela em vez de lançar de novo.', v_existe;
  end if;
end $$;

-- ── Conferência ────────────────────────────────────────────────────────────
do $$
declare v_total numeric; v_qtd int;
begin
  select coalesce(sum(valor), 0), count(*) into v_total, v_qtd
    from public.fc_lancamentos
   where data >= date '2026-08-01' and data < date '2026-09-01';
  -- Formatação explícita: to_char com G/D depende do locale do banco.
  raise notice 'Agosto/2026 agora tem % lançamento(s), somando R$ %.', v_qtd,
    replace(replace(replace(to_char(v_total, 'FM9999999990.00'), '.', '|'), ',', '.'), '|', ',');
  raise notice 'Falta ainda a TRÍADE (NF 13) — registre o pagamento pelo Financeiro.';
end $$;

-- Fim.
