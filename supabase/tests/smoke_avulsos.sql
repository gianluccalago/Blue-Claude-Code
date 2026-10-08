-- ===========================================================================
-- SMOKE — ORÇAMENTOS AVULSOS DA OBRA (0151). Exemplo real: tapume (SINAPI
-- 98459, 48 m² × R$ 99,45) + portão duplo 6 m (CPU-01, R$ 3.573,43) = 8.347,03.
-- Fluxo completo, valores previsto/aprovado/real, caixa, anexos e permissões.
-- Usuário da construtora: construtora.teste@teste.local (rls_smoke.sql).
-- ===========================================================================
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.como(p_email text) returns void language plpgsql as $$
begin
  execute 'set role authenticated';
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, false);
end $$;
create or replace function pg_temp.verifica(p_nome text, p_ok boolean) returns text language sql as $$
  select case when p_ok then 'PASS ' else 'FAIL ' end || p_nome $$;
create or replace function pg_temp.falha(p_sql text) returns boolean language plpgsql as $$
begin execute p_sql; return false; exception when others then return true; end $$;
create or replace function pg_temp.oa(p_titulo text) returns public.obra_orcamentos_avulsos language sql as $$
  select * from public.obra_orcamentos_avulsos where titulo = p_titulo order by criado_em desc limit 1 $$;

delete from public.fc_lancamentos where origem = 'avulso' or (fornecedor = 'Triade' and descricao = 'smoke avulso');
delete from public.obra_orcamentos_avulsos where titulo like 'Smoke%';
delete from public.obra_notificacoes where tipo like 'avulso_%';

-- ── Construtora cria o orçamento ────────────────────────────────────────────
select pg_temp.como('construtora.teste@teste.local');
select public.obra_avulso_salvar(jsonb_build_object(
  'titulo', 'Smoke tapume e portão de entrada',
  'justificativa', 'Não previsto em contrato; segurança do canteiro.',
  'referencia_precos', 'SINAPI PR, desonerado',
  'itens', jsonb_build_array(
    jsonb_build_object('fonte','SINAPI','codigo','98459','descricao','Tapume fixo com telha metálica (16 m + 8 m)','unidade','m²','quantidade_prevista',48,'preco_unitario',99.45),
    jsonb_build_object('fonte','CPU','codigo','CPU-01','descricao','Portão duplo 6,00 m com pilares reforçados','unidade','un','quantidade_prevista',1,'preco_unitario',3573.43))));
select pg_temp.verifica('valor previsto = soma dos itens (R$ 8.347,03)', (select valor_previsto = 8347.03 and status = 'rascunho' from pg_temp.oa('Smoke tapume e portão de entrada')));
select pg_temp.verifica('autor gravado pelo servidor', (select registrado_por = 'Construtora Teste' from pg_temp.oa('Smoke tapume e portão de entrada')));
select pg_temp.verifica('construtora anexa foto enquanto é rascunho',
  not pg_temp.falha($q$insert into public.obra_orcamento_avulso_anexos (orcamento_id, arquivo_url, nome, tipo) select id, 'orcamentos/x/render.webp', 'render.webp', 'imagem' from pg_temp.oa('Smoke tapume e portão de entrada')$q$));
select pg_temp.verifica('construtora NÃO altera a tabela direto (valor)',
  pg_temp.falha($q$update public.obra_orcamentos_avulsos set valor_previsto = 1 where titulo like 'Smoke%'$q$)
  or (select valor_previsto = 8347.03 from pg_temp.oa('Smoke tapume e portão de entrada')));
select pg_temp.verifica('enviar sem itens é recusado',
  pg_temp.falha($q$select public.obra_avulso_enviar(public.obra_avulso_salvar('{"titulo":"Smoke vazio","itens":[]}'::jsonb))$q$));
select public.obra_avulso_enviar((select id from pg_temp.oa('Smoke tapume e portão de entrada')), 'Segue para aprovação');
select pg_temp.verifica('enviado', (select status = 'enviado' and data_envio is not null from pg_temp.oa('Smoke tapume e portão de entrada')));
select pg_temp.verifica('depois de enviado a construtora não edita',
  pg_temp.falha($q$select public.obra_avulso_salvar(jsonb_build_object('id',(select id from pg_temp.oa('Smoke tapume e portão de entrada')),'titulo','x','itens','[]'::jsonb))$q$));
select pg_temp.verifica('depois de enviado a construtora não anexa',
  pg_temp.falha($q$insert into public.obra_orcamento_avulso_anexos (orcamento_id, arquivo_url) select id, 'orcamentos/x/outra.pdf' from pg_temp.oa('Smoke tapume e portão de entrada')$q$));
