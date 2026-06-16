-- ===========================================================================
-- Blue Senior Living — migrations PENDENTES (0064 a 0077), na ordem.
-- Rodar TUDO de uma vez no Supabase (SQL Editor). Todas idempotentes.
-- ===========================================================================


-- >>>>>>>>>>>>>>>>>>>> 0064_peso_imc.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0064 — Peso e IMC (Nutricionista, BLOCO N6)
-- ---------------------------------------------------------------------------
-- Pesagem mensal estruturada (era só uma tarefa de checklist sem número).
-- Guarda peso, altura (a do cadastro, atualizável), IMC e a data. Perda de peso
-- em idoso é sinal de risco — por isso vira dado clínico com tendência.
--
-- IMC = peso_kg / altura_m². CLASSIFICAÇÃO GERIÁTRICA (mais alta que a do
-- adulto jovem): baixo peso < 22; adequado 22–27; excesso > 27. (A faixa do
-- idoso é deslocada para cima; usamos esta.)
--
-- Leitura clínica: o peso/IMC aparece na ficha do hóspede, na Visão 360º e
-- para o Médico (sinal clínico). Idempotente.
-- ===========================================================================

-- Altura no cadastro do residente (muda pouco; o peso muda todo mês).
alter table public.residentes add column if not exists altura_m numeric;

create table if not exists public.registro_peso (
  id             uuid primary key default gen_random_uuid(),
  residente_id   uuid not null references residentes(id) on delete cascade,
  peso_kg        numeric not null check (peso_kg > 0),
  altura_m       numeric,
  imc            numeric,
  data           date not null default current_date,
  registrado_por text,
  observacao     text,
  registrado_em  timestamptz not null default now()
);

create index if not exists registro_peso_residente_idx on public.registro_peso (residente_id, data);

-- ─── RLS: escreve Nutri+Master; LÊ a equipe clínica (não família) ───────────
alter table public.registro_peso enable row level security;
drop policy if exists registro_peso_select on public.registro_peso;
drop policy if exists registro_peso_write on public.registro_peso;
create policy registro_peso_select on public.registro_peso for select to authenticated
  using (public.app_perfil() <> 'familia');
create policy registro_peso_write on public.registro_peso for all to authenticated
  using (public.app_perfil() in ('nutricionista','master'))
  with check (public.app_perfil() in ('nutricionista','master'));

-- ─── Seed: altura + 3 pesagens p/ 2 hóspedes (Alzira em queda, Otávio estável)
update public.residentes set altura_m = 1.55 where id = 'a0000000-0000-0000-0000-000000000001' and altura_m is null;
update public.residentes set altura_m = 1.70 where id = 'a0000000-0000-0000-0000-000000000002' and altura_m is null;

insert into public.registro_peso (id, residente_id, peso_kg, altura_m, imc, data, registrado_por) values
  -- Alzira (1,55 m) — tendência de PERDA (63 → 61,5 → 58; última queda ~−5,7%)
  ('db000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',63.0,1.55, round(63.0/(1.55*1.55),1),(current_date - interval '2 months')::date,'Camila Rocha'),
  ('db000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',61.5,1.55, round(61.5/(1.55*1.55),1),(current_date - interval '1 month')::date,'Camila Rocha'),
  ('db000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',58.0,1.55, round(58.0/(1.55*1.55),1),current_date,'Camila Rocha'),
  -- Otávio (1,70 m) — ESTÁVEL (70 → 70,5 → 71)
  ('db000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000002',70.0,1.70, round(70.0/(1.70*1.70),1),(current_date - interval '2 months')::date,'Camila Rocha'),
  ('db000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000002',70.5,1.70, round(70.5/(1.70*1.70),1),(current_date - interval '1 month')::date,'Camila Rocha'),
  ('db000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000002',71.0,1.70, round(71.0/(1.70*1.70),1),current_date,'Camila Rocha')
on conflict (id) do nothing;


-- >>>>>>>>>>>>>>>>>>>> 0065_quarto_sem_tracos.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0065 — Número do quarto SEM traços (Bloco·Andar·Suíte·Letra → 1204A)
-- ---------------------------------------------------------------------------
-- A nomenclatura do quarto passa a ser uma string contínua, sem separadores:
-- bloco(1) + andar(1) + suíte(2 dígitos) + letra (ex.: "1-2-04-A" → "1204A").
-- Normaliza os valores já gravados que estão no formato antigo com traços;
-- texto livre (que não casa o padrão) fica intacto. Idempotente.
-- ===========================================================================

update public.residentes
set quarto = upper(
  regexp_replace(replace(quarto, '-', ''), '\s', '', 'g')
)
where quarto ~ '^\s*\d+-\d+-\d+\s*-?\s*[A-Ca-c]?\s*$';


-- >>>>>>>>>>>>>>>>>>>> 0066_cozinha_escala.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0066 — Escala da cozinha (Nutricionista, BLOCO N5)
-- ---------------------------------------------------------------------------
-- Escala PRÓPRIA da cozinha (CLT), INDEPENDENTE do módulo de Escalas
-- assistenciais (cuidadores) e SEM ponto. É controle interno da Nutricionista,
-- apenas visual — o campo `presente` é opcional e NÃO é ponto CLT.
--
-- Operação: 10 pessoas em dois grupos por paridade do dia (pares × ímpares),
-- 5 por dia, em turnos fixos:
--   06:30–18:30 → 1 cozinheiro + 1 auxiliar
--   09:30–21:30 → 1 cozinheiro + 1 auxiliar
--   08:00–20:00 → 1 cozinheiro
-- Como turno e grupo são fixos por pessoa, a escala se monta sozinha a partir
-- do cadastro (geração automática). Idempotente.
-- ===========================================================================

