-- ===========================================================================
-- 0096 — Teste funcional: corrige FALSO-POSITIVO do evento sentinela de queda.
-- ---------------------------------------------------------------------------
-- A 0085 decidia "queda com lesão" por regex em texto livre, e o único filtro
-- de negação era a frase literal 'sem ferimento'. Assim, observações como
-- "sem lesão", "sem hematoma", "nega sangramento", "descartada fratura" batiam
-- o padrão positivo e geravam INDEVIDAMENTE um evento sentinela de notificação
-- compulsória — obrigando o RT a notificar algo que não ocorreu.
--
-- Correção: além do termo de lesão, exige que ele NÃO venha precedido de uma
-- negação (sem / nega / ausência / nenhum / descartad* / não há / não apresenta).
-- Casos ambíguos/negados deixam de virar auto-evento e caem na REVISÃO MANUAL
-- (useQuedasParaAvaliar) — a rede de segurança, sem risco de subnotificar.
--
-- Só redefine a função do trigger (o trigger em si continua o mesmo).
-- Idempotente. Rode DEPOIS da 0085.
-- ===========================================================================

create or replace function public.fn_queda_evento_sentinela()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.tipo = 'Queda'
     and NEW.observacao is not null
     -- tem termo de lesão …
     and lower(NEW.observacao) ~ '(hematoma|sangramento|contus|ferimento|fratura|les[aã]o|corte)'
     -- … e esse termo NÃO está negado (negação seguida do termo em até ~20 chars)
     and lower(NEW.observacao) !~
       '(sem|nega|negou|aus[eê]ncia|nenhum[ao]?|descartad[ao]|n[aã]o h[aá]|n[aã]o apresenta)[^.;]{0,20}(ferimento|les[aã]o|hematoma|sangramento|fratura|contus|corte|sinais)'
  then
    insert into public.evento_sentinela
      (residente_id, intercorrencia_id, tipo, data_ocorrencia, descricao, registrado_por, perfil_registrador)
    values
      (NEW.residente_id, NEW.id, 'queda_com_lesao', NEW.registrado_em, NEW.observacao,
       NEW.registrado_por, 'automático (queda)');
  end if;
  return NEW;
end;
$$;

-- Fim.
