-- 0045 — Permite que a FARMÁCIA leia e escreva na tabela upselling.
-- CustosMedicamento.tsx lança o custo da "caixinha" diretamente em upselling
-- (categoria "Medicamentos"); a policy de 0043 só permitia administracao/
-- direcao/master — a farmácia ficava bloqueada (RLS violation ao inserir).
-- Idempotente.

do $$
begin
  if to_regclass('public.upselling') is not null then
    drop policy if exists upselling_select on public.upselling;
    drop policy if exists upselling_write  on public.upselling;

    -- SELECT: admin/direção/master total; família só o seu; farmácia só lê.
    create policy upselling_select on public.upselling for select to authenticated using (
      public.app_perfil() in ('administracao','direcao','master','farmacia')
      or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia())
    );

    -- WRITE (insert/update/delete): admin/direção/master + farmácia.
    -- A farmácia só insere em categoria='Medicamentos' (lancado_por='Farmácia'),
    -- mas a trava fina de categoria não é necessária aqui — a interface já
    -- controla o que a farmácia pode lançar.
    create policy upselling_write on public.upselling for all to authenticated
      using  (public.app_perfil() in ('administracao','direcao','master','farmacia'))
      with check (public.app_perfil() in ('administracao','direcao','master','farmacia'));
  end if;
end $$;
