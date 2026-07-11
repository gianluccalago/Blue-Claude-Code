-- ===========================================================================
-- 0098 — LIVRO DE REGISTRO DE MEDICAMENTOS SUJEITOS A CONTROLE ESPECIAL
-- ---------------------------------------------------------------------------
-- Portaria ANVISA 344/98: a ILPI mantém livro de registro dos medicamentos
-- sujeitos a controle especial. Requisitos do produto:
--   • NÃO ADULTERÁVEL: assento lançado não pode ser editado nem excluído por
--     NENHUM perfil (correção = ESTORNO, lançado como novo assento).
--   • Editável (= lançável) apenas pelos acessos competentes:
--     farmácia, master (RT), coordenação e enfermeira.
--
-- Imutabilidade em 3 camadas:
--   1. RLS sem policy de UPDATE/DELETE (padrão log_alteracao/0036) e sem
--      policy de INSERT — TODO lançamento passa pela RPC (SECURITY DEFINER).
--   2. Trigger BEFORE UPDATE OR DELETE → RAISE EXCEPTION (vale inclusive para
--      service_role, que bypassa RLS mas não bypassa trigger).
--   3. HASH ENCADEADO server-side (pgcrypto sha256): cada assento assina o
--      conteúdo + hash do anterior. Adulteração direta no banco quebra a
--      cadeia e é acusada por verificar_livro_controlados().
--
-- Limite honesto: um superusuário do banco pode, em tese, reescrever a cadeia
-- inteira. Evidência disso exigiria âncora externa (fora de escopo).
--
-- Também adiciona a flag `controlado` na prescrição (o médico marca ao
-- prescrever; o selo aparece na farmácia e o livro nasce dessa origem).
-- Idempotente. Rode DEPOIS da 0030 (app_perfil/pgcrypto) e da 0001.
-- ===========================================================================

-- 0) Flag na prescrição: sujeito a controle especial (Port. 344/98).
alter table public.prescricao add column if not exists controlado boolean not null default false;
comment on column public.prescricao.controlado is
  'Medicamento sujeito a controle especial (Portaria 344/98). Marcado pelo médico ao prescrever; alimenta o selo na farmácia e o livro de controlados.';

-- 1) Sequência do nº do assento (numeração oficial contínua do livro).
create sequence if not exists public.livro_controlados_numero_seq;

-- 2) O livro (assentos).
create table if not exists public.livro_controlados (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigint not null unique,        -- nº do assento (sequencial)
  residente_id        uuid references public.residentes(id),  -- null p/ entrada da casa
  medicamento         text not null,                 -- MAIÚSCULAS (padrão do app)
  tipo_assento        text not null check (tipo_assento in
                        ('entrada','dispensacao','administracao','perda','vencimento','estorno')),
  quantidade          numeric not null check (quantidade > 0),
  unidade             text not null default 'unidade',
  justificativa       text,                          -- obrigatória p/ perda/vencimento/estorno (validada na RPC)
  referencia_numero   bigint,                        -- nº do assento estornado (quando estorno)
  registrado_por      text not null,
  perfil_registrador  text not null,
  registrado_em       timestamptz not null default now(),
  hash_anterior       text,                          -- hash do assento anterior (null no 1º)
  hash                text not null                  -- sha256(payload canônico + hash_anterior)
);
comment on table public.livro_controlados is
  'Portaria 344/98: livro de registro de medicamentos sujeitos a controle especial. APPEND-ONLY: assentos não podem ser editados/excluídos (trigger + RLS); correção = estorno como novo assento. Hash encadeado server-side (sha256) como evidência de integridade.';
create index if not exists idx_livro_medicamento on public.livro_controlados (medicamento, numero desc);
create index if not exists idx_livro_residente on public.livro_controlados (residente_id);

-- 3) Camada 2 — trigger que bloqueia UPDATE/DELETE para qualquer papel.
create or replace function public.fn_livro_imutavel()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Livro de controlados é imutável: assentos não podem ser % — registre um ESTORNO.',
    lower(TG_OP);
end;
$$;
drop trigger if exists trg_livro_imutavel on public.livro_controlados;
create trigger trg_livro_imutavel
  before update or delete on public.livro_controlados
  for each row execute function public.fn_livro_imutavel();

-- 4) Camada 1 — RLS: leitura para os perfis competentes; NENHUMA policy de
--    INSERT/UPDATE/DELETE (todo lançamento entra pela RPC SECURITY DEFINER).
alter table public.livro_controlados enable row level security;
drop policy if exists livro_select on public.livro_controlados;
create policy livro_select on public.livro_controlados for select to authenticated
  using (public.app_perfil() in ('farmacia','master','coordenacao','enfermeira','medico','direcao'));

