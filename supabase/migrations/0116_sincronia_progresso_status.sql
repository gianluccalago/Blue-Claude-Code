-- ===========================================================================
-- 0116 — MÓDULO OBRA · Reconcilia status × progresso das atividades.
-- ---------------------------------------------------------------------------
-- Bug corrigido no front: era possível uma atividade aparecer "Concluída"
-- com a barra em 50% (status contratual e progresso viviam independentes).
-- Regra agora (aplicada também na escrita, pelo app):
--   · a BARRA DE PROGRESSO é a fonte da verdade de "concluída" (>= 100);
--   · status "Pago" (tudo pago) implica progresso 100;
--   · status "Concluído" com progresso < 100 é contradição → reabre
--     (volta a "Aprovado" e limpa a data de conclusão) — ao registrar 100%
--     de novo, o app re-conclui sozinho.
-- Idempotente. Rode após a 0115.
-- ===========================================================================

-- Pago = dinheiro todo saiu → a atividade está concluída de fato.
update public.obra_disciplinas
   set progresso_pct = 100,
       data_conclusao = coalesce(data_conclusao, current_date)
 where status = 'Pago' and progresso_pct < 100;

-- "Concluído" sem 100% é contradição → reabre com honestidade.
update public.obra_disciplinas
   set status = 'Aprovado',
       data_conclusao = null
 where status = 'Concluído' and progresso_pct < 100;

-- Fim.
