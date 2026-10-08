-- ===========================================================================
-- 0151 — ORÇAMENTOS AVULSOS DA OBRA (serviços não previstos no contrato).
-- ---------------------------------------------------------------------------
-- A construtora (perfil obra_prestador) lança no portal um orçamento de algo
-- que não estava previsto — ex.: tapume e portão de entrada — com itens no
-- padrão de planilha orçamentária (fonte SINAPI/CPU/cotação, código,
-- descrição, unidade, quantidade, preço unitário), fotos e PDFs. A Blue
-- (Master/Direção) aprova, pede ajustes ou reprova.
--
-- Fluxo:  rascunho → enviado → (ajustes ⇄ enviado) → aprovado | reprovado
--         aprovado → executado (construtora informa as quantidades reais)
--         → conferido (Blue confirma o VALOR REAL) → pago (entra no caixa).
--         Cancelado: a construtora, antes da aprovação; a Blue, antes do pagamento.
--
-- Valores: valor_previsto (Σ quantidade prevista × P.U., recalculado a cada
-- edição) · valor_aprovado (congelado na aprovação: é o que "entra na conta"
-- como compromisso) · valor_real (confirmado pela Blue na conferência — o
-- orçamento é por metragem e pode variar) · pagamento → fc_lancamentos
-- (origem 'avulso', saída, fornecedor TRÍADE). Se no mês já houver linha
-- "Triade" lançada pela planilha do sócio-diretor, o caixa NÃO duplica (mesma
-- regra da sincronização do módulo Obra) e o evento registra isso.
--
-- Tudo passa por funções (máquina de estados no servidor); histórico em
-- obra_orcamento_avulso_eventos. Autor gravado pelo servidor. Construtora vê
-- só os próprios orçamentos avulsos (que ela mesma propõe) — nenhum custo
-- interno da Blue é exposto. Rode após a 0150.
-- ===========================================================================