-- ─── Equipe da cozinha (cadastro) ───────────────────────────────────────────
create table if not exists public.cozinha_funcionario (
  id           uuid primary key default gen_random_uuid(),
  nome         text not null,
  funcao       text not null check (funcao in ('cozinheiro','auxiliar')),
  grupo        text not null check (grupo in ('par','impar')),
  turno_padrao text not null check (turno_padrao in ('06:30-18:30','09:30-21:30','08:00-20:00')),
  ativo        boolean not null default true,
  observacao   text
);

-- ─── Escala gerada (1 linha por pessoa por dia) ─────────────────────────────
create table if not exists public.cozinha_escala (
  id             uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references cozinha_funcionario(id) on delete cascade,
  data           date not null,
  inicio         text not null,
  fim            text not null,
  -- Controle visual opcional da Nutri (presença/falta). NÃO é ponto CLT.
  presente       boolean,
  observacao     text,
  -- Uma pessoa não pode ter dois turnos no mesmo dia (e torna a geração idempotente).
  unique (funcionario_id, data)
);

create index if not exists cozinha_escala_data_idx on public.cozinha_escala (data);

-- ─── RLS: a escala é da cozinha → Nutricionista + Master (leitura e escrita) ─
alter table public.cozinha_funcionario enable row level security;
alter table public.cozinha_escala enable row level security;
drop policy if exists cozinha_funcionario_all on public.cozinha_funcionario;
drop policy if exists cozinha_escala_all on public.cozinha_escala;
create policy cozinha_funcionario_all on public.cozinha_funcionario for all to authenticated
  using (public.app_perfil() in ('nutricionista','master'))
  with check (public.app_perfil() in ('nutricionista','master'));
create policy cozinha_escala_all on public.cozinha_escala for all to authenticated
  using (public.app_perfil() in ('nutricionista','master'))
  with check (public.app_perfil() in ('nutricionista','master'));

-- ─── Seed: 10 funcionários (5 pares, 5 ímpares) nos turnos do padrão ────────
insert into public.cozinha_funcionario (id, nome, funcao, grupo, turno_padrao) values
  -- Grupo PAR (trabalha nos dias pares)
  ('cf000000-0000-0000-0000-000000000001','Marcos Lima','cozinheiro','par','06:30-18:30'),
  ('cf000000-0000-0000-0000-000000000002','Paulo Souza','cozinheiro','par','09:30-21:30'),
  ('cf000000-0000-0000-0000-000000000003','Rita Alves','cozinheiro','par','08:00-20:00'),
  ('cf000000-0000-0000-0000-000000000004','João Pedro','auxiliar','par','06:30-18:30'),
  ('cf000000-0000-0000-0000-000000000005','Ana Clara','auxiliar','par','09:30-21:30'),
  -- Grupo ÍMPAR (trabalha nos dias ímpares)
  ('cf000000-0000-0000-0000-000000000006','Sandra Reis','cozinheiro','impar','06:30-18:30'),
  ('cf000000-0000-0000-0000-000000000007','Carlos Nunes','cozinheiro','impar','09:30-21:30'),
  ('cf000000-0000-0000-0000-000000000008','Beatriz Gomes','cozinheiro','impar','08:00-20:00'),
  ('cf000000-0000-0000-0000-000000000009','Tiago Melo','auxiliar','impar','06:30-18:30'),
  ('cf000000-0000-0000-0000-00000000000a','Luana Dias','auxiliar','impar','09:30-21:30')
on conflict (id) do nothing;

-- ─── Seed: gera a escala da SEMANA ATUAL (domingo→sábado) ───────────────────
-- Para cada dia, escala o grupo cuja paridade casa com o dia do mês, cada um no
-- seu turno padrão (início/fim derivados de turno_padrao). Idempotente.
insert into public.cozinha_escala (funcionario_id, data, inicio, fim, presente)
select f.id,
       g.d::date,
       split_part(f.turno_padrao, '-', 1),
       split_part(f.turno_padrao, '-', 2),
       null
from public.cozinha_funcionario f
cross join generate_series(
  -- Semana com início no DOMINGO (igual ao inicioDaSemana() da UI).
  current_date - extract(dow from current_date)::int,        -- domingo desta semana
  current_date - extract(dow from current_date)::int + 6,    -- sábado
  interval '1 day'
) as g(d)
where f.ativo
  and f.grupo = case when extract(day from g.d)::int % 2 = 0 then 'par' else 'impar' end
on conflict (funcionario_id, data) do nothing;


-- >>>>>>>>>>>>>>>>>>>> 0067_refeicao_equipe.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0067 — Custo da refeição dos funcionários (Nutricionista, BLOCO N7)
-- ---------------------------------------------------------------------------
-- Os funcionários comem de graça na casa. Não se registra prato a prato (no
-- buffet é inviável): ESTIMA-SE o custo mensal.
--
--   custo do mês = refeições/dia da equipe × dias do mês × custo médio/refeição
--
-- O "custo médio por refeição" é uma constante configurável (proxy enxuto e
-- fácil de manter do custo por porção do cardápio/N3). É CUSTO ESTIMADO, não
-- contábil, e NÃO gera cobrança (benefício à equipe, não upselling).
--
-- Mantém UMA config corrente, editável; cada alteração grava uma NOVA linha
-- (histórico), e a vigente é a de maior `vigente_desde`. Idempotente.
-- ===========================================================================

