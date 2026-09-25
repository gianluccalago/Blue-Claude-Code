-- ===========================================================================
-- 0138 — COBRANÇA: histórico fechado, estorno e pró-rata configurável.
-- ---------------------------------------------------------------------------
-- a) FECHAMENTO MENSAL (FIN-01 / decisão 8): `fechamento_mensal` guarda, por
--    mês, um SNAPSHOT (jsonb) do faturamento por hóspede — mensalidade,
--    extras (upselling), 13º, cobrança temporária, total e status — calculado
--    NO SERVIDOR pela RPC `fechar_mes(p_mes)`. As telas mostram o snapshot
--    para meses fechados e o cálculo vivo para os abertos; editar
--    `mensalidade_valor` ou a tabela de preços NÃO altera um mês fechado.
--    RLS: leitura só pela gestão; escrita SÓ pelas RPCs (nenhuma policy de
--    insert/update/delete). `reabrir_mes` (Master, com motivo) marca o mês
--    como reaberto sem apagar o registro; um novo `fechar_mes` regrava.
-- b) ESTORNO (FIN-02/parciais): novo status 'estornada' em
--    pagamento_mensalidade, com `estorno_motivo` OBRIGATÓRIO e `estornado_em`.
--    O pagamento (valor_pago / data_pagamento / forma) NÃO é apagado.
-- c) PRÓ-RATA (decisão 8): chave `prorata_mensalidade` em `configuracao`
--    ('on'/'off'). Padrão OFF = mês cheio na entrada e na saída (comportamento
--    atual) até o responsável confirmar. `fechar_mes` respeita a chave.
-- d) Funções puras em SQL (`cobranca_prorata`, `cobranca_parcela_decimo`)
--    espelham `src/lib/cobranca.ts` e `src/lib/decimoTerceiro.ts`; o smoke
--    (`supabase/tests/smoke_cobranca.sql`) cruza os dois.
-- Idempotente. Rode após a 0134.
-- ===========================================================================

-- ── c · Pró-rata configurável (padrão OFF) ──────────────────────────────────
insert into public.configuracao (chave, valor) values ('prorata_mensalidade', 'off')
  on conflict (chave) do nothing;

-- ── b · Estorno em pagamento_mensalidade ────────────────────────────────────
alter table public.pagamento_mensalidade
  add column if not exists estorno_motivo text,
  add column if not exists estornado_em   timestamptz;

alter table public.pagamento_mensalidade drop constraint if exists pagamento_mensalidade_status_check;
alter table public.pagamento_mensalidade add constraint pagamento_mensalidade_status_check
  check (status in ('em_aberto','enviada','paga','vencida','cancelada','estornada'));

-- Estorno sem motivo não existe.
alter table public.pagamento_mensalidade drop constraint if exists pagamento_mensalidade_estorno_motivo_check;
alter table public.pagamento_mensalidade add constraint pagamento_mensalidade_estorno_motivo_check
  check (status <> 'estornada' or nullif(btrim(estorno_motivo), '') is not null);

comment on column public.pagamento_mensalidade.estorno_motivo is
  'Motivo do estorno (obrigatório quando status = estornada). O pagamento original fica preservado.';

-- ── d · Funções puras (espelho do TypeScript) ───────────────────────────────
-- Pró-rata: proporcional aos dias em que o hóspede esteve na casa dentro do
-- mês. Entrada/saída fora do mês = mês cheio. Sem data de admissão = cheio.
create or replace function public.cobranca_prorata(
  p_valor numeric, p_data_admissao date, p_data_saida date, p_mes text
) returns numeric language sql immutable as $$
  with m as (
    select (p_mes || '-01')::date as ini,
           ((p_mes || '-01')::date + interval '1 month' - interval '1 day')::date as fim
  ), janela as (
    select greatest(coalesce(p_data_admissao, ini), ini) as de,
           least(coalesce(p_data_saida, fim), fim) as ate,
           (fim - ini + 1) as dias_mes
    from m
  )
  select case
    when p_valor is null or p_valor = 0 then 0
    when ate < de then 0
    else round(p_valor * (ate - de + 1) / dias_mes, 2)
  end from janela
$$;

-- 13º: metade em novembro, metade em dezembro; proporcional aos meses no ano
-- civil a partir da admissão (mesma regra de src/lib/decimoTerceiro.ts).
create or replace function public.cobranca_parcela_decimo(
  p_mensalidade_base numeric, p_data_admissao date, p_mes text
) returns numeric language sql immutable as $$
  select case
    when substr(p_mes, 6, 2) not in ('11','12') then 0
    else round(coalesce(p_mensalidade_base, 0) * (
      case
        when p_data_admissao is null then 12
        when extract(year from p_data_admissao) > substr(p_mes, 1, 4)::int then 0
        when extract(year from p_data_admissao) < substr(p_mes, 1, 4)::int then 12
        else greatest(0, least(12, 13 - extract(month from p_data_admissao)::int))
      end / 12.0) / 2, 2)
  end
