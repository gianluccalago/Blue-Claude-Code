-- ===========================================================================
-- 0119 — MÓDULO OBRA · FATURAMENTO DA CONSTRUTORA (NF ↔ pagamento).
-- ---------------------------------------------------------------------------
-- Fluxo acordado: DUAS janelas de faturamento por mês (dias 1 e 11). Em cada
-- janela a TRÍADE confere o que está AFERIDO E CONFIRMADO pelo Contratante
-- (marcos de projeto e medições com status Aprovado), emite a(s) nota(s)
-- fiscal(is) contra a Seniors Care Ltda. e ANEXA aqui. Do nosso lado, pagamos
-- a NF e anexamos o COMPROVANTE — o pagamento da NF marca os itens cobertos
-- como Pagos (pelas RPCs com gate que já existem).
-- a) obra_notas_fiscais: a NF da construtora (nº, valor, PDF, itens cobertos,
--    status emitida→paga, comprovante). Prestador emite; nós pagamos.
-- b) RPC obra_desfazer_pagamento_medicao: reverte um BM pago (controle
--    interno reversível — remove também o "retido" do ledger daquele BM).
-- c) Storage: prestador passa a poder SUBIR arquivos na pasta nf/ (a NF).
-- Idempotente. Rode após a 0118.
-- ===========================================================================

-- ── a · Notas fiscais da construtora ────────────────────────────────────────
create table if not exists public.obra_notas_fiscais (
  id                 uuid primary key default gen_random_uuid(),
  numero             text not null,
  valor              numeric not null check (valor > 0),
  data_emissao       date not null default current_date,
  arquivo_url        text,                          -- PDF da NF (bucket obra, nf/)
  observacao         text,
  -- Itens que a NF cobre (snapshot): [{tipo:'marco'|'medicao', id, rotulo, valor}]
  itens              jsonb not null default '[]'::jsonb,
  status             text not null default 'emitida' check (status in ('emitida','paga')),
  comprovante_url    text,                          -- comprovante do pagamento (nf/comprovantes/)
  data_pagamento     date,
  pago_por           text,
  registrado_por     text,
  perfil_registrador text,
  criado_em          timestamptz not null default now()
);
create index if not exists idx_obra_nf_status on public.obra_notas_fiscais (status, data_emissao desc);

drop trigger if exists trg_audit_obra_notas_fiscais on public.obra_notas_fiscais;
create trigger trg_audit_obra_notas_fiscais
  after insert or update or delete on public.obra_notas_fiscais
  for each row execute function public.fn_obra_audit();

alter table public.obra_notas_fiscais enable row level security;

-- Os dois lados VEEM (é o canal de cobrança) e podem EMITIR (inserir).
drop policy if exists obra_nf_sel on public.obra_notas_fiscais;
create policy obra_nf_sel on public.obra_notas_fiscais for select to authenticated
  using (public.app_perfil() in ('master','direcao','obra_prestador'));
drop policy if exists obra_nf_ins on public.obra_notas_fiscais;
create policy obra_nf_ins on public.obra_notas_fiscais for insert to authenticated
  with check (public.app_perfil() in ('master','direcao','obra_prestador'));
-- Pagamento/edição: só master/direção.
drop policy if exists obra_nf_upd on public.obra_notas_fiscais;
create policy obra_nf_upd on public.obra_notas_fiscais for update to authenticated
  using (public.app_perfil() in ('master','direcao'))
  with check (public.app_perfil() in ('master','direcao'));
-- Excluir: master/direção sempre; o prestador só enquanto AINDA NÃO PAGA
-- (corrigir uma emissão errada antes de nós pagarmos).
drop policy if exists obra_nf_del on public.obra_notas_fiscais;
create policy obra_nf_del on public.obra_notas_fiscais for delete to authenticated
  using (
    public.app_perfil() in ('master','direcao')
    or (public.app_perfil() = 'obra_prestador' and status = 'emitida')
  );

-- ── b · Desfazer pagamento de medição (reversível, como os marcos) ──────────
create or replace function public.obra_desfazer_pagamento_medicao(p_medicao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.app_perfil() not in ('master','direcao') then
    raise exception 'Sem permissão para desfazer pagamento.';
  end if;
  update public.obra_medicoes
     set status = 'Aprovado', data_pagamento = null
   where id = p_medicao_id and status = 'Pago';
  if not found then
    raise exception 'Medição não está paga (nada a desfazer).';
  end if;
  -- Remove a retenção lançada por ESTE pagamento (o ledger volta ao estado anterior).
  delete from public.obra_retencoes_ledger
   where medicao_id = p_medicao_id and tipo = 'retido';
end;
$$;

-- ── c · Storage: prestador sobe a NF (pasta nf/) ─────────────────────────────
drop policy if exists obra_storage_insert on storage.objects;
create policy obra_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'obra' and (
      public.app_perfil() in ('master','direcao')
      or (
        public.app_perfil() = 'obra_prestador'
        and (storage.foldername(name))[1] in ('documentos','entregas','bim','andamento','diario','nf')
      )
    )
  );

-- Fim.