create table if not exists public.config_refeicao_equipe (
  id                            uuid primary key default gen_random_uuid(),
  refeicoes_equipe_por_dia      numeric not null check (refeicoes_equipe_por_dia >= 0),
  custo_medio_refeicao_fallback numeric not null check (custo_medio_refeicao_fallback >= 0),
  vigente_desde                 date not null default current_date,
  atualizado_por                text,
  atualizado_em                 timestamptz not null default now()
);

create index if not exists config_refeicao_equipe_vigencia_idx
  on public.config_refeicao_equipe (vigente_desde desc);

-- ─── RLS: configura Nutri+Master; LÊ também Administração e Direção ──────────
alter table public.config_refeicao_equipe enable row level security;
drop policy if exists config_refeicao_equipe_select on public.config_refeicao_equipe;
drop policy if exists config_refeicao_equipe_write on public.config_refeicao_equipe;
create policy config_refeicao_equipe_select on public.config_refeicao_equipe for select to authenticated
  using (public.app_perfil() in ('nutricionista','master','administracao','direcao'));
create policy config_refeicao_equipe_write on public.config_refeicao_equipe for all to authenticated
  using (public.app_perfil() in ('nutricionista','master'))
  with check (public.app_perfil() in ('nutricionista','master'));

-- ─── Seed: config de teste (30 refeições/dia; R$ 12,00 por refeição) ────────
insert into public.config_refeicao_equipe
  (id, refeicoes_equipe_por_dia, custo_medio_refeicao_fallback, vigente_desde, atualizado_por)
values
  ('c7000000-0000-0000-0000-000000000001', 30, 12.00,
   date_trunc('month', current_date)::date, 'Camila Rocha')
on conflict (id) do nothing;


-- >>>>>>>>>>>>>>>>>>>> 0068_baixa_viagem.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0068 — Baixa de estoque por VIAGEM (Farmácia)
-- ---------------------------------------------------------------------------
-- Caso EVENTUAL: o hóspede viaja X dias e leva a medicação. Em vez de
-- "dispensação de rotina" dia a dia, registra-se UMA baixa só, calculada a
-- partir das prescrições ATIVAS de via oral (dose diária × dias da viagem),
-- editável pela farmácia. A baixa decrementa o estoque_hospede de uma vez e
-- fica RASTREÁVEL aqui (motivo claro = viagem, não dispensação normal).
--
-- Durante os dias da viagem NÃO se espera dispensação diária (o hóspede está
-- fora): a tela de Dispensação passa a marcar esses hóspedes como "Em viagem"
-- em vez de "pendente" (não bloqueia nada — ver Dispensacao.tsx / MapaPeriodo).
--
-- Estorno: marca `estornado` e devolve as quantidades ao estoque (lançamento
-- por engano). O registro permanece como histórico. Idempotente.
--
-- AJUSTE 1 (entrada no meio do mês) NÃO precisa de schema novo: usa o campo
-- residentes.data_admissao (já existente) para sinalizar "aguardando primeiro
-- ciclo" e, opcionalmente, gravar provisionamento proporcional no
-- estoque_hospede (mesma tabela do ciclo mensal).
-- ===========================================================================

create table if not exists public.baixa_viagem (
  id             uuid primary key default gen_random_uuid(),
  residente_id   uuid not null references residentes(id) on delete cascade,
  dias           int not null check (dias > 0),
  -- Mês do estoque debitado ("YYYY-MM") — o mesmo saldo que a farmácia enxerga.
  mes_referencia text not null,
  -- [{ medicamento, quantidade, unidade }] — o que saiu para a viagem.
  itens          jsonb not null default '[]'::jsonb,
  data           date not null default current_date,  -- início da viagem
  observacao     text,
  registrado_por text,
  registrado_em  timestamptz not null default now(),
  -- Estorno (devolução ao estoque). Mantém a linha como trilha.
  estornado      boolean not null default false,
  estornado_por  text,
  estornado_em   timestamptz
);

create index if not exists baixa_viagem_residente_idx on public.baixa_viagem (residente_id, data);
create index if not exists baixa_viagem_data_idx on public.baixa_viagem (data);

-- ─── RLS: registra/estorna Farmácia+Master; LÊ a equipe clínica (não família) ─
alter table public.baixa_viagem enable row level security;
drop policy if exists baixa_viagem_select on public.baixa_viagem;
drop policy if exists baixa_viagem_write on public.baixa_viagem;
create policy baixa_viagem_select on public.baixa_viagem for select to authenticated
  using (public.app_perfil() <> 'familia');
create policy baixa_viagem_write on public.baixa_viagem for all to authenticated
  using (public.app_perfil() in ('farmacia','master'))
  with check (public.app_perfil() in ('farmacia','master'));


-- >>>>>>>>>>>>>>>>>>>> 0069_inspecao_foto_na.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0069 — Inspeção de suítes: foto opcional na não-conformidade + item "N/A"
-- ---------------------------------------------------------------------------
-- AJUSTE 1: ao marcar um item como "não conforme", a Hotelaria pode (opcional)
-- anexar UMA foto do problema. A foto fica no item da inspeção (foto_url) e,
-- quando a não-conformidade gera o chamado automático, é repassada ao chamado
-- em `foto_problema_url` — a manutenção vê o problema antes de ir ao local.
-- Essa foto do PROBLEMA é distinta da `foto_url` do chamado (evidência do
-- conserto no encerramento): as duas coexistem.
--
-- AJUSTE 2: o status do item passa a aceitar 'nao_se_aplica' (N/A) — ex.: quarto
-- sem sacada. É NEUTRO: não conta como conformidade nem não-conformidade e não
-- gera chamado (a lógica em JS já filtra por 'nao_conforme').
--
-- As fotos reutilizam o bucket existente 'manutencao-fotos' (mesmo domínio de
-- manutenção; criado em 0020). Idempotente.
-- ===========================================================================