-- 5) Camada 3 — RPC de lançamento com hash encadeado calculado NO SERVIDOR.
--    SECURITY DEFINER: contorna a ausência de policy de INSERT, mas valida o
--    perfil internamente (farmácia, master, coordenação, enfermeira).
create or replace function public.registrar_assento_controlado(
  p_residente_id  uuid,
  p_medicamento   text,
  p_tipo          text,
  p_quantidade    numeric,
  p_unidade       text,
  p_justificativa text,
  p_referencia    bigint,
  p_registrado_por text
) returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_perfil     text := public.app_perfil();
  v_numero     bigint;
  v_hash_ant   text;
  v_payload    text;
  v_hash       text;
  v_medicamento text := upper(regexp_replace(btrim(p_medicamento), '\s+', ' ', 'g'));
begin
  -- Autorização: só os acessos competentes lançam.
  if v_perfil is null or v_perfil not in ('farmacia','master','coordenacao','enfermeira') then
    raise exception 'Perfil não autorizado a lançar no livro de controlados.';
  end if;
  if v_medicamento = '' then
    raise exception 'Informe o medicamento.';
  end if;
  if p_tipo not in ('entrada','dispensacao','administracao','perda','vencimento','estorno') then
    raise exception 'Tipo de assento inválido.';
  end if;
  -- Justificativa obrigatória nos assentos sensíveis.
  if p_tipo in ('perda','vencimento','estorno') and coalesce(btrim(p_justificativa), '') = '' then
    raise exception 'Justificativa é obrigatória para %.', p_tipo;
  end if;
  -- Estorno precisa referenciar um assento existente (e não-estorno).
  if p_tipo = 'estorno' then
    if p_referencia is null
       or not exists (select 1 from public.livro_controlados
                      where numero = p_referencia and tipo_assento <> 'estorno') then
      raise exception 'Estorno precisa referenciar o nº de um assento existente.';
    end if;
  end if;

  -- Serializa o livro (cadeia de hash é global) e encadeia no último assento.
  perform pg_advisory_xact_lock(hashtextextended('livro_controlados', 0));
  select hash into v_hash_ant from public.livro_controlados order by numero desc limit 1;

  v_numero := nextval('public.livro_controlados_numero_seq');
  v_payload := concat_ws('|',
    v_numero, coalesce(p_residente_id::text, ''), v_medicamento, p_tipo,
    p_quantidade, coalesce(p_unidade, 'unidade'), coalesce(btrim(p_justificativa), ''),
    coalesce(p_referencia::text, ''), coalesce(p_registrado_por, ''), v_perfil,
    coalesce(v_hash_ant, 'GENESIS'));
  v_hash := encode(digest(v_payload, 'sha256'), 'hex');

  insert into public.livro_controlados
    (numero, residente_id, medicamento, tipo_assento, quantidade, unidade,
     justificativa, referencia_numero, registrado_por, perfil_registrador,
     hash_anterior, hash)
  values
    (v_numero, p_residente_id, v_medicamento, p_tipo, p_quantidade,
     coalesce(p_unidade, 'unidade'), nullif(btrim(p_justificativa), ''),
     p_referencia, p_registrado_por, v_perfil, v_hash_ant, v_hash);

  return v_numero;
end;
$$;
grant execute on function public.registrar_assento_controlado(uuid, text, text, numeric, text, text, bigint, text) to authenticated;

-- 6) Verificação de integridade: reprocessa a cadeia e aponta o 1º assento
--    inconsistente (null = cadeia íntegra). Só leitura.
create or replace function public.verificar_livro_controlados()
returns table (integro boolean, primeiro_numero_violado bigint, total_assentos bigint)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r          record;
  v_hash_ant text := null;
  v_payload  text;
  v_hash     text;
  v_total    bigint := 0;
begin
  if public.app_perfil() not in ('farmacia','master','coordenacao','enfermeira','medico','direcao') then
    raise exception 'Perfil não autorizado.';
  end if;
  for r in select * from public.livro_controlados order by numero asc loop
    v_total := v_total + 1;
    v_payload := concat_ws('|',
      r.numero, coalesce(r.residente_id::text, ''), r.medicamento, r.tipo_assento,
      r.quantidade, r.unidade, coalesce(r.justificativa, ''),
      coalesce(r.referencia_numero::text, ''), r.registrado_por, r.perfil_registrador,
      coalesce(v_hash_ant, 'GENESIS'));
    v_hash := encode(digest(v_payload, 'sha256'), 'hex');
    if r.hash <> v_hash or coalesce(r.hash_anterior, 'GENESIS') <> coalesce(v_hash_ant, 'GENESIS') then
      return query select false, r.numero, v_total;
      return;
    end if;
    v_hash_ant := r.hash;
  end loop;
  return query select true, null::bigint, v_total;
end;
$$;
grant execute on function public.verificar_livro_controlados() to authenticated;

-- Fim.