select pg_temp.verifica('construtora NÃO aprova o próprio orçamento',
  pg_temp.falha($q$select public.obra_avulso_decidir((select id from pg_temp.oa('Smoke tapume e portão de entrada')), 'aprovado')$q$));
reset role;

-- ── Blue pede ajustes ───────────────────────────────────────────────────────
select pg_temp.como('master@blueseniorliving.com.br');
select pg_temp.verifica('pedir ajustes exige motivo',
  pg_temp.falha($q$select public.obra_avulso_decidir((select id from pg_temp.oa('Smoke tapume e portão de entrada')), 'ajustes', '')$q$));
select public.obra_avulso_decidir((select id from pg_temp.oa('Smoke tapume e portão de entrada')), 'ajustes', 'Incluir os 2 m de retorno do tapume');
select pg_temp.verifica('status ajustes e aviso para a construtora',
  (select status = 'ajustes' from pg_temp.oa('Smoke tapume e portão de entrada'))
  and exists (select 1 from public.obra_notificacoes where tipo = 'avulso_ajustes' and destinatario = 'obra_prestador'));
reset role;

select pg_temp.como('construtora.teste@teste.local');
select public.obra_avulso_salvar(jsonb_build_object(
  'id', (select id from pg_temp.oa('Smoke tapume e portão de entrada')), 'titulo', 'Smoke tapume e portão de entrada',
  'itens', jsonb_build_array(
    jsonb_build_object('fonte','SINAPI','codigo','98459','descricao','Tapume fixo com telha metálica','unidade','m²','quantidade_prevista',50,'preco_unitario',99.45),
    jsonb_build_object('fonte','CPU','codigo','CPU-01','descricao','Portão duplo 6,00 m','unidade','un','quantidade_prevista',1,'preco_unitario',3573.43))));
select pg_temp.verifica('reeditado: previsto recalculado (50 m² → R$ 8.545,93)', (select valor_previsto = 8545.93 from pg_temp.oa('Smoke tapume e portão de entrada')));
select public.obra_avulso_enviar((select id from pg_temp.oa('Smoke tapume e portão de entrada')), null);
reset role;

-- ── Blue aprova: o valor entra como compromisso ─────────────────────────────
select pg_temp.como('direcao@blueseniorliving.com.br');
select public.obra_avulso_decidir((select id from pg_temp.oa('Smoke tapume e portão de entrada')), 'aprovado', 'Ok');
select pg_temp.verifica('aprovado: valor aprovado congelado em R$ 8.545,93',
  (select status = 'aprovado' and valor_aprovado = 8545.93 and aprovado_por is not null from pg_temp.oa('Smoke tapume e portão de entrada')));
reset role;

-- ── Construtora informa a execução (metragem real menor) ────────────────────
select pg_temp.como('construtora.teste@teste.local');
select public.obra_avulso_informar_execucao((select id from pg_temp.oa('Smoke tapume e portão de entrada')),
  (select jsonb_build_array(jsonb_build_object('id', i.id, 'quantidade_real', 46))
     from public.obra_orcamento_avulso_itens i join pg_temp.oa('Smoke tapume e portão de entrada') o on o.id = i.orcamento_id where i.codigo = '98459'),
  'Tapume ficou com 46 m²');
select pg_temp.verifica('executado: item não informado fica com a quantidade prevista',
  (select status = 'executado' from pg_temp.oa('Smoke tapume e portão de entrada'))
  and (select quantidade_real = 1 from public.obra_orcamento_avulso_itens where codigo = 'CPU-01' and orcamento_id = (select id from pg_temp.oa('Smoke tapume e portão de entrada'))));
select pg_temp.verifica('construtora NÃO confirma o valor real',
  pg_temp.falha($q$select public.obra_avulso_conferir((select id from pg_temp.oa('Smoke tapume e portão de entrada')))$q$));
reset role;

-- ── Blue confere e paga ─────────────────────────────────────────────────────
select pg_temp.como('master@blueseniorliving.com.br');
select pg_temp.verifica('valor real diferente do medido exige explicação',
  pg_temp.falha($q$select public.obra_avulso_conferir((select id from pg_temp.oa('Smoke tapume e portão de entrada')), 8000, '')$q$));
select public.obra_avulso_conferir((select id from pg_temp.oa('Smoke tapume e portão de entrada')), null, null);
select pg_temp.verifica('conferido pelo medido: 46 × 99,45 + 3.573,43 = R$ 8.148,13',
  (select status = 'conferido' and valor_real = 8148.13 from pg_temp.oa('Smoke tapume e portão de entrada')));