-- Foto opcional do item de inspeção (problema visto).
alter table public.inspecao_item add column if not exists foto_url text;

-- status agora aceita 'nao_se_aplica' (N/A). Recria o check de forma idempotente.
alter table public.inspecao_item drop constraint if exists inspecao_item_status_check;
alter table public.inspecao_item add constraint inspecao_item_status_check
  check (status in ('conforme','nao_conforme','nao_se_aplica'));

-- Foto do PROBLEMA no chamado (vinda da inspeção). Distinta da foto_url de
-- encerramento — ambas convivem.
alter table public.chamado_manutencao add column if not exists foto_problema_url text;


-- >>>>>>>>>>>>>>>>>>>> 0070_enxoval.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0070 — Controle de ENXOVAL da casa (Lavanderia INTERNA)
-- ---------------------------------------------------------------------------
-- Substitui o módulo antigo de rouparia "saldo em trânsito" (fazia sentido para
-- lavanderia TERCEIRIZADA). A lavanderia agora é interna (máquina industrial +
-- secador, um funcionário); o ciclo diário de lavagem e a roupa PESSOAL dos
-- hóspedes são resolvidos FORA do app (etiqueta/organização física).
--
-- O app passa a controlar o ENXOVAL/PATRIMÔNIO da casa (jogos de cama, toalhas,
-- cobertores…): quanto existe (total), quanto está limpo disponível na rouparia
-- (disponível) e quando repor (estoque mínimo). Movimentos registram entrada
-- (compra/reposição), baixa por perda/descarte (sai do patrimônio — documenta o
-- custo de reposição) e ajuste de inventário. Idempotente.
-- ===========================================================================

-- Remove o módulo antigo (dados de teste descartados).
drop table if exists public.rouparia_transito cascade;

create table if not exists public.enxoval (
  id                    uuid primary key default gen_random_uuid(),
  categoria             text not null check (categoria in
    ('roupa_cama','toalha_banho','toalha_rosto','cobertor_manta','fronha','outro')),
  descricao             text not null,
  quantidade_total      int not null default 0 check (quantidade_total >= 0),
  quantidade_disponivel int not null default 0 check (quantidade_disponivel >= 0),
  estoque_minimo        int not null default 0 check (estoque_minimo >= 0),
  observacao            text,
  atualizado_em         timestamptz not null default now()
);

create table if not exists public.enxoval_movimento (
  id             uuid primary key default gen_random_uuid(),
  enxoval_id     uuid not null references public.enxoval(id) on delete cascade,
  tipo           text not null check (tipo in ('entrada','baixa_perda','ajuste')),
  -- Peças movimentadas (ajuste pode ser negativo: delta da contagem de limpas).
  quantidade     int not null,
  motivo         text,
  registrado_por text,
  registrado_em  timestamptz not null default now()
);

create index if not exists enxoval_movimento_enxoval_idx on public.enxoval_movimento (enxoval_id, registrado_em desc);
create index if not exists enxoval_movimento_data_idx     on public.enxoval_movimento (registrado_em desc);

-- ─── RLS: registra/edita Lavanderia+Master; LÊ também Administração e Direção ─
alter table public.enxoval enable row level security;
alter table public.enxoval_movimento enable row level security;
drop policy if exists enxoval_select on public.enxoval;
drop policy if exists enxoval_write on public.enxoval;
drop policy if exists enxoval_mov_select on public.enxoval_movimento;
drop policy if exists enxoval_mov_write on public.enxoval_movimento;
create policy enxoval_select on public.enxoval for select to authenticated
  using (public.app_perfil() in ('lavanderia','administracao','direcao','master'));
create policy enxoval_write on public.enxoval for all to authenticated
  using (public.app_perfil() in ('lavanderia','master'))
  with check (public.app_perfil() in ('lavanderia','master'));
create policy enxoval_mov_select on public.enxoval_movimento for select to authenticated
  using (public.app_perfil() in ('lavanderia','administracao','direcao','master'));
create policy enxoval_mov_write on public.enxoval_movimento for all to authenticated
  using (public.app_perfil() in ('lavanderia','master'))
  with check (public.app_perfil() in ('lavanderia','master'));

-- ─── Seed de teste (um item ABAIXO do mínimo p/ validar o alerta) ────────────
insert into public.enxoval (id, categoria, descricao, quantidade_total, quantidade_disponivel, estoque_minimo) values
  ('e0000000-0000-0000-0000-000000000001','roupa_cama','Lençol casal branco',40,32,12),
  ('e0000000-0000-0000-0000-000000000002','roupa_cama','Lençol solteiro branco',50,16,20),   -- disponível < mínimo (alerta)
  ('e0000000-0000-0000-0000-000000000003','fronha','Fronha branca',80,64,24),
  ('e0000000-0000-0000-0000-000000000004','toalha_banho','Toalha de banho branca',90,70,30),
  ('e0000000-0000-0000-0000-000000000005','toalha_rosto','Toalha de rosto branca',70,52,24),
  ('e0000000-0000-0000-0000-000000000006','cobertor_manta','Cobertor casal cinza',25,21,8)
on conflict (id) do nothing;

