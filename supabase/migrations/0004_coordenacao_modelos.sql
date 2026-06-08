-- ============================================================================
-- Blue Senior Living — Migration 0004
-- Perfil Coordenação Assistencial (BLOCO 1): Modelos de rotina.
-- Cria modelo_rotina e modelo_rotina_item. NÃO altera plano_cuidado_item
-- (usada pelo módulo Cuidadores).
--
-- COMO USAR:
--   Supabase > SQL Editor > New query > cole tudo > Run.
--   É seguro rodar mais de uma vez (idempotente) e NÃO apaga seus dados.
-- ============================================================================

-- 1. Modelos de rotina (templates reutilizáveis)
create table if not exists modelo_rotina (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true
);

create table if not exists modelo_rotina_item (
  id uuid primary key default gen_random_uuid(),
  modelo_id uuid not null references modelo_rotina(id) on delete cascade,
  tarefa text not null,
  horario text,
  responsavel text check (responsavel in ('cuidador','enfermagem')),
  tolerancia_minutos int not null default 30
);

create index if not exists modelo_rotina_item_modelo_idx on modelo_rotina_item (modelo_id);

-- 2. RLS (demo sem login) — mesma política liberada das demais tabelas.
do $$
declare t text;
begin
  foreach t in array array['modelo_rotina','modelo_rotina_item'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists demo_all on %I;', t);
    execute format(
      'create policy demo_all on %I for all to anon, authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- 3. Modelo de teste "Rotina padrão grau III" (só cria se ainda não existir).
do $$
declare m_id uuid;
begin
  select id into m_id from modelo_rotina where nome = 'Rotina padrão grau III' limit 1;
  if m_id is null then
    insert into modelo_rotina (nome) values ('Rotina padrão grau III') returning id into m_id;
    insert into modelo_rotina_item (modelo_id, tarefa, horario, responsavel, tolerancia_minutos) values
      (m_id,'Sinais vitais','07:00','enfermagem',30),
      (m_id,'Medicação','07:30','cuidador',30),
      (m_id,'Higiene oral','08:00','cuidador',30),
      (m_id,'Banho e troca','08:00','cuidador',30),
      (m_id,'Hidratação','08:30','cuidador',30),
      (m_id,'Mudança de decúbito','09:00','cuidador',30),
      (m_id,'Banho de sol','09:15','cuidador',30);
  end if;
end $$;

-- Fim.