$$;

-- ── a · Fechamento mensal ───────────────────────────────────────────────────
create table if not exists public.fechamento_mensal (
  mes             text primary key check (mes ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  fechado_em      timestamptz not null default now(),
  fechado_por     text not null,
  snapshot        jsonb not null,
  -- Reabertura (Master, com motivo): o registro fica; um novo fechar_mes regrava.
  reaberto_em     timestamptz,
  reaberto_por    text,
  reaberto_motivo text
);
comment on table public.fechamento_mensal is
  'Snapshot do faturamento do mês por hóspede (fechar_mes). Escrita só pelas RPCs.';

alter table public.fechamento_mensal enable row level security;
drop policy if exists fechamento_mensal_select on public.fechamento_mensal;
create policy fechamento_mensal_select on public.fechamento_mensal for select to authenticated
  using (public.app_gestao());
-- Sem policy de insert/update/delete: só as RPCs (security definer) escrevem.

create or replace function public.fechar_mes(p_mes text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_nome     text;
  v_ini      date;
  v_fim      date;
  v_hoje     date := (now() at time zone 'America/Sao_Paulo')::date;
  v_prorata  boolean;
  v_linhas   jsonb;
  v_totais   jsonb;
  v_snapshot jsonb;
  v_atual    public.fechamento_mensal%rowtype;
begin
  if not public.app_gestao() then
    raise exception 'Só a gestão (Master, Direção, Administração) fecha o mês.';
  end if;
  if p_mes is null or p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Mês inválido: use AAAA-MM.';
  end if;
  v_ini := (p_mes || '-01')::date;
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  if v_ini > v_hoje then
    raise exception 'Não é possível fechar um mês futuro.';
  end if;

  -- Uma chamada por vez para o mesmo mês (duas abas).
  perform pg_advisory_xact_lock(hashtext('fechar_mes:' || p_mes));
  select * into v_atual from public.fechamento_mensal where mes = p_mes;
  if found and v_atual.reaberto_em is null then
    raise exception 'O mês % já está fechado (em %, por %).', p_mes, to_char(v_atual.fechado_em, 'DD/MM/YYYY'), v_atual.fechado_por;
  end if;

  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  v_nome := coalesce(v_nome, 'Gestão');
  v_prorata := coalesce((select valor from public.configuracao where chave = 'prorata_mensalidade'), 'off') = 'on';

  -- Roster do mês: mesma regra de estaNoMes (src/lib/cobranca.ts) —
  -- admitido até o fim do mês; se inativo, saída dentro ou depois do mês.
  -- Day care não ocupa leito (cobra por cobranca_temporaria à parte).
  with roster as (
    select r.*
    from public.residentes r
    where r.modalidade <> 'day_care'
      and coalesce(r.data_admissao, '0001-01-01'::date) <= v_fim
      and (r.status_hospede <> 'inativo' or coalesce(r.data_saida, '9999-12-31'::date) >= v_ini)
  ), base as (
    select r.*,
      -- Só longa permanência tem mensalidade; fallback = preço VIGENTE na
      -- data de ENTRADA (mesma regra de precoVigenteEm).
      case when r.modalidade = 'longa_permanencia' then coalesce(
        r.mensalidade_valor,
        (select tp.valor from public.tabela_preco tp
          where tp.tipo_suite = r.tipo_suite and tp.grau = r.grau_dependencia
            and tp.ocupacao = coalesce(r.ocupacao, 'simples')
            and tp.vigente_a_partir_de <= coalesce(r.data_admissao, v_hoje)
          order by tp.vigente_a_partir_de desc limit 1),
        0) else 0 end as mensalidade_base
    from roster r
  ), calc as (
    select b.*,
      case when v_prorata
        then public.cobranca_prorata(b.mensalidade_base, b.data_admissao,
               case when b.status_hospede = 'inativo' then b.data_saida end, p_mes)
        else b.mensalidade_base end as mensalidade,
      coalesce((select sum(u.valor) from public.upselling u
                 where u.residente_id = b.id and u.mes_referencia = p_mes), 0) as upselling,
      -- 13º sobre a mensalidade BASE (pró-rata não reduz o 13º).
      public.cobranca_parcela_decimo(b.mensalidade_base, b.data_admissao, p_mes) as decimo_terceiro,
      coalesce((select sum(c.valor) from public.cobranca_temporaria c
                 where c.residente_id = b.id and c.periodo_referencia = p_mes), 0) as cobranca_temporaria,
      p.status as status_registro,
      coalesce(p.data_vencimento, (p_mes || '-10')::date) as vencimento,
      p.valor_pago
    from base b
    left join public.pagamento_mensalidade p on p.residente_id = b.id and p.mes_referencia = p_mes
  ), fim as (
    select c.*,
      (c.mensalidade + c.upselling + c.decimo_terceiro + c.cobranca_temporaria) as total,
      -- Status EFETIVO (mesma regra de statusEfetivoCobranca): paga/cancelada/
      -- estornada valem como gravadas; vencida se o vencimento efetivo passou.
      case
        when c.status_registro in ('paga', 'cancelada', 'estornada') then c.status_registro
        when c.vencimento < v_hoje then 'vencida'
        else coalesce(c.status_registro, 'em_aberto')
      end as status
    from calc c
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'residente_id', f.id,
      'nome', f.nome,
      'quarto', f.quarto,
      'tipo_suite', f.tipo_suite,
      'grau_dependencia', f.grau_dependencia,
      'modalidade', f.modalidade,
      'data_admissao', f.data_admissao,
      'data_saida', case when f.status_hospede = 'inativo' then f.data_saida end,
      'resp_fin_nome', f.resp_fin_nome,
      'resp_fin_cpf', f.resp_fin_cpf,
      'resp_fin_email', f.resp_fin_email,
      'resp_fin_telefone', f.resp_fin_telefone,
      'resp_fin_relacao', f.resp_fin_relacao,
      'mensalidade_base', f.mensalidade_base,
      'mensalidade', f.mensalidade,
      'upselling', f.upselling,
      'decimo_terceiro', f.decimo_terceiro,
      'cobranca_temporaria', f.cobranca_temporaria,
      'total', f.total,
      'status', f.status,
      'vencimento', f.vencimento,
      'valor_pago', f.valor_pago
    ) order by f.nome), '[]'::jsonb),
    jsonb_build_object(
      -- Cancelada fica FORA do faturamento.
      'faturado', coalesce(sum(f.total) filter (where f.status <> 'cancelada'), 0),
      'mensalidades', coalesce(sum(f.mensalidade) filter (where f.status <> 'cancelada'), 0),
      'upselling', coalesce(sum(f.upselling) filter (where f.status <> 'cancelada'), 0),
      'decimo_terceiro', coalesce(sum(f.decimo_terceiro) filter (where f.status <> 'cancelada'), 0),
      'cobranca_temporaria', coalesce(sum(f.cobranca_temporaria) filter (where f.status <> 'cancelada'), 0),
      'hospedes', count(*)
    )
  into v_linhas, v_totais
  from fim f;

  v_snapshot := jsonb_build_object(
    'mes', p_mes,
    'prorata', v_prorata,
    'fechado_em', now(),
    'fechado_por', v_nome,
    'linhas', v_linhas,
    'totais', v_totais
  );

  insert into public.fechamento_mensal (mes, fechado_em, fechado_por, snapshot)
  values (p_mes, now(), v_nome, v_snapshot)
  on conflict (mes) do update
    set fechado_em = now(), fechado_por = v_nome, snapshot = v_snapshot,
        reaberto_em = null, reaberto_por = null, reaberto_motivo = null;

  return v_snapshot;