-- Movimentos de teste (alimentam o resumo do mês: 5 peças baixadas por perda).
insert into public.enxoval_movimento (id, enxoval_id, tipo, quantidade, motivo, registrado_por) values
  ('ed000000-0000-0000-0000-000000000001','e0000000-0000-0000-0000-000000000004','entrada',10,'compra/reposição','Marta Vasques'),
  ('ed000000-0000-0000-0000-000000000002','e0000000-0000-0000-0000-000000000001','baixa_perda',2,'peça danificada (rasgada)','Marta Vasques'),
  ('ed000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000002','baixa_perda',3,'extraviada','Marta Vasques')
on conflict (id) do nothing;


-- >>>>>>>>>>>>>>>>>>>> 0071_hospede_ciclo_vida.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0071 — Ciclo de vida do hóspede + Mapa das Suítes (PREP)
-- ---------------------------------------------------------------------------
-- Campos para o ciclo de vida (ativo/inativo por saída), sexo e número do
-- hóspede; e marcação de upselling RECORRENTE (fixo) vs avulso, para o Mapa
-- das Suítes somar só os fixos. Idempotente.
--
-- Regra: o filtro operacional (status_hospede='ativo') é aplicado nas QUERIES
-- da aplicação — a RLS continua liberando leitura à equipe (a gestão precisa
-- ver inativos no histórico; o histórico/financeiro é preservado).
-- ===========================================================================

alter table public.residentes add column if not exists sexo text
  check (sexo is null or sexo in ('masculino','feminino'));
alter table public.residentes add column if not exists status_hospede text not null default 'ativo'
  check (status_hospede in ('ativo','inativo'));
alter table public.residentes add column if not exists data_saida date;
alter table public.residentes add column if not exists motivo_saida text;
-- Número/identificador do hóspede (livre — ex.: "H-001").
alter table public.residentes add column if not exists numero_hospede text;

-- Garante 'ativo' nos existentes (o default cobre novos).
update public.residentes set status_hospede = 'ativo' where status_hospede is null;

-- Upselling: distingue recorrente (fixo mensal) de avulso.
alter table public.upselling add column if not exists recorrente boolean not null default false;

-- ─── Demo: sexo + número dos hóspedes de teste (não sobrescreve edições) ─────
update public.residentes set sexo = 'feminino' where id = 'a0000000-0000-0000-0000-000000000001' and sexo is null;
update public.residentes set sexo = 'masculino' where id = 'a0000000-0000-0000-0000-000000000002' and sexo is null;
update public.residentes set sexo = 'feminino' where id = 'a0000000-0000-0000-0000-000000000003' and sexo is null;
update public.residentes set sexo = 'masculino' where id = 'a0000000-0000-0000-0000-000000000004' and sexo is null;
update public.residentes set sexo = 'feminino' where id = 'a0000000-0000-0000-0000-000000000005' and sexo is null;
update public.residentes set sexo = 'masculino' where id = 'a0000000-0000-0000-0000-000000000006' and sexo is null;
update public.residentes set numero_hospede = 'H-001' where id = 'a0000000-0000-0000-0000-000000000001' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-002' where id = 'a0000000-0000-0000-0000-000000000002' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-003' where id = 'a0000000-0000-0000-0000-000000000003' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-004' where id = 'a0000000-0000-0000-0000-000000000004' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-005' where id = 'a0000000-0000-0000-0000-000000000005' and numero_hospede is null;
update public.residentes set numero_hospede = 'H-006' where id = 'a0000000-0000-0000-0000-000000000006' and numero_hospede is null;

-- ─── Demo: dois upsellings RECORRENTES (fixos) no mês corrente ───────────────
insert into public.upselling (id, residente_id, categoria, descricao, valor, mes_referencia, recorrente, lancado_por) values
  ('a5000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','Lavanderia extra','Lavanderia extra mensal (fixo)',180, to_char(current_date,'YYYY-MM'), true,'Administração'),
  ('a5000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000002','Medicamentos','Medicação contínua (fixo)',320, to_char(current_date,'YYYY-MM'), true,'Administração')
on conflict (id) do nothing;


-- >>>>>>>>>>>>>>>>>>>> 0072_custo_material.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0072 — Custos de materiais (limpeza e manutenção)
-- ---------------------------------------------------------------------------
-- A Administração registra despesas de material em DUAS categorias separadas:
-- limpeza e manutenção. Alimenta o RESULTADO do mês (useResumoMes.custoMateriais)
-- — não cria indicador novo, apenas a fonte única já existente. Idempotente.
-- ===========================================================================

create table if not exists public.custo_material (
  id              uuid primary key default gen_random_uuid(),
  categoria       text not null check (categoria in ('limpeza','manutencao')),
  descricao       text not null,
  valor           numeric not null check (valor >= 0),
  fornecedor      text,
  data            date not null default current_date,
  mes_referencia  text not null,
  comprovante_url text,
  registrado_por  text,
  criado_em       timestamptz not null default now()
);

create index if not exists custo_material_mes_idx on public.custo_material (mes_referencia);

-- ─── RLS: gestão (Administração/Direção/Master) lê e escreve ─────────────────
alter table public.custo_material enable row level security;
drop policy if exists custo_material_all on public.custo_material;
create policy custo_material_all on public.custo_material for all to authenticated
  using (public.app_perfil() in ('administracao','direcao','master'))
  with check (public.app_perfil() in ('administracao','direcao','master'));

-- ─── Storage — comprovantes (opcional) ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('custos-materiais-comprovantes', 'custos-materiais-comprovantes', true)
on conflict (id) do nothing;

drop policy if exists "custos_materiais_select" on storage.objects;
create policy "custos_materiais_select" on storage.objects for select
  using (bucket_id = 'custos-materiais-comprovantes');