select pg_temp.verifica('pagar sem data é recusado',
  pg_temp.falha($q$select public.obra_avulso_pagar((select id from pg_temp.oa('Smoke tapume e portão de entrada')), null)$q$));
select pg_temp.verifica('pago entra no caixa',
  (select (public.obra_avulso_pagar((select id from pg_temp.oa('Smoke tapume e portão de entrada')), date '2026-10-15', 'NF 21') ->> 'no_caixa')::boolean));
select pg_temp.verifica('… saída de R$ 8.148,13 para a TRÍADE em 15/10, origem avulso, centro construtora',
  (select count(*) = 1 and min(valor) = -8148.13 and min(data) = date '2026-10-15' and min(centro_custo) = 'construtora' and min(fornecedor) = 'TRÍADE'
     from public.fc_lancamentos where origem = 'avulso' and origem_id = (select id from pg_temp.oa('Smoke tapume e portão de entrada'))));
select public.obra_avulso_desfazer_pagamento((select id from pg_temp.oa('Smoke tapume e portão de entrada')), 'Data errada, vou lançar de novo');
select pg_temp.verifica('desfazer pagamento tira do caixa e volta a conferido',
  (select status = 'conferido' from pg_temp.oa('Smoke tapume e portão de entrada'))
  and not exists (select 1 from public.fc_lancamentos where origem = 'avulso' and origem_id = (select id from pg_temp.oa('Smoke tapume e portão de entrada'))));
reset role;

-- Regra da planilha: mês com linha "Triade" do sócio-diretor não duplica.
insert into public.fc_lancamentos (data, valor, grupo, centro_custo, fornecedor, descricao, origem)
values (date '2026-11-05', -150000, 'saida', 'construtora', 'Triade', 'smoke avulso', 'planilha');
select pg_temp.como('master@blueseniorliving.com.br');
select pg_temp.verifica('mês com linha "Triade" da planilha: pago, mas sem duplicar no caixa',
  (select (public.obra_avulso_pagar((select id from pg_temp.oa('Smoke tapume e portão de entrada')), date '2026-11-20') ->> 'pela_planilha')::boolean));
select pg_temp.verifica('… nenhum lançamento avulso criado', not exists (select 1 from public.fc_lancamentos where origem = 'avulso'));
select pg_temp.verifica('histórico completo com autores',
  (select count(*) >= 9 and bool_and(por is not null) from public.obra_orcamento_avulso_eventos where orcamento_id = (select id from pg_temp.oa('Smoke tapume e portão de entrada'))));
reset role;

-- ── Cancelamentos e permissões ──────────────────────────────────────────────
select pg_temp.como('construtora.teste@teste.local');
select public.obra_avulso_salvar('{"titulo":"Smoke vazio","itens":[]}'::jsonb);
select public.obra_avulso_cancelar((select id from pg_temp.oa('Smoke vazio')), 'Criado por engano');
select pg_temp.verifica('construtora cancela o próprio rascunho', (select status = 'cancelado' from pg_temp.oa('Smoke vazio')));
select pg_temp.verifica('construtora NÃO cancela orçamento já pago',
  pg_temp.falha($q$select public.obra_avulso_cancelar((select id from pg_temp.oa('Smoke tapume e portão de entrada')), 'x')$q$));
select pg_temp.verifica('construtora vê seus orçamentos, itens, anexos e histórico',
  (select count(*) from public.obra_orcamentos_avulsos) >= 2 and (select count(*) from public.obra_orcamento_avulso_itens) >= 2
  and (select count(*) from public.obra_orcamento_avulso_anexos) >= 1 and (select count(*) from public.obra_orcamento_avulso_eventos) >= 1);
select pg_temp.verifica('construtora NÃO vê o caixa', (select count(*) from public.fc_lancamentos) = 0);
reset role;
select pg_temp.como('mariana@blueseniorliving.com.br');
select pg_temp.verifica('cuidadora não vê orçamentos avulsos', (select count(*) from public.obra_orcamentos_avulsos) = 0);
select pg_temp.verifica('cuidadora não cria orçamento', pg_temp.falha($q$select public.obra_avulso_salvar('{"titulo":"x"}'::jsonb)$q$));
reset role;
select pg_temp.como('admin@blueseniorliving.com.br');
select pg_temp.verifica('administração não decide orçamento', pg_temp.falha($q$select public.obra_avulso_decidir((select id from public.obra_orcamentos_avulsos limit 1), 'aprovado')$q$));
reset role;
delete from public.fc_lancamentos where descricao = 'smoke avulso';
