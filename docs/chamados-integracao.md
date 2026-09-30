# Chamados de hóspede — integração com o aparelho

Documento para o fornecedor do sistema de chamada (botão e corda por suíte).
O app já está pronto. Falta só a central do fabricante mandar os eventos.

## Como funciona no app

- **Botão** gera um **chamado** e acende a suíte em **amarelo** no mapa.
- **Corda** gera uma **emergência** e acende a suíte em **vermelho**, pulsando.
- Um toque novo na mesma suíte soma ao chamado aberto. Uma emergência nunca é rebaixada por um chamado.
- O alerta **não apaga pelo painel**. Ele só apaga quando alguém comprova presença no quarto:
  - encostando o tablet da ronda na **etiqueta NFC da porta** da suíte; ou
  - apertando o **botão de presença** do próprio aparelho, se o modelo tiver.
- A Coordenação ou o Master podem encerrar sem presença só em caso de defeito, com justificativa registrada.
- O horário oficial é sempre o do servidor. O horário do aparelho é guardado só como informação.

## Cadastro no app

Em **Tags, tablets e chamados**, com perfil Master ou Coordenação:

1. **Central de chamados**: cadastre a central e copie o código gerado. Ele aparece uma única vez.
2. **Botões e cordas das suítes**: vincule o código de cada aparelho à suíte e ao tipo (botão, corda ou botão de presença).

## Contrato da central

```
POST https://<projeto>.supabase.co/functions/v1/chamado-evento
Content-Type: application/json
x-central-token: <código gerado no cadastro da central>
```

Acionamento (um evento ou uma lista de até 100):

```json
{ "evento_id": "id-único-do-evento", "dispositivo": "BTN-5106", "tipo": "acionamento", "ocorrido_em": "2026-09-30T02:10:00Z" }
```

Sinal de vida, a cada 1 minuto. Sem ele por 3 minutos, o painel avisa "sem sinal da central":

```json
{ "tipo": "sinal" }
```

Resposta: `{ "ok": true, "resultado": "acionado" | "atendido_presenca" | "presenca_sem_chamado" | "duplicado" | "sinal" | "dispositivo_desconhecido" | "dispositivo_inativo" | "central_invalida" }`.

- `evento_id` deve ser único por evento. Reenviar o mesmo id não gera um novo chamado (`duplicado`).
- `dispositivo` é o código cadastrado no app para aquele botão, corda ou botão de presença.
- Se a central só souber fazer requisição sem cabeçalho próprio, é possível adaptar. Nesse caso, fale com a equipe do app antes.

## Publicação da função

No Supabase, vá em **Edge Functions**, crie uma função chamada `chamado-evento` e use o arquivo `supabase/functions/chamado-evento/index.ts`. Desligue a verificação de JWT nessa função: quem autentica é o código da central. Ela não precisa de nenhum secret.

## Pendências de campo

- O mapa do Módulo 5 é esquemático, montado a partir dos prints: 19 suítes no 1º andar (5101–5119) e 20 no 2º (5201–5220). Confirme em campo a sequência das portas.
- Cada suíte foi cadastrada com um leito, o A. Se alguma for dupla, o leito B entra automaticamente quando um hóspede for registrado como "52xxB".