drop policy if exists "custos_materiais_insert" on storage.objects;
create policy "custos_materiais_insert" on storage.objects for insert
  with check (bucket_id = 'custos-materiais-comprovantes');
drop policy if exists "custos_materiais_update" on storage.objects;
create policy "custos_materiais_update" on storage.objects for update
  using (bucket_id = 'custos-materiais-comprovantes');
drop policy if exists "custos_materiais_delete" on storage.objects;
create policy "custos_materiais_delete" on storage.objects for delete
  using (bucket_id = 'custos-materiais-comprovantes');

-- ─── Seed de teste (mês corrente) ───────────────────────────────────────────
insert into public.custo_material (id, categoria, descricao, valor, fornecedor, data, mes_referencia, registrado_por) values
  ('ca000000-0000-0000-0000-000000000001','limpeza','Produtos de limpeza (reposição do mês)',850.00,'Distribuidora Limpa Tudo', current_date, to_char(current_date,'YYYY-MM'),'Administração'),
  ('ca000000-0000-0000-0000-000000000002','manutencao','Materiais elétricos e hidráulicos',430.00,'Casa do Construtor', current_date, to_char(current_date,'YYYY-MM'),'Administração')
on conflict (id) do nothing;


-- >>>>>>>>>>>>>>>>>>>> 0073_usuarios_sem_acesso.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0073 — Registro de pessoal SEM ACESSO (equipe e custo, sem login)
-- ---------------------------------------------------------------------------
-- Permite cadastrar pessoal só para REGISTRO de equipe e custo de pessoal, sem
-- criar login/perfil de acesso. `sem_acesso=true` → não loga (AuthProvider
-- bloqueia), não aparece em seleção de perfil, mas entra na tela Equipe e no
-- Custo de Pessoal (via funcao + tipo_remuneracao). `contato` para registro.
-- Idempotente.
-- ===========================================================================

alter table public.usuarios add column if not exists sem_acesso boolean not null default false;
alter table public.usuarios add column if not exists contato text;

-- ─── Demo: pessoal sem acesso (entram no custo de pessoal via mensal_fixo) ──
insert into public.usuarios
  (id, nome, email, perfil, ativo, funcao, vinculo, sem_acesso, isento_ponto_app, tipo_remuneracao, valor_mensal, horario_trabalho, contato)
values
  ('b0000000-0000-0000-0000-000000000020','Rosa Lima', null,'servicos_gerais',true,'Limpeza','CLT', true, true,'mensal_fixo',1800,'Seg–Sex 7h–16h','(41) 99999-0020'),
  ('b0000000-0000-0000-0000-000000000021','José Carlos', null,'servicos_gerais',true,'Cozinha','CLT', true, true,'mensal_fixo',2100,'Seg–Sáb 6h–14h','(41) 99999-0021')
on conflict (id) do update
  set sem_acesso = excluded.sem_acesso, funcao = excluded.funcao,
      tipo_remuneracao = excluded.tipo_remuneracao, valor_mensal = excluded.valor_mensal,
      horario_trabalho = excluded.horario_trabalho, contato = excluded.contato;


-- >>>>>>>>>>>>>>>>>>>> 0074_funil_vendas_admin_select.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0074 — Funil de Vendas histórico: Administração lê crm_oportunidade
-- ---------------------------------------------------------------------------
-- O CRM operacional é da Direção + Master (a Administração perdeu na 0043). Mas
-- o FUNIL DE VENDAS histórico/analítico precisa ser visível também à
-- Administração. Damos SELECT (somente leitura) em crm_oportunidade — não no CRM
-- inteiro. Política aditiva (RLS = OR): não afeta o acesso total de Master/
-- Direção (crm_admin_all). Idempotente.
-- ===========================================================================

do $$
begin
  if to_regclass('public.crm_oportunidade') is not null then
    drop policy if exists crm_oportunidade_select_adm on public.crm_oportunidade;
    create policy crm_oportunidade_select_adm on public.crm_oportunidade
      for select to authenticated
      using (public.app_perfil() = 'administracao');
  end if;
end $$;


-- >>>>>>>>>>>>>>>>>>>> 0075_modalidade_estadia.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0075 — Modalidade de estadia (longa/curta permanência, day care)
-- ---------------------------------------------------------------------------
-- - longa_permanencia (padrão): como hoje (ocupa leito, mensalidade).
-- - curta_permanencia: OPERACIONALMENTE igual à longa (ocupa leito, cuidado
--   completo, aparece em todas as telas), mas TEMPORÁRIA (data_fim_prevista) e
--   sem mensalidade automática (cobrança por diária/pacote — Frente B futura).
-- - day_care: NÃO ocupa leito; frequenta só o período da tarde; cuidado leve.
--   Não entra na ocupação de leitos nem no mapa de suítes — só na lista própria.
--
-- O encerramento de estadia temporária reaproveita o ciclo de inativação
-- (status_hospede/data_saida/motivo_saida — já existentes). Idempotente.
-- ===========================================================================

alter table public.residentes add column if not exists modalidade text not null default 'longa_permanencia'
  check (modalidade in ('longa_permanencia','curta_permanencia','day_care'));
alter table public.residentes add column if not exists data_inicio_estadia date;
alter table public.residentes add column if not exists data_fim_prevista date;

-- Início da estadia = admissão, quando não informado.
update public.residentes set data_inicio_estadia = data_admissao where data_inicio_estadia is null;

