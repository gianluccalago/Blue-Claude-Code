-- Padroniza a grafia dos medicamentos em MAIÚSCULAS, evitando duplicatas por
-- capitalização (ex: "Losartana" vs "losartana" -> "LOSARTANA").

update prescricao set medicamento = upper(medicamento);

update estoque_hospede set medicamento = upper(medicamento);

update dispensacao
set itens = (
  select jsonb_agg(
    jsonb_set(elem, '{medicamento}', to_jsonb(upper(elem->>'medicamento')))
  )
  from jsonb_array_elements(itens) as elem
)
where itens is not null and jsonb_array_length(itens) > 0;
