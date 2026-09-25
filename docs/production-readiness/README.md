# Preparação para produção — Blue Senior Living

Revisão de arquitetura, qualidade, segurança e confiabilidade feita em 24 e 25 de setembro de 2026 sobre a branch `claude/hopeful-franklin-yikyq4`. Nada aqui contém segredo nem dado real: os exemplos usam o seed fictício das migrations.

## Parecer

**NÃO APTO para produção. APTO SOMENTE PARA HOMOLOGAÇÃO** depois de aplicar as migrations 0133 e 0134 e de rotacionar as senhas (ver `05-status-continuidade.md`, item "O que depende do responsável").

Motivos que bloqueiam a produção hoje, em ordem de gravidade:

1. **31 de 32 contas do projeto de produção têm a senha "blue"**, inclusive contas de gestão e a do Master. Qualquer pessoa que saiba um e-mail entra. Confirmado pelo responsável em 25/09. **Decisão do responsável: as senhas não serão trocadas** (2 ou 3 acessos reais). Mitigação proposta: banir todas as contas não reais (ver `05`). O item permanece bloqueador até isso ser feito.
2. **14 contas de demonstração (`@demo.local`) ativas no projeto de produção**, todas com a senha "blue" e com login registrado em 04/09/2026. Decisão do responsável: manter por enquanto. Enquanto existirem, o ambiente não é de produção.
3. **As migrations 0133 e 0134 ainda não foram aplicadas em produção.** Sem elas continuam abertos: RPCs que aceitam usuário sem perfil, prontuário legível pela construtora, tabela de usuários (com salários) legível por qualquer logado, buckets de fotos abertos, autoria de registros escolhida pelo cliente.
4. **Fluxos assistenciais com defeito confirmado e não corrigido:** posologia padrão com horários incompatíveis com o intervalo escrito; edição de prescrição não atômica (pode deixar o hóspede sem a medicação); checklist e pendências da coordenação viram o dia à meia-noite; Day Care fora dos módulos clínicos. Detalhes em `02-achados.md`.
5. **Backup nunca restaurado em ambiente isolado** e sem monitoramento de falhas em produção (`04-procedimento-operacional.md`).
6. **Testes de ponta a ponta com persistência real não executados.** O que rodou foi: testes unitários (127), migrations do zero em banco descartável com smoke de RLS por perfil (36 verificações) e um crawler que abre as 165 rotas dos 16 perfis no Chromium com a API emulada (verifica renderização, não persistência).

## Arquivos

- `00-diagnostico.md` — stack, rotas, perfis, fluxos, schema, auth, testes, hospedagem, revalidação dos pontos da inspeção anterior.
- `01-cenarios-e-resultados.md` — cenários por funcionalidade e perfil, com resultado esperado, risco e o que foi de fato executado.
- `02-achados.md` — achados com identificador, gravidade, evidência, correção e teste.
- `03-decisoes-pendentes.md` — regras de negócio e clínicas que não devem ser inventadas pelo desenvolvimento.
- `04-procedimento-operacional.md` — instalação, variáveis, build, hospedagem, logs, backup, atualização, homologação e piloto.
- `05-status-continuidade.md` — estado final, comandos e resultados, commit, e o próximo passo exato.