-- ─── Demo: uma CURTA PERMANÊNCIA (ocupa leito, temporária) ──────────────────
update public.residentes
  set modalidade = 'curta_permanencia',
      data_fim_prevista = current_date + 18,
      data_inicio_estadia = coalesce(data_inicio_estadia, data_admissao)
  where id = 'a0000000-0000-0000-0000-000000000006';

-- ─── Demo: um DAY CARE (não ocupa leito; sem quarto) ────────────────────────
insert into public.residentes
  (id, nome, sexo, grau_dependencia, grau_contratual, data_admissao, data_inicio_estadia, status_hospede, modalidade, numero_hospede)
values
  ('a0000000-0000-0000-0000-000000000007','Vicente Fonseca','masculino','I','I', current_date, current_date, 'ativo','day_care','H-007')
on conflict (id) do update
  set modalidade = excluded.modalidade, status_hospede = excluded.status_hospede,
      data_inicio_estadia = excluded.data_inicio_estadia;


-- >>>>>>>>>>>>>>>>>>>> 0076_cobranca_temporaria.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0076 — Precificação e cobrança de temporários (curta permanência / day care)
-- ---------------------------------------------------------------------------
-- Longa permanência paga MENSALIDADE (já existe). Temporários pagam por
-- DIÁRIA/PACOTE/AVULSO, com valores muito variáveis → a Administração lança a
-- cobrança MANUALMENTE (aberta). A tabela_diaria é só REFERÊNCIA (baliza), não
-- regra; pacotes/combinações são livres (não tabelados).
--
-- As cobranças entram no faturamento do mês (useResumoMes) junto das
-- mensalidades — sem duplicar a lógica de mensalidade. Idempotente.
-- ===========================================================================

-- ─── Tabela de REFERÊNCIA de diárias (orientativa; edita Master/Direção) ─────
create table if not exists public.tabela_diaria (
  id               uuid primary key default gen_random_uuid(),
  modalidade       text not null check (modalidade in ('curta_permanencia','day_care')),
  grau             text not null check (grau in ('I','II','III')),
  tipo_valor       text not null check (tipo_valor in ('diaria','day_care_periodo')),
  valor_referencia numeric not null default 0 check (valor_referencia >= 0),
  observacao       text,
  atualizado_em    timestamptz not null default now(),
  atualizado_por   text,
  unique (modalidade, grau, tipo_valor)
);

-- ─── Cobrança do temporário (FLEXÍVEL; lança a Administração) ────────────────
create table if not exists public.cobranca_temporaria (
  id                 uuid primary key default gen_random_uuid(),
  residente_id       uuid not null references residentes(id) on delete cascade,
  modalidade         text not null check (modalidade in ('curta_permanencia','day_care')),
  descricao          text not null,
  valor              numeric not null check (valor >= 0),
  periodo_referencia text not null,  -- "YYYY-MM"
  data               date not null default current_date,
  status             text not null default 'pendente' check (status in ('pendente','pago')),
  pago_em            timestamptz,
  registrado_por     text,
  criado_em          timestamptz not null default now()
);
create index if not exists cobranca_temporaria_mes_idx on public.cobranca_temporaria (periodo_referencia);
create index if not exists cobranca_temporaria_residente_idx on public.cobranca_temporaria (residente_id, periodo_referencia);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.tabela_diaria enable row level security;
drop policy if exists tabela_diaria_select on public.tabela_diaria;
drop policy if exists tabela_diaria_write on public.tabela_diaria;
create policy tabela_diaria_select on public.tabela_diaria for select to authenticated
  using (public.app_perfil() in ('administracao','direcao','master'));
create policy tabela_diaria_write on public.tabela_diaria for all to authenticated
  using (public.app_perfil() in ('direcao','master'))
  with check (public.app_perfil() in ('direcao','master'));

alter table public.cobranca_temporaria enable row level security;
drop policy if exists cobranca_temporaria_select on public.cobranca_temporaria;
drop policy if exists cobranca_temporaria_write on public.cobranca_temporaria;
-- Leitura: gestão total; família só o seu hóspede.
create policy cobranca_temporaria_select on public.cobranca_temporaria for select to authenticated
  using (
    public.app_perfil() in ('administracao','direcao','master')
    or (public.app_perfil() = 'familia' and residente_id = public.app_residente_familia())
  );
create policy cobranca_temporaria_write on public.cobranca_temporaria for all to authenticated
  using (public.app_perfil() in ('administracao','direcao','master'))
  with check (public.app_perfil() in ('administracao','direcao','master'));

-- ─── Seed: tabela de referência (valores de baliza) ─────────────────────────
insert into public.tabela_diaria (modalidade, grau, tipo_valor, valor_referencia, observacao) values
  ('curta_permanencia','I','diaria',350,'Referência — ajustar por caso'),
  ('curta_permanencia','II','diaria',430,'Referência — ajustar por caso'),
  ('curta_permanencia','III','diaria',520,'Referência — ajustar por caso'),
  ('day_care','I','day_care_periodo',180,'Período da tarde — referência'),
  ('day_care','II','day_care_periodo',220,'Período da tarde — referência'),
  ('day_care','III','day_care_periodo',270,'Período da tarde — referência')
on conflict (modalidade, grau, tipo_valor) do nothing;

-- ─── Seed: cobranças de teste (mês corrente) ────────────────────────────────
insert into public.cobranca_temporaria (id, residente_id, modalidade, descricao, valor, periodo_referencia, status, registrado_por) values
  ('cb000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000006','curta_permanencia','Curta permanência 18 dias — pós-operatório', 9360, to_char(current_date,'YYYY-MM'),'pendente','Administração'),
  ('cb000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000007','day_care','Day Care — pacote 3ª e 5ª (mês)', 2400, to_char(current_date,'YYYY-MM'),'pendente','Administração')