-- ── Tabelas ─────────────────────────────────────────────────────────────────
create table if not exists public.obra_orcamentos_avulsos (
  id                uuid primary key default gen_random_uuid(),
  numero            serial unique,
  titulo            text not null check (length(trim(titulo)) > 0),
  descricao         text,
  justificativa     text,
  fase_id           uuid references public.obra_fases(id) on delete set null,
  referencia_precos text,
  status            text not null default 'rascunho' check (status in
                      ('rascunho','enviado','ajustes','aprovado','reprovado','executado','conferido','pago','cancelado')),
  valor_previsto    numeric(14,2) not null default 0,
  valor_aprovado    numeric(14,2),
  valor_real        numeric(14,2),
  centro_custo      text not null default 'construtora',
  data_envio        timestamptz,
  data_aprovacao    timestamptz,
  aprovado_por      text,
  data_execucao     timestamptz,
  data_conferencia  timestamptz,
  conferido_por     text,
  data_pagamento    date,
  pago_por          text,
  nf_numero         text,
  nf_url            text,
  comprovante_url   text,
  registrado_por    text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
comment on table public.obra_orcamentos_avulsos is
  'Orçamento avulso (serviço não previsto) proposto pela construtora e aprovado pela Blue. Valores: previsto → aprovado → real → pago (caixa).';

create table if not exists public.obra_orcamento_avulso_itens (
  id                  uuid primary key default gen_random_uuid(),
  orcamento_id        uuid not null references public.obra_orcamentos_avulsos(id) on delete cascade,
  ordem               integer not null default 0,
  fonte               text not null default 'SINAPI' check (fonte in ('SINAPI','CPU','Cotação','Outra')),
  codigo              text,
  descricao           text not null check (length(trim(descricao)) > 0),
  unidade             text not null check (length(trim(unidade)) > 0),
  quantidade_prevista numeric(14,3) not null check (quantidade_prevista > 0),
  preco_unitario      numeric(14,2) not null check (preco_unitario >= 0),
  quantidade_real     numeric(14,3) check (quantidade_real is null or quantidade_real >= 0)
);
create index if not exists idx_obra_avulso_itens on public.obra_orcamento_avulso_itens (orcamento_id, ordem);

create table if not exists public.obra_orcamento_avulso_anexos (
  id             uuid primary key default gen_random_uuid(),
  orcamento_id   uuid not null references public.obra_orcamentos_avulsos(id) on delete cascade,
  arquivo_url    text not null,
  nome           text,
  tipo           text not null default 'documento' check (tipo in ('imagem','documento')),
  registrado_por text,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_obra_avulso_anexos on public.obra_orcamento_avulso_anexos (orcamento_id);

create table if not exists public.obra_orcamento_avulso_eventos (
  id           uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.obra_orcamentos_avulsos(id) on delete cascade,
  acao         text not null,
  de_status    text,
  para_status  text,
  comentario   text,
  valor        numeric(14,2),
  por          text,
  perfil       text,
  em           timestamptz not null default now()
);
create index if not exists idx_obra_avulso_eventos on public.obra_orcamento_avulso_eventos (orcamento_id, em);

-- ── Permissões: leitura para Blue (master/direção) e construtora ────────────
do $$ declare t text;
begin
  foreach t in array array['obra_orcamentos_avulsos','obra_orcamento_avulso_itens','obra_orcamento_avulso_anexos','obra_orcamento_avulso_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using (coalesce(public.app_perfil() in (''master'',''direcao'',''obra_prestador''), false))', t || '_sel', t);
  end loop;
end $$;

-- Anexos: a construtora anexa/remove enquanto o orçamento é editável; a Blue, sempre.
create or replace function public.fn_obra_avulso_editavel(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.app_perfil() in ('master','direcao'), false)
      or (public.app_perfil() = 'obra_prestador'
          and exists (select 1 from public.obra_orcamentos_avulsos o where o.id = p_id and o.status in ('rascunho','ajustes')))
$$;
revoke all on function public.fn_obra_avulso_editavel(uuid) from public, anon;
grant execute on function public.fn_obra_avulso_editavel(uuid) to authenticated;

drop policy if exists obra_avulso_anexos_ins on public.obra_orcamento_avulso_anexos;
drop policy if exists obra_avulso_anexos_del on public.obra_orcamento_avulso_anexos;
create policy obra_avulso_anexos_ins on public.obra_orcamento_avulso_anexos for insert to authenticated
  with check (public.fn_obra_avulso_editavel(orcamento_id));
create policy obra_avulso_anexos_del on public.obra_orcamento_avulso_anexos for delete to authenticated
  using (public.fn_obra_avulso_editavel(orcamento_id));
-- Demais escritas: só pelas funções abaixo.

-- Autor do anexo pelo servidor (mesma trigger das tabelas da obra).
drop trigger if exists trg_autoria_servidor on public.obra_orcamento_avulso_anexos;
create trigger trg_autoria_servidor before insert or update on public.obra_orcamento_avulso_anexos
  for each row execute function public.fn_autoria_servidor();

-- Auditoria (mesma função das demais tabelas da obra).
drop trigger if exists trg_audit_obra_orcamentos_avulsos on public.obra_orcamentos_avulsos;
create trigger trg_audit_obra_orcamentos_avulsos after insert or update or delete on public.obra_orcamentos_avulsos
  for each row execute function public.fn_obra_audit();

-- Storage: a construtora lê e envia na pasta orcamentos/ do bucket da obra.
drop policy if exists obra_storage_select on storage.objects;
create policy obra_storage_select on storage.objects for select to authenticated
  using (
    bucket_id = 'obra' and (
      coalesce(public.app_perfil() in ('master','direcao'), false)
      or (public.app_perfil() = 'obra_prestador'
          and (storage.foldername(name))[1] in ('checklist','documentos','entregas','bim','nf','andamento','diario','orcamentos')
          and name not like 'nf/comprovantes/%')
    )
  );
drop policy if exists obra_storage_insert on storage.objects;
create policy obra_storage_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'obra' and (
      coalesce(public.app_perfil() in ('master','direcao'), false)
      or (public.app_perfil() = 'obra_prestador'
          and (storage.foldername(name))[1] in ('documentos','entregas','bim','andamento','diario','nf','orcamentos')
          and name not like 'nf/comprovantes/%')
    )
  );

-- Caixa: nova origem.
alter table public.fc_lancamentos drop constraint if exists fc_lancamentos_origem_check;
alter table public.fc_lancamentos add constraint fc_lancamentos_origem_check
  check (origem in ('planilha','manual','marco','medicao','oc','indireto','nf','nf_retencao','retencao','avulso'));

-- ── Auxiliares ──────────────────────────────────────────────────────────────
create or replace function public.fn_obra_avulso_evento(p_id uuid, p_acao text, p_de text, p_para text, p_comentario text, p_valor numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.obra_orcamento_avulso_eventos (orcamento_id, acao, de_status, para_status, comentario, valor, por, perfil)
  values (p_id, p_acao, p_de, p_para, nullif(trim(coalesce(p_comentario, '')), ''), p_valor,
          (select nome from public.usuarios where id = public.app_usuario_id()), public.app_perfil());
end $$;

create or replace function public.fn_obra_avulso_notificar(p_id uuid, p_tipo text, p_titulo text, p_corpo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.obra_notificacoes (destinatario, tipo, titulo, corpo, referencia_id)
  values ('obra_prestador', p_tipo, p_titulo, p_corpo, p_id);
end $$;

create or replace function public.fn_obra_avulso_rotulo(p_numero integer, p_titulo text)
returns text language sql immutable as $$
  select 'OA-' || lpad(p_numero::text, 3, '0') || ' · ' || p_titulo
$$;

create or replace function public.fn_obra_avulso_trava(p_id uuid)
returns public.obra_orcamentos_avulsos language plpgsql security definer set search_path = public as $$
declare v public.obra_orcamentos_avulsos;
begin
  select * into v from public.obra_orcamentos_avulsos where id = p_id for update;
  if v.id is null then raise exception 'Orçamento avulso não encontrado.'; end if;
  return v;
end $$;

do $$ declare f text;
begin
  foreach f in array array['fn_obra_avulso_evento(uuid, text, text, text, text, numeric)', 'fn_obra_avulso_notificar(uuid, text, text, text)',
                           'fn_obra_avulso_trava(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- ── 1 · Salvar (criar ou editar rascunho/ajustes) ───────────────────────────
-- p: { id?, titulo, descricao, justificativa, fase_id, referencia_precos,
--      itens: [{ fonte, codigo, descricao, unidade, quantidade_prevista, preco_unitario }] }
create or replace function public.obra_avulso_salvar(p jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v public.obra_orcamentos_avulsos;
  v_item jsonb;
  v_ordem integer := 0;
begin
  if coalesce(public.app_perfil(), '') not in ('obra_prestador','master','direcao') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if length(trim(coalesce(p ->> 'titulo', ''))) = 0 then raise exception 'Dê um título ao orçamento.'; end if;

  if v_id is null then
    insert into public.obra_orcamentos_avulsos (titulo, descricao, justificativa, fase_id, referencia_precos, registrado_por)
    values (trim(p ->> 'titulo'), nullif(trim(coalesce(p ->> 'descricao', '')), ''), nullif(trim(coalesce(p ->> 'justificativa', '')), ''),
            nullif(p ->> 'fase_id', '')::uuid, nullif(trim(coalesce(p ->> 'referencia_precos', '')), ''),
            (select nome from public.usuarios where id = public.app_usuario_id()))
    returning id into v_id;
    perform public.fn_obra_avulso_evento(v_id, 'criado', null, 'rascunho', null, null);
  else
    v := public.fn_obra_avulso_trava(v_id);
    if v.status not in ('rascunho','ajustes') then
      raise exception 'Só dá para editar um orçamento em rascunho ou com ajustes pedidos.';
    end if;
    update public.obra_orcamentos_avulsos set
      titulo = trim(p ->> 'titulo'),
      descricao = nullif(trim(coalesce(p ->> 'descricao', '')), ''),
      justificativa = nullif(trim(coalesce(p ->> 'justificativa', '')), ''),
      fase_id = nullif(p ->> 'fase_id', '')::uuid,
      referencia_precos = nullif(trim(coalesce(p ->> 'referencia_precos', '')), ''),
      atualizado_em = now()
    where id = v_id;
  end if;

  delete from public.obra_orcamento_avulso_itens where orcamento_id = v_id;
  for v_item in select * from jsonb_array_elements(coalesce(p -> 'itens', '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    insert into public.obra_orcamento_avulso_itens (orcamento_id, ordem, fonte, codigo, descricao, unidade, quantidade_prevista, preco_unitario)
    values (v_id, v_ordem, coalesce(nullif(v_item ->> 'fonte', ''), 'SINAPI'), nullif(trim(coalesce(v_item ->> 'codigo', '')), ''),
            trim(v_item ->> 'descricao'), trim(v_item ->> 'unidade'),
            (v_item ->> 'quantidade_prevista')::numeric, (v_item ->> 'preco_unitario')::numeric);
  end loop;

  update public.obra_orcamentos_avulsos o set valor_previsto = coalesce((
    select round(sum(round(i.quantidade_prevista * i.preco_unitario, 2)), 2)
      from public.obra_orcamento_avulso_itens i where i.orcamento_id = o.id), 0)
  where o.id = v_id;
  return v_id;
end $$;

-- ── 2 · Enviar para aprovação ───────────────────────────────────────────────
create or replace function public.obra_avulso_enviar(p_id uuid, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.obra_orcamentos_avulsos;
begin
  if coalesce(public.app_perfil(), '') not in ('obra_prestador','master','direcao') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  v := public.fn_obra_avulso_trava(p_id);
  if v.status not in ('rascunho','ajustes') then raise exception 'Este orçamento já foi enviado.'; end if;
  if not exists (select 1 from public.obra_orcamento_avulso_itens where orcamento_id = p_id) or v.valor_previsto <= 0 then
    raise exception 'Inclua ao menos um item com valor antes de enviar.';
  end if;
  update public.obra_orcamentos_avulsos set status = 'enviado', data_envio = now(), atualizado_em = now() where id = p_id;
  perform public.fn_obra_avulso_evento(p_id, 'enviado', v.status, 'enviado', p_comentario, v.valor_previsto);
end $$;

-- ── 3 · Decisão da Blue: aprovar, pedir ajustes ou reprovar ─────────────────
create or replace function public.obra_avulso_decidir(p_id uuid, p_decisao text, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.obra_orcamentos_avulsos;
  v_nome text := (select nome from public.usuarios where id = public.app_usuario_id());
  v_rot text;
begin
  if coalesce(public.app_perfil(), '') not in ('master','direcao') then
    raise exception 'Só a Blue (Master ou Direção) decide orçamentos avulsos.' using errcode = '42501';
  end if;
  if p_decisao not in ('aprovado','ajustes','reprovado') then raise exception 'Decisão inválida.'; end if;
  v := public.fn_obra_avulso_trava(p_id);
  if v.status <> 'enviado' then raise exception 'Só um orçamento enviado pode ser decidido.'; end if;
  if p_decisao <> 'aprovado' and length(trim(coalesce(p_comentario, ''))) < 5 then
    raise exception 'Explique o motivo para a construtora.';
  end if;
  v_rot := public.fn_obra_avulso_rotulo(v.numero, v.titulo);
  if p_decisao = 'aprovado' then
    update public.obra_orcamentos_avulsos set status = 'aprovado', valor_aprovado = valor_previsto,
           data_aprovacao = now(), aprovado_por = v_nome, atualizado_em = now() where id = p_id;
    perform public.fn_obra_avulso_notificar(p_id, 'avulso_aprovado', 'Orçamento avulso aprovado', v_rot || ' — ' || to_char(v.valor_previsto, 'FM999G999G990D00'));
  else
    update public.obra_orcamentos_avulsos set status = p_decisao, atualizado_em = now() where id = p_id;
    perform public.fn_obra_avulso_notificar(p_id, 'avulso_' || p_decisao,
      case p_decisao when 'ajustes' then 'Ajustes pedidos no orçamento avulso' else 'Orçamento avulso reprovado' end,
      v_rot || ' — ' || trim(p_comentario));
  end if;
  perform public.fn_obra_avulso_evento(p_id, p_decisao, 'enviado', p_decisao, p_comentario,
                                       case when p_decisao = 'aprovado' then v.valor_previsto end);
end $$;

-- ── 4 · Construtora informa a execução (quantidades reais) ──────────────────
-- p_itens: [{ id, quantidade_real }]; item omitido fica com a quantidade prevista.
create or replace function public.obra_avulso_informar_execucao(p_id uuid, p_itens jsonb, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v public.obra_orcamentos_avulsos; v_item jsonb; v_real numeric;
begin
  if coalesce(public.app_perfil(), '') not in ('obra_prestador','master','direcao') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  v := public.fn_obra_avulso_trava(p_id);
  if v.status <> 'aprovado' then raise exception 'Só um orçamento aprovado pode ter a execução informada.'; end if;
  update public.obra_orcamento_avulso_itens set quantidade_real = quantidade_prevista
   where orcamento_id = p_id and quantidade_real is null;
  for v_item in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    if nullif(v_item ->> 'quantidade_real', '') is not null then
      if (v_item ->> 'quantidade_real')::numeric < 0 then raise exception 'Quantidade real inválida.'; end if;
      update public.obra_orcamento_avulso_itens set quantidade_real = (v_item ->> 'quantidade_real')::numeric
       where id = (v_item ->> 'id')::uuid and orcamento_id = p_id;
    end if;
  end loop;
  select round(sum(round(quantidade_real * preco_unitario, 2)), 2) into v_real
    from public.obra_orcamento_avulso_itens where orcamento_id = p_id;
  update public.obra_orcamentos_avulsos set status = 'executado', data_execucao = now(), atualizado_em = now() where id = p_id;
  perform public.fn_obra_avulso_evento(p_id, 'executado', 'aprovado', 'executado', p_comentario, v_real);
end $$;

-- ── 5 · Blue confirma o valor real ──────────────────────────────────────────
create or replace function public.obra_avulso_conferir(p_id uuid, p_valor_real numeric default null, p_comentario text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v public.obra_orcamentos_avulsos;
  v_medido numeric;
  v_real numeric;
begin
  if coalesce(public.app_perfil(), '') not in ('master','direcao') then
    raise exception 'Só a Blue (Master ou Direção) confirma o valor real.' using errcode = '42501';
  end if;
  v := public.fn_obra_avulso_trava(p_id);
  if v.status not in ('aprovado','executado') then raise exception 'Só um orçamento aprovado ou executado pode ser conferido.'; end if;
  select round(sum(round(coalesce(quantidade_real, quantidade_prevista) * preco_unitario, 2)), 2) into v_medido
    from public.obra_orcamento_avulso_itens where orcamento_id = p_id;
  v_real := coalesce(p_valor_real, v_medido, v.valor_aprovado);
  if v_real is null or v_real <= 0 then raise exception 'Valor real inválido.'; end if;
  if v_real <> v_medido and length(trim(coalesce(p_comentario, ''))) < 5 then
    raise exception 'O valor real difere das quantidades informadas: explique o ajuste.';
  end if;
  update public.obra_orcamentos_avulsos set status = 'conferido', valor_real = round(v_real, 2), data_conferencia = now(),
         conferido_por = (select nome from public.usuarios where id = public.app_usuario_id()), atualizado_em = now()
   where id = p_id;
  perform public.fn_obra_avulso_evento(p_id, 'conferido', v.status, 'conferido', p_comentario, round(v_real, 2));
  perform public.fn_obra_avulso_notificar(p_id, 'avulso_conferido', 'Valor real confirmado no orçamento avulso',
    public.fn_obra_avulso_rotulo(v.numero, v.titulo) || ' — ' || to_char(v_real, 'FM999G999G990D00'));
end $$;

-- ── 6 · Pagamento (entra no caixa) e desfazer ───────────────────────────────
create or replace function public.obra_avulso_pagar(p_id uuid, p_data date, p_nf_numero text default null,
                                                    p_nf_url text default null, p_comprovante_url text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v public.obra_orcamentos_avulsos;
  v_nome text := (select nome from public.usuarios where id = public.app_usuario_id());
  v_planilha boolean;
begin
  if coalesce(public.app_perfil(), '') not in ('master','direcao') then
    raise exception 'Só a Blue (Master ou Direção) registra pagamento.' using errcode = '42501';
  end if;
  if p_data is null then raise exception 'Informe a data do pagamento.'; end if;
  v := public.fn_obra_avulso_trava(p_id);
  if v.status <> 'conferido' or v.valor_real is null then raise exception 'Confirme o valor real antes de pagar.'; end if;

  update public.obra_orcamentos_avulsos set status = 'pago', data_pagamento = p_data, pago_por = v_nome,
         nf_numero = nullif(trim(coalesce(p_nf_numero, '')), ''), nf_url = nullif(p_nf_url, ''),
         comprovante_url = nullif(p_comprovante_url, ''), atualizado_em = now()
   where id = p_id;

  -- Regra da planilha: se o sócio-diretor já lançou a linha "Triade" do mês, o caixa não duplica.
  v_planilha := exists (select 1 from public.fc_lancamentos l
                         where l.origem_id is null and l.grupo = 'saida' and l.fornecedor ~* 'tr[ií]ade'
                           and to_char(l.data, 'YYYY-MM') = to_char(p_data, 'YYYY-MM'));
  if not v_planilha then
    insert into public.fc_lancamentos (data, valor, grupo, centro_custo, fornecedor, descricao, origem, origem_id, registrado_por)
    values (p_data, -abs(v.valor_real), 'saida', v.centro_custo, 'TRÍADE',
            'Orçamento avulso ' || public.fn_obra_avulso_rotulo(v.numero, v.titulo), 'avulso', p_id, v_nome)
    on conflict (origem, origem_id) do nothing;
  end if;
  perform public.fn_obra_avulso_evento(p_id, 'pago', 'conferido', 'pago',
    case when v_planilha then 'No caixa pela linha "Triade" da planilha do mês (não duplicado).' end, v.valor_real);
  perform public.fn_obra_avulso_notificar(p_id, 'avulso_pago', 'Orçamento avulso pago',
    public.fn_obra_avulso_rotulo(v.numero, v.titulo) || ' — pago em ' || to_char(p_data, 'DD/MM/YYYY'));
  return jsonb_build_object('no_caixa', not v_planilha, 'pela_planilha', v_planilha);
end $$;

create or replace function public.obra_avulso_desfazer_pagamento(p_id uuid, p_comentario text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.obra_orcamentos_avulsos;
begin
  if coalesce(public.app_perfil(), '') not in ('master','direcao') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_comentario, ''))) < 5 then raise exception 'Explique por que o pagamento está sendo desfeito.'; end if;
  v := public.fn_obra_avulso_trava(p_id);
  if v.status <> 'pago' then raise exception 'Este orçamento não está pago.'; end if;
  delete from public.fc_lancamentos where origem = 'avulso' and origem_id = p_id;
  update public.obra_orcamentos_avulsos set status = 'conferido', data_pagamento = null, pago_por = null, atualizado_em = now() where id = p_id;
  perform public.fn_obra_avulso_evento(p_id, 'pagamento_desfeito', 'pago', 'conferido', p_comentario, v.valor_real);
end $$;

-- ── 7 · Cancelar e comentar ─────────────────────────────────────────────────
create or replace function public.obra_avulso_cancelar(p_id uuid, p_comentario text)
returns void language plpgsql security definer set search_path = public as $$
declare v public.obra_orcamentos_avulsos; v_perfil text := coalesce(public.app_perfil(), '');
begin
  if v_perfil not in ('obra_prestador','master','direcao') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  v := public.fn_obra_avulso_trava(p_id);
  if v_perfil = 'obra_prestador' and v.status not in ('rascunho','enviado','ajustes') then
    raise exception 'Depois de aprovado, só a Blue pode cancelar.';
  end if;
  if v.status in ('pago','cancelado','reprovado') then raise exception 'Este orçamento não pode ser cancelado.'; end if;
  update public.obra_orcamentos_avulsos set status = 'cancelado', atualizado_em = now() where id = p_id;
  perform public.fn_obra_avulso_evento(p_id, 'cancelado', v.status, 'cancelado', p_comentario, null);
end $$;

create or replace function public.obra_avulso_comentar(p_id uuid, p_comentario text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.app_perfil(), '') not in ('obra_prestador','master','direcao') then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if length(trim(coalesce(p_comentario, ''))) = 0 then raise exception 'Escreva o comentário.'; end if;
  perform public.fn_obra_avulso_trava(p_id);
  perform public.fn_obra_avulso_evento(p_id, 'comentario', null, null, p_comentario, null);
end $$;

do $$ declare f text;
begin
  foreach f in array array[
    'obra_avulso_salvar(jsonb)', 'obra_avulso_enviar(uuid, text)', 'obra_avulso_decidir(uuid, text, text)',
    'obra_avulso_informar_execucao(uuid, jsonb, text)', 'obra_avulso_conferir(uuid, numeric, text)',
    'obra_avulso_pagar(uuid, date, text, text, text)', 'obra_avulso_desfazer_pagamento(uuid, text)',
    'obra_avulso_cancelar(uuid, text)', 'obra_avulso_comentar(uuid, text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
