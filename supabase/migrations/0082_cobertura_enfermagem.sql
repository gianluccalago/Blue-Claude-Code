-- ===========================================================================
-- 0082 — Cobertura Assistencial: a ENFERMAGEM (enfermeira de plantão) também
-- designa cuidadores aos hóspedes (individual e em lote), como Coordenação e
-- Master. Só amplia a escrita de designacao_cuidado. Idempotente.
-- ===========================================================================

drop policy if exists designacao_write on public.designacao_cuidado;
create policy designacao_write on public.designacao_cuidado for all to authenticated
  using (public.app_perfil() in ('coordenacao','master','enfermagem'))
  with check (public.app_perfil() in ('coordenacao','master','enfermagem'));
