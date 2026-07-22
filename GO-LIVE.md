# GO-LIVE — checklist de operação (app.blueseniorliving.com.br)

O código já está pronto; os itens abaixo são CONFIGURAÇÕES no painel do
Supabase (e Cloudflare, se ligar o CAPTCHA). Sem SQL para rodar.

## 1. Recuperação de senha por e-mail (obrigatório)

No painel do Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://app.blueseniorliving.com.br`
- **Redirect URLs** (adicionar): `https://app.blueseniorliving.com.br/redefinir-senha`

No painel → **Authentication → Emails (Templates)**:
- Template **Reset password**: traduzir para PT-BR (sugestão de corpo):
  "Olá! Recebemos um pedido para redefinir a sua senha do portal Blue Senior
  Living. Clique no link para criar uma nova senha: {{ .ConfirmationURL }}.
  Se você não pediu isso, ignore este e-mail."

**SMTP próprio (fortemente recomendado antes de operar):** o e-mail embutido
do Supabase tem limite baixíssimo (poucas mensagens/hora) e cai em spam.
Em **Project Settings → Auth → SMTP Settings**, configure um provedor
(Resend, Brevo, SES…) com remetente `nao-responda@blueseniorliving.com.br`
(exige verificar o domínio no provedor — SPF/DKIM no DNS, igual fizemos com
o CNAME). Depois, em **Authentication → Rate Limits**, ajuste o limite de
e-mails/hora para um valor operacional (ex.: 30/h).

Fluxo pronto no app: "Esqueci minha senha" → e-mail com link →
`/redefinir-senha` → nova senha (mín. 8) → entra logado. A resposta do
modal é sempre a mesma, exista ou não o e-mail (anti-enumeração).

## 2. Proteção contra tentativas de invasão

Já ativo no app (sem configuração):
- **Bloqueio progressivo por e-mail**: 5 falhas → 30 s; dobra a cada nova
  falha (teto 15 min), com contador no botão. Persiste a refresh.
- **Mensagem genérica** ("E-mail ou senha inválidos") — não revela contas.
- **Rate limit do Supabase** (servidor): o endpoint de login é limitado por
  IP por padrão; confira em **Authentication → Rate Limits**.

**CAPTCHA (recomendado ligar — o app já está preparado):**
1. Crie um site no Cloudflare Turnstile (grátis) para
   `app.blueseniorliving.com.br` → anote **Site Key** e **Secret Key**.
2. Supabase → **Authentication → Attack Protection → Enable Captcha
   protection** → provider *Turnstile* → cole a **Secret Key**.
3. Render (serviço do app) → **Environment** → adicione
   `VITE_TURNSTILE_SITE_KEY=<Site Key>` → *Manual Deploy*.
Com a variável presente, o widget aparece no login e no "esqueci minha
senha"; sem ela, nada muda. Com a proteção ligada no Supabase, o servidor
passa a EXIGIR o token — robôs que chamam a API direto são barrados.

## 3. Senhas (higiene antes de operar)

- **Trocar TODAS as senhas padrão "blue"** (seed de teste, migration 0030):
  em Equipe e Acessos → Editar usuário → "Senha de acesso" → Gerar →
  Definir. Ou orientar cada pessoa a usar "Esqueci minha senha".
- Supabase → **Authentication → Providers → Email**: subir **Minimum
  password length para 8** (o app já exige 8 nas telas).
- O botão interno "Resetar para 'blue'" é ferramenta de transição — depois
  do go-live, prefira o fluxo por e-mail.

## 4. Teste de aceite (5 min)

1. `https://app.blueseniorliving.com.br` → "Esqueci minha senha" com um
   e-mail real cadastrado → chegou? (spam?) → link abre `/redefinir-senha`
   → nova senha → entrou logado.
2. Errar a senha 5× → botão trava com contador ("Aguarde 30s").
3. (Se CAPTCHA ligado) widget aparece e login sem ele é recusado.
4. Logar como a construtora → só o portal dela.
