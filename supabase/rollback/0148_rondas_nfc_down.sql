-- ===========================================================================
-- REVERSÃO da 0148 (rondas NFC). Rode SÓ se precisar desfazer o módulo.
-- ATENÇÃO: apaga as leituras e rondas registradas, as tags e os tablets.
-- O texto do quarto dos hóspedes (residentes.quarto) não é tocado.
-- (Fica fora de supabase/migrations de propósito: o CI aplica todas as
-- migrations em ordem e não deve aplicar a reversão.)
-- ===========================================================================
drop function if exists public.registrar_leitura_nfc(jsonb);
drop function if exists public.registrar_checklist_ronda(uuid, jsonb);
drop function if exists public.fn_aplicar_checklist_ronda(uuid, jsonb, text);
drop function if exists public.cadastrar_tag_nfc(text, text, integer, text);
drop function if exists public.definir_tag_ativa(uuid, boolean);
drop function if exists public.cadastrar_dispositivo(text);
drop function if exists public.revogar_dispositivo(uuid);
drop function if exists public.dispositivo_status(text);
drop function if exists public.revisar_leitura_ronda(uuid, text);
drop function if exists public.app_gestor_rondas();

drop table if exists public.ronda;
drop table if exists public.ronda_leitura;
drop table if exists public.ronda_config;
drop table if exists public.ronda_parametros;
drop table if exists public.devices;
drop table if exists public.nfc_tags;

drop view if exists public.v_residente_leito;
drop trigger if exists trg_residente_leito on public.residentes;
drop function if exists public.fn_residente_leito();
alter table public.residentes drop column if exists leito_id;
drop function if exists public.fn_leito_do_texto(text);
drop table if exists public.leito;
drop table if exists public.quarto;