on conflict (id) do nothing;


-- >>>>>>>>>>>>>>>>>>>> 0077_rh_eventos.sql >>>>>>>>>>>>>>>>>>>>
-- ===========================================================================
-- 0077 — RH: registro de eventos de pessoal (CAPTURA dos dados)
-- ---------------------------------------------------------------------------
-- Captura ausências, afastamentos e desligamentos dos profissionais (usuarios,
-- inclusive registros SEM ACESSO). Estes registros vão ALIMENTAR os painéis de
-- RH (turnover, absenteísmo, cobertura de escala) no próximo bloco — aqui é só
-- a coleta.
--
-- PRIVACIDADE: o afastamento guarda APENAS o GRUPO do CID (categoria/letra),
-- nunca o diagnóstico detalhado — dado SENSÍVEL de saúde do funcionário. As três
-- tabelas têm RLS restrita à gestão (Administração/Direção/Master). Idempotente.
-- ===========================================================================

-- Tempo de casa / turnover precisa da admissão do profissional.
alter table public.usuarios add column if not exists data_admissao date;

-- ─── 1) Ausências (atestado, falta, férias, licenças, evento…) ──────────────
create table if not exists public.rh_ausencia (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references usuarios(id) on delete cascade,
  tipo            text not null check (tipo in
    ('atestado','falta_sem_atestado','ferias','licenca_maternidade','licenca_inss','evento','outro')),
  data_inicio     date not null,
  data_fim        date not null,
  dias            int not null default 1,
  gerou_cobertura boolean not null default false,
  observacao      text,
  registrado_por  text,
  criado_em       timestamptz not null default now()
);
create index if not exists rh_ausencia_prof_idx on public.rh_ausencia (profissional_id, data_inicio);
create index if not exists rh_ausencia_data_idx on public.rh_ausencia (data_inicio);

-- ─── 2) Afastamentos (com GRUPO do CID — dado sensível, só o grupo) ─────────
create table if not exists public.rh_afastamento (
  id              uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references usuarios(id) on delete cascade,
  data_inicio     date not null,
  data_fim        date,                  -- null = ainda afastado
  dias_perdidos   int not null default 0,
  -- APENAS o grupo/letra do CID (ex.: "F - Transtornos mentais"). Sem diagnóstico.
  cid_grupo       text,
  observacao      text,
  registrado_por  text,
  criado_em       timestamptz not null default now()
);
create index if not exists rh_afastamento_prof_idx on public.rh_afastamento (profissional_id, data_inicio);
create index if not exists rh_afastamento_data_idx on public.rh_afastamento (data_inicio);

-- ─── 3) Desligamentos ───────────────────────────────────────────────────────
create table if not exists public.rh_desligamento (
  id                 uuid primary key default gen_random_uuid(),
  profissional_id    uuid not null references usuarios(id) on delete cascade,
  data_desligamento  date not null,
  motivo             text not null check (motivo in
    ('pedido_demissao_voluntario','sem_justa_causa','com_justa_causa','fim_experiencia','fim_contrato','outro')),
  cargo              text,   -- snapshot do cargo na saída
  tempo_casa_meses   int,    -- calculado da admissão
  observacao         text,
  registrado_por     text,
  criado_em          timestamptz not null default now()
);
create index if not exists rh_desligamento_prof_idx on public.rh_desligamento (profissional_id);
create index if not exists rh_desligamento_data_idx on public.rh_desligamento (data_desligamento);

-- ─── RLS: somente gestão (CID e dados de pessoal são sensíveis) ─────────────
do $$ declare t text;
begin
  foreach t in array array['rh_ausencia','rh_afastamento','rh_desligamento'] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists rh_gestao_all on public.%I;', t);
    execute format(
      'create policy rh_gestao_all on public.%I for all to authenticated '
      || 'using (public.app_perfil() in (''administracao'',''direcao'',''master'')) '
      || 'with check (public.app_perfil() in (''administracao'',''direcao'',''master''));', t);
  end loop;
end $$;

-- ─── Demo: admissão dos profissionais + um evento de cada tipo ──────────────
update public.usuarios set data_admissao = (current_date - interval '2 years')::date
  where data_admissao is null and perfil <> 'familia';

insert into public.rh_ausencia (id, profissional_id, tipo, data_inicio, data_fim, dias, gerou_cobertura, registrado_por)
select 'fa000000-0000-0000-0000-000000000001', u.id, 'atestado', current_date - 3, current_date - 2, 2, true, 'Administração'
from public.usuarios u where u.perfil = 'cuidador' and u.ativo order by u.nome limit 1
on conflict (id) do nothing;

insert into public.rh_afastamento (id, profissional_id, data_inicio, data_fim, dias_perdidos, cid_grupo, registrado_por)
select 'fb000000-0000-0000-0000-000000000001', u.id, current_date - 20, null, 20, 'M - Doenças do sistema osteomuscular', 'Administração'
from public.usuarios u where u.perfil = 'enfermagem' and u.ativo order by u.nome limit 1
on conflict (id) do nothing;

insert into public.rh_desligamento (id, profissional_id, data_desligamento, motivo, cargo, tempo_casa_meses, registrado_por)
select 'fc000000-0000-0000-0000-000000000001', u.id, current_date - 10, 'pedido_demissao_voluntario', coalesce(u.funcao,'Cuidadora'), 24, 'Administração'
from public.usuarios u where u.perfil = 'cuidador' and u.ativo order by u.nome desc limit 1
on conflict (id) do nothing;

