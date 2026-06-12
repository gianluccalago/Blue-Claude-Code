-- ===========================================================================
-- 0039 — Nomes sem títulos/honoríficos (equipe e hóspedes)
-- ---------------------------------------------------------------------------
-- Remove prefixos de tratamento (Dr., Dra., Enf., Téc., Prof., Profª, Farm.,
-- Nut., Sr., Sra., Dona…) dos nomes em `usuarios` e `residentes`. A função/
-- profissão da EQUIPE passa a viver em `usuarios.funcao` (exibida como tag na
-- interface). Hóspedes ficam apenas com o nome.
--
-- Idempotente: o strip por regex é seguro de rodar mais de uma vez (o prefixo
-- já não existe na 2ª execução) e os ajustes por id usam valores finais.
-- ===========================================================================

-- 1) EQUIPE — nomes "humanos" + função na coluna própria.
--    Os mocks antigos usavam o cargo como sobrenome ("Eduardo Master",
--    "Helena Geriatra"); aqui o nome vira um nome real e o cargo vai p/ funcao.
update usuarios set nome = 'Eduardo Nogueira',  funcao = coalesce(funcao, 'Diretor Geral')            where id = 'b0000000-0000-0000-0000-000000000001';
update usuarios set nome = 'Helena Marques',    funcao = coalesce(funcao, 'Médica Geriatra')          where id = 'b0000000-0000-0000-0000-000000000002';
update usuarios set nome = 'Patrícia Antunes',  funcao = coalesce(funcao, 'Coordenadora Assistencial') where id = 'b0000000-0000-0000-0000-000000000003';
update usuarios set nome = 'Ana Paula Dias',    funcao = coalesce(funcao, 'Cuidadora')                where id = 'b0000000-0000-0000-0000-000000000004';
update usuarios set nome = 'Renata Vidal',      funcao = coalesce(funcao, 'Fisioterapeuta')           where id = 'b0000000-0000-0000-0000-000000000005';
update usuarios set nome = 'Lucas Pereira',     funcao = coalesce(funcao, 'Farmacêutico')             where id = 'b0000000-0000-0000-0000-000000000006';
update usuarios set nome = 'Cláudia Ferreira',  funcao = coalesce(funcao, 'Administradora')           where id = 'b0000000-0000-0000-0000-000000000007';
update usuarios set nome = 'Carla Mendes',      funcao = coalesce(funcao, 'Enfermeira')               where id = 'b0000000-0000-0000-0000-000000000012';
update usuarios set nome = 'Patrícia Gomes',    funcao = coalesce(funcao, 'Técnica de Enfermagem')    where id = 'b0000000-0000-0000-0000-000000000013';
update usuarios set nome = 'Camila Rocha',      funcao = coalesce(funcao, 'Nutricionista')            where id = 'b0000000-0000-0000-0000-000000000014';
update usuarios set nome = 'Hélio Barbosa',     funcao = coalesce(funcao, 'Supervisor de Hotelaria')  where id = 'b0000000-0000-0000-0000-000000000015';

-- 2) HÓSPEDES — somente o nome (sem Sr./Sra./Dona/Profª…).
update residentes set nome = 'Alzira Bittencourt' where id = 'a0000000-0000-0000-0000-000000000001';
update residentes set nome = 'Otávio Lemos'       where id = 'a0000000-0000-0000-0000-000000000002';
update residentes set nome = 'Iracema Nunes'      where id = 'a0000000-0000-0000-0000-000000000003';
update residentes set nome = 'Benedito Faria'     where id = 'a0000000-0000-0000-0000-000000000004';
update residentes set nome = 'Cecília Andrade'    where id = 'a0000000-0000-0000-0000-000000000005';
update residentes set nome = 'Walter Krause'      where id = 'a0000000-0000-0000-0000-000000000006';

-- 3) CATCH-ALL — qualquer outro registro (inclusive criado pelo usuário) tem o
--    prefixo de tratamento no início do nome removido. Ordem do alternation:
--    tokens mais longos primeiro p/ não deixar resíduo (ex.: "Profª" antes de
--    "Prof"). O \.? torna o ponto opcional; \s+ garante que é um prefixo isolado.
update usuarios
  set nome = trim(regexp_replace(
    nome,
    '^(Dona|Dra|Drª|Dr|Enfª|Enf|Téc|Tec|Profª|Profa|Prof|Farm|Nut|Sra|Srª|Sr|D)\.?\s+',
    ''))
  where nome ~ '^(Dona|Dra|Drª|Dr|Enfª|Enf|Téc|Tec|Profª|Profa|Prof|Farm|Nut|Sra|Srª|Sr|D)\.?\s+';

update residentes
  set nome = trim(regexp_replace(
    nome,
    '^(Dona|Dra|Drª|Dr|Enfª|Enf|Téc|Tec|Profª|Profa|Prof|Farm|Nut|Sra|Srª|Sr|D)\.?\s+',
    ''))
  where nome ~ '^(Dona|Dra|Drª|Dr|Enfª|Enf|Téc|Tec|Profª|Profa|Prof|Farm|Nut|Sra|Srª|Sr|D)\.?\s+';