end $$;
comment on function public.fechar_mes(text) is
  'Gestão: congela o faturamento do mês por hóspede (snapshot). Recusa mês futuro e mês já fechado.';

-- Reabertura: só Master, com motivo. Não apaga o snapshot — marca reaberto;
-- as telas voltam ao cálculo vivo até um novo fechar_mes.
create or replace function public.reabrir_mes(p_mes text, p_motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_nome text;
begin
  if coalesce(public.app_perfil(), '') <> 'master' then
    raise exception 'Só o Master reabre um mês fechado.';
  end if;
  if nullif(btrim(p_motivo), '') is null then
    raise exception 'Informe o motivo da reabertura.';
  end if;
  select nome into v_nome from public.usuarios where id = public.app_usuario_id();
  update public.fechamento_mensal
     set reaberto_em = now(), reaberto_por = coalesce(v_nome, 'Master'), reaberto_motivo = btrim(p_motivo)
   where mes = p_mes and reaberto_em is null;
  if not found then
    raise exception 'O mês % não está fechado.', p_mes;
  end if;
end $$;

revoke execute on function public.cobranca_prorata(numeric, date, date, text) from public, anon;
revoke execute on function public.cobranca_parcela_decimo(numeric, date, text) from public, anon;
revoke execute on function public.fechar_mes(text) from public, anon;
revoke execute on function public.reabrir_mes(text, text) from public, anon;
grant execute on function public.cobranca_prorata(numeric, date, date, text) to authenticated;
grant execute on function public.cobranca_parcela_decimo(numeric, date, text) to authenticated;
grant execute on function public.fechar_mes(text) to authenticated;
grant execute on function public.reabrir_mes(text, text) to authenticated;
