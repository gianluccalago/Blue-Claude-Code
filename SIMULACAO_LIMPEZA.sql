-- ============================================================================
-- BLUE SENIOR LIVING — LIMPEZA DA SIMULAÇÃO
-- Remove APENAS os dados criados pela simulação (prefixo SIM- / ids 5eed00…).
-- Não toca em nada do app real. Pode rodar quantas vezes quiser.
-- Inclui os registros GERADOS DURANTE a simulação que referenciam os
-- hóspedes/usuários SIM- (checklist, administrações, escalações, etc.).
-- ============================================================================

-- Tabelas de tratamento/resolução (referenciam por referencia_id) — primeiro
delete from resolucao_medica where referencia_id in (
  select id from intercorrencia where residente_id::text like '5eed0010%'
  union select id from eliminacao_tratamento where residente_id::text like '5eed0010%');
delete from pendencia_tratamento where referencia_id in (
  select id from administracao where residente_id::text like '5eed0010%'
  union select id from intercorrencia where residente_id::text like '5eed0010%');
delete from eliminacao_tratamento where residente_id::text like '5eed0010%';

-- Filhos por residente_id
delete from administracao        where residente_id::text like '5eed0010%';
delete from intercorrencia       where residente_id::text like '5eed0010%';
delete from eliminacao           where residente_id::text like '5eed0010%';
delete from tarefa_registro      where residente_id::text like '5eed0010%';
delete from dispensacao          where residente_id::text like '5eed0010%';
delete from estoque_hospede      where residente_id::text like '5eed0010%';
delete from compromisso_externo  where residente_id::text like '5eed0010%';
delete from prescricao           where residente_id::text like '5eed0010%';
delete from plano_cuidado_item   where residente_id::text like '5eed0010%';
delete from dieta                where residente_id::text like '5eed0010%';
delete from solicitacao_familia  where residente_id::text like '5eed0010%';
delete from upselling            where residente_id::text like '5eed0010%';
delete from pagamento_mensalidade where residente_id::text like '5eed0010%';
delete from avaliacao_ivcf       where residente_id::text like '5eed0010%';
delete from evolucao             where residente_id::text like '5eed0010%';
-- chamado ANTES da inspeção (FK chamado.inspecao_item_id é RESTRICT)
delete from chamado_manutencao   where local like 'SIM-%' or residente_id::text like '5eed0010%';
delete from inspecao_suite       where residente_id::text like '5eed0010%';  -- cascata em inspecao_item
delete from estoque_resgate      where medicamento like 'SIM-%';

-- Por profissional / turnos
delete from pagamento_pessoal    where profissional_id::text like '5eed0020%';
delete from turnos               where profissional_id::text like '5eed0020%' or observacao_interna like 'SIM-%';
delete from cuidador_residente   where cuidador_id::text like '5eed0020%' or residente_id::text like '5eed0010%';

-- Pais
delete from usuarios   where id::text like '5eed0020%';
delete from residentes where id::text like '5eed0010%';

-- Logins (auth)
delete from auth.identities i using auth.users au
  where au.id = i.user_id and au.email like 'sim.%@blue.local';
delete from auth.users where email like 'sim.%@blue.local';

-- Conferência: deve voltar tudo zero
select 'residentes SIM' as item, count(*) from residentes where id::text like '5eed0010%'
union all select 'usuarios SIM',  count(*) from usuarios where id::text like '5eed0020%'
union all select 'logins SIM',    count(*) from auth.users where email like 'sim.%@blue.local';
-- Fim da limpeza.
