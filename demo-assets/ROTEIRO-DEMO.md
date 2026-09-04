# Roteiro da demo — Blue Senior Living para a RPLK

**Duração alvo:** 10 a 12 minutos · **Protagonista:** Maria Helena Andrade, 79 anos · **Decisora:** Fernanda, filha.

A tese da demo em uma frase: *quem opera pensa o prédio inteiro, do lead da filha ao indicador de quedas.*

---

## PRÉ-VOO (faça 15 minutos antes)

**1. Carregar o cenário.**
Supabase → SQL Editor → cole `demo-assets/seed/DEMO_SEED.sql` inteiro → Run.
Rode **no dia da reunião**: as datas são relativas ao dia em que o seed roda, então tudo aparece como "de hoje".

**2. Conferir que carregou.** No fim da execução o Supabase mostra:
`DEMO carregada: 12 moradores, 14 usuários, 261 evoluções, 174 turnos.`
Se aparecer outro número, rode de novo (é idempotente, não duplica).

**3. Entrar no app.**
Usuário `demo.diretor@demo.local` · senha `blue`. Esse é o **Master** — dele você alcança tudo, inclusive a visão dos outros perfis pelo Camaleão.

**4. Preparar a tela.**
- Zoom do navegador em **100%** (Ctrl+0). Se o projetor for pequeno, 110%.
- Janela **maximizada**, modo tela cheia (F11) — sem barra de endereço.
- Fechar: e-mail, WhatsApp, Slack, qualquer notificação. Modo Não Perturbe ligado.
- Uma única aba aberta. Segunda janela com a pasta `demo-assets/screenshots/` **minimizada**, para o fallback.

**5. Aquecer as telas.** Abra uma vez, antes da reunião, as seis paradas abaixo. Elas ficam em cache e carregam instantâneas na hora H.

**Se uma tela falhar ao vivo:** não tente consertar. Diga "vou te mostrar por aqui" e abra a captura correspondente da pasta `screenshots/`. O índice de qual imagem serve para qual parada está em `screenshots/INDEX.md`.

**Depois da reunião:** Supabase → SQL Editor → `demo-assets/seed/DEMO_LIMPEZA.sql` → Run. Remove os 12 moradores, a equipe e os logins da demo. Não toca em mais nada.

---

## PARADA 1 — CRM: a decisora é a filha

**Caminho:** menu **Comercial → CRM** (`/app/master/crm`) → abrir o card **Maria Helena Andrade**.

**Na tela:** o funil com as oportunidades, e dentro do card o histórico completo: ligação da Fernanda por indicação, visita agendada, visita realizada, proposta, contrato. Origem "Indicação de família". Mais dois leads ativos no funil.

**Aponte (uma frase):** "Repare que o lead não é o idoso: é a filha. Cinco meses entre o primeiro telefonema e o contrato — e cada conversa está registrada aqui."

**Transição:** "A Maria Helena entrou. A partir daqui, tudo o que acontece com ela vira registro."

---

## PARADA 2 — Admissão: é aqui que senior living vira ILPI, ou não

**Caminho:** menu **Operacional → Visão do hóspede (360°)** (`/app/master/hospede`) → selecionar **Maria Helena Andrade**.

**Na tela:** a ficha inteira em uma página. Role até **Última avaliação IVCF**: a avaliação geriátrica classificou como **Grau I** na admissão. O bloco de identificação mostra grau contratual e grau atual lado a lado.

**Aponte:** "Isso é o IVCF-20, o instrumento que define o grau de dependência. É ele que separa um residencial de uma ILPI — e é ele que define o preço."

**Opcional (se sobrar tempo):** Camaleão → Médico → **Testes cognitivos** mostra o MEEM da Maria Helena: 28 de 30, dentro da normalidade para 16 anos de escolaridade.

**Transição:** "Classificada, ela ganha um plano. E o plano vira rotina de quem trabalha."

---

## PARADA 3 — Operação rastreável, que não depende de pessoa

**Caminho:** na mesma Visão 360, role para **Plano de cuidado ativo** e depois para **Últimas evoluções**.
Em seguida: **Camaleão → Coordenação → Cobertura Assistencial** (`/app/coordenacao/cobertura`).

**Na tela:** o plano com tarefa, horário e quem executa. As evoluções de enfermagem assinadas e datadas. Depois, a escala do mês com os turnos cobertos, diurno e noturno.

