# 01 · Cenários por funcionalidade e perfil — resultados

Legenda de resultado: **APROVADO** (executado e passou), **REPROVADO** (executado e falhou; ver achado), **NÃO EXECUTADO** (sem ambiente ou sem tempo; motivo indicado). A implementação atual não foi tomada como prova de regra de negócio correta: onde a regra está indefinida, o cenário aponta para `03-decisoes-pendentes.md`.

Ambiente dos testes: Postgres 16 local descartável com stubs do Supabase e o seed fictício das migrations; app servido pelo Vite com a API emulada. Nenhum teste tocou o projeto de produção.

## Autenticação e autorização

- Acesso anônimo a tabelas e RPCs — esperado: negado. **APROVADO** (smoke: `anon não executa obra_pagar_marco`, `anon não lê usuarios`).
- Usuário inativo com JWT válido chamando RPC privilegiada — esperado: negado. **APROVADO** (`inativo não paga marco`, `inativo não troca senha do master`). Antes da 0133: REPROVADO (achado SEG-01).
- Inativar usuário derruba a credencial — esperado: banido no Auth. **APROVADO** em banco local (`banned_until = infinity`). A revogação real no Supabase Auth só se comprova em homologação: **NÃO EXECUTADO** contra o Auth real.
- Alterar a URL para outro perfil — esperado: redirecionado. **APROVADO** (crawler; `AppShell`). Família em `/app/familia/escalas` — esperado: redirecionada ao início. **APROVADO** por código; não há teste automatizado de navegação.
- Auto-atribuição de perfil privilegiado — esperado: negado. **APROVADO** (`direção não se promove a master`, `não muda o próprio perfil`, `coordenação não duplica o e-mail do master`).
- Família acessa outro residente — esperado: nada visível. **APROVADO** (`família não vê outros residentes`, fotos só da própria pasta).
- Construtora acessa prontuário, escala, usuários, comprovantes — esperado: nada. **APROVADO** (12 verificações). Antes da 0133: REPROVADO (SEG-02).
- Cache após logout ou troca de usuário — esperado: limpo. **APROVADO** por código (`queryClient.clear()`); **NÃO EXECUTADO** em navegador com dois usuários reais.
- Autoria enviada pelo cliente com nome falso — esperado: servidor grava o autenticado. **APROVADO** (`autoria da medicação vem do servidor`).
- Sessão expirada durante o preenchimento — **NÃO EXECUTADO** (exige Auth real). Comportamento esperado por código: a gravação falha com erro de sessão e o toast global avisa; o formulário permanece na tela.

## Residentes e profissionais

- Cadastro, edição, desativação (registrar saída), vínculos — **APROVADO** por leitura de código e crawler; **NÃO EXECUTADO** ponta a ponta com persistência.
- Exclusão física de hóspede com histórico — esperado: negada. **APROVADO** (`master não apaga hóspede com prontuário`). Antes da 0134: REPROVADO (28 cascatas apagariam o prontuário).
- Mensalidade com centavos na ficha — esperado: aceita "7500,50". **APROVADO** por código (24/09); sem teste automatizado de componente.
- Troca rápida de residente sem misturar dados — teste cognitivo por hóspede: REPROVADO em 24/09, corrigido (chave de remontagem). Medicação: `MedicacaoDoHospede` sem guard quando o residente sai da lista — **REPROVADO, não corrigido** (achado CLI-09).

## Planos, modelos e checklists

- Aplicar modelo duas vezes — esperado: sem duplicar. **REPROVADO** (CLI-06, não corrigido).
- Seleção em lote "vazando" para a próxima tarefa — REPROVADO em 24/09, corrigido.
- Tarefa de enfermagem marcável pela cuidadora — **REPROVADO** (CLI-10, não corrigido; depende de regra: `03-decisoes-pendentes.md`).
- Checklist depois da meia-noite no plantão noturno — **REPROVADO** (CLI-02, não corrigido; depende de desenho da "data do plantão").
- Gravação exige plantão ativo — o checklist bloqueia sem check-in por código; **NÃO EXECUTADO** ponta a ponta.

## Medicação

- Registro completo, parcial e não administrado; coerência entre cuidador, enfermagem e coordenação — **APROVADO** por leitura; **NÃO EXECUTADO** ponta a ponta.
- Um registro "sim, todas" por período — a tela lista os medicamentos e registra um só evento por período; se a prescrição mudar depois, o registro antigo continua "sim". **Regra a validar** (`03-decisoes-pendentes.md`).
- Dose da noite depois da meia-noite no noturno — REPROVADO em 24/09; **corrigido em 25/09** (janela desde o início do turno). Sem teste automatizado de componente.
- Duplo clique e reenvio — não há proteção no banco (sem unique em `administracao`); o botão desabilita durante o envio. **REPROVADO** como proteção (CLI-11), mantido porque "registrar de novo" é o fluxo documentado de correção (`03-decisoes-pendentes.md`).
- Prescrição sem quantidade — REPROVADO; **corrigido** (quantidade obrigatória por período; erro exibido).
- Edição de prescrição não atômica — **REPROVADO, não corrigido** (CLI-01).
- Autoria e horários confiáveis — autoria: **APROVADO** (servidor). Horário: `administrado_em` é `default now()` no banco (confiável). Relógio do aparelho errado não afeta o servidor; afeta só o "período" escolhido pela cuidadora.

## Intercorrências, eliminações e pendências

- Registro com foto; falha do upload — REPROVADO (a ocorrência salva sem foto e sem aviso; UX-07, não corrigido).
- "Escalado ao médico" — **grava um status e entra na fila do médico; NÃO é uma notificação entregue** (não há push, e-mail nem SMS). Documentado como tal.
- Alerta silenciado reaparece se a condição persistir — REPROVADO parcial: marca "reincidente" para sempre a partir de qualquer silenciamento antigo (CLI-08, não corrigido).
- Pendências somem à meia-noite sem resolução — **REPROVADO, não corrigido** (CLI-03).

## Escalas e plantões

- Turno noturno atravessando a meia-noite — criação: APROVADO por código; colisão: **REPROVADO** (compara timestamps como texto; ESC-01).
- Check-in para outra pessoa — esperado: negado. **APROVADO** por RLS (`turnos_upd_proprio`: só o próprio `profissional_id`); coordenação e gestão editam qualquer turno.
- Reabrir turno encerrado / novo check-in apaga check-out — **REPROVADO** (ESC-02).
- Localização negada ou imprecisa — a tela exige localização em "Minha escala", mas o botão do checklist grava sem ela (ESC-02). Geolocalização do navegador NÃO é prova de presença: documentado.
- Ajustes manuais rastreáveis — o ajuste de ponto pela coordenação não grava quem ajustou nem o valor anterior. **REPROVADO** (ESC-03).

## Compromissos e painéis

- Totais dos painéis coerentes com a origem — **REPROVADO** em vários pontos (FIN-01 a FIN-04): faturamento por ativos de hoje (corrigido em 25/09 com o roster do mês), inadimplência com duas regras, ocupação por suítes, alertas críticos históricos.
- Erro de consulta exibindo "sem pendências" — nos hooks da Obra e do caixa: corrigido (erro propagado). Nos painéis do Master e da Administração: alguns erros ainda são ignorados (UX-06).

## Tempo, falhas e concorrência

- Virada de dia, mês e ano; bissexto; fuso — **APROVADO** nos testes unitários novos (`src/lib/datas.test.ts`) e nos existentes (`hojeISO`, `dataISO`, `intervaloMeses`, `formatarDataBR`). O vitest agora fixa `TZ=America/Sao_Paulo`; com outro fuso um teste do módulo Obra falhava (auditor de qualidade) — o app supõe o aparelho em São Paulo.
- Relógio do dispositivo errado — não afeta carimbos do servidor (`now()`); afeta o "período" e "hoje" no cliente. **NÃO EXECUTADO** em navegador.
- Internet interrompida antes, durante e depois da gravação — **NÃO EXECUTADO**. Por código: erro exibido pelo tratador global; sem fila offline; risco de duplicidade ao repetir em fluxos não idempotentes (CLI-01, CLI-06).
- Timeout após o servidor confirmar — **NÃO EXECUTADO**; sem idempotência em inserts comuns.
- Duas abas ou dois usuários no mesmo registro — RPCs da Obra e dispensação têm trava (`advisory lock`); prescrição, dieta, modelo de rotina e NF não têm. **REPROVADO** por análise (CLI-01, CLI-06, OBR-03).
- Falha do Supabase / resposta vazia — hooks da Obra e caixa propagam erro; sincronização do caixa só roda com todas as fontes com sucesso. **APROVADO** por código e testes unitários da sincronização.
- Atualização de página e navegação direta — **APROVADO** (crawler navega direto em todas as rotas).

## Interface (crawler, 25/09, após as correções)

165 rotas em 16 perfis: 0 erros de página, 0 telas de erro, 0 telas em construção, 0 estouros horizontais a 400 px, 0 textos suspeitos ("undefined", "NaN", "Invalid Date"), 2 avisos de console cosméticos (chave repetida na lista do painel da Farmácia; `<div>` dentro de `<p>` no plano de cuidados da família). Navegação por teclado, foco em modais e rótulos de campos: **REPROVADO** por análise (UX-01, UX-02), não corrigido.