**Aponte:** "O plano não é um documento numa gaveta: ele vira o checklist do turno. E a escala mostra a cobertura dia a dia — se faltar gente, aparece aqui antes de virar problema."

**Transição:** "Agora o que todo mundo teme que aconteça. E aconteceu."

---

## PARADA 4 — Intercorrência e reavaliação: continuidade, não expulsão

**Caminho:** volte ao Master (botão **Voltar ao Master**) → Visão 360 da Maria Helena → bloco **Intercorrências recentes** e, logo acima, **Última avaliação IVCF**.

**Na tela:** a queda no banheiro de três semanas atrás — sem fratura, com escoriação, avaliada pela enfermeira RT e pelo médico no mesmo dia. E a reavaliação de duas semanas atrás: **Grau I virou Grau II**, com os domínios alterados listados.

**Aponte:** "Ela caiu, foi reavaliada e mudou de grau. Não foi convidada a sair: o plano cresceu junto com a necessidade dela. É isso que segura ocupação no prédio inteiro ao longo de dez anos."

**Transição:** "E a filha, que mora longe, ficou sabendo de tudo. Vou te mostrar pelo olho dela."

---

## PARADA 5 — Portal da família: o que sustenta ticket e ocupação

**Caminho:** **Camaleão → Fernanda Andrade Ribeiro (família)** → cai em `/app/familia` → depois abra **Plano de cuidados** no menu.

**Na tela:** o comunicado da queda, escrito no mesmo dia, com hora e nome de quem avaliou. O recado do plano atualizado. E o plano de cuidados que ela consegue ler sozinha, sem ligar para ninguém.

**Aponte:** "Ela soube da queda da mãe em 45 minutos, com detalhe clínico, sem precisar telefonar. É por isso que a família aceita o reajuste quando o grau muda."

**Transição:** "Isso do lado da família. Do lado do risco, tem uma camada que a construtora normalmente não enxerga."

---

## PARADA 6 — O risco regulatório que já está mapeado

**Caminho:** **Voltar ao Master** → **Vigilância Sanitária → Documentação Institucional** (`/app/master/documentos-institucionais`) → depois **Indicadores RDC 502** (`/app/master/vigilancia-indicadores`).

**Na tela:** a documentação com a maioria em dia — e o **AVCB vencido, em vermelho**, com o plano de ação na observação. Depois, os indicadores obrigatórios calculados automaticamente, com a queda da Maria Helena aparecendo na série.

**Aponte:** "Não está tudo perfeito, e é esse o ponto: o AVCB venceu e o app está gritando. O risco é rastreado, não escondido. Esses indicadores vão para a Vigilância todo ano — calculados, não digitados."

**Fechamento:** "Do telefonema da filha até o indicador que vai para a Vigilância, é o mesmo sistema. É isso que a gente leva para dentro do empreendimento de vocês."

---

## FORA DO PERCURSO (só cite, não abra)

Se perguntarem sobre o resto da operação: **Nutrição** (cardápios por restrição, dietas, controle de peso e desperdício), **Lavanderia** (enxoval com estoque mínimo e alerta de reposição), **Manutenção** (chamados com urgência e prazo — inclusive o da barra de apoio aberto depois da queda) e **Direção** (painel estratégico, NPS e financeiro). Estão nas capturas 13 e 14, se quiser mostrar no deck.

---

## COLA RÁPIDA

| # | Caminho | Frase-chave |
|---|---|---|
| 1 | Comercial → CRM → Maria Helena | O lead é a filha |
| 2 | Operacional → Visão 360 → IVCF | O IVCF define grau e preço |
| 3 | Visão 360 (plano/evoluções) + Camaleão Coordenação → Cobertura | O plano vira checklist de turno |
| 4 | Visão 360 → Intercorrências + IVCF | Mudou de grau, não foi expulsa |
| 5 | Camaleão Família → Início + Plano de cuidados | Ela soube em 45 minutos |
| 6 | Vigilância → Documentação + Indicadores | O AVCB venceu e o app está gritando |

**Logins da demo** (todos com senha `blue`):
`demo.diretor@demo.local` (Master, use este) · `demo.fernanda@demo.local` (família) · `demo.rosana@demo.local` (enfermeira RT) · `demo.marta@demo.local` (coordenação) · `demo.medico@demo.local` (médico).
