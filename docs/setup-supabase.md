# Configurar o Supabase (Marco 2)

Passo a passo para ligar o back-end. Sem estes passos o app roda em **modo demonstração**:
as telas abrem, mas nada é salvo e não há login.

> Faça tudo pelo seu navegador, com a sua conta. Nenhuma chave secreta vai para o código:
> só a URL e a chave **anon/publishable** entram no `.env.local`.

## 1. Criar o projeto

1. Em <https://supabase.com/dashboard>, **New project**.
2. Nome `central-de-estudos`, região **South America (São Paulo)**, plano Free.
3. Guarde a senha do banco num gerenciador de senhas.

## 2. Rodar o schema

Escolha **um** dos caminhos:

- **SQL Editor (mais simples):** abra *SQL Editor → New query*, cole todo o conteúdo de
  [`supabase/migrations/20261027000000_schema_inicial.sql`](../supabase/migrations/20261027000000_schema_inicial.sql) e clique em *Run*.
- **CLI:** na pasta do projeto:
  ```bash
  npx supabase login
  npx supabase link --project-ref SEU_PROJECT_REF
  npx supabase db push
  ```

Confira em *Table Editor* se as tabelas (`perfis`, `cursos`, `materiais`…) aparecem com o cadeado de **RLS ativo**.

## 3. URLs de redirecionamento

*Authentication → URL Configuration*:

- **Site URL:** `http://localhost:5173` (troque pela URL do Cloudflare Pages no deploy).
- **Redirect URLs:** adicione `http://localhost:5173/**` (e depois `https://SEU-SITE.pages.dev/**`).

Sem isso, os links de confirmação, de recuperação de senha e o retorno do Google/Microsoft falham.

## 4. Login por e-mail

*Authentication → Providers → Email*: deixe ativo e com **Confirm email** ligado.

O SMTP padrão do Supabase só envia poucos e-mails por hora (bom para testar). Para usar o **Resend**:

1. Crie a conta em <https://resend.com> e gere uma **API key**.
2. Para enviar para qualquer pessoa é preciso **verificar um domínio** no Resend. Sem domínio, o Resend só entrega
   para o seu próprio e-mail (suficiente para desenvolvimento).
3. No Supabase, *Authentication → Emails → SMTP Settings*: host `smtp.resend.com`, porta `465`,
   usuário `resend`, senha = a API key, remetente `nao-responda@SEU-DOMINIO`.
4. Opcional: traduza os modelos em *Authentication → Emails → Templates* (Confirm signup, Reset password).

## 5. Google

1. Em <https://console.cloud.google.com>, crie um projeto e configure a **tela de consentimento OAuth** (tipo Externo).
2. *Credenciais → Criar credenciais → ID do cliente OAuth → Aplicativo da Web*.
3. **URI de redirecionamento autorizado:** `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`.
4. Copie *Client ID* e *Client secret* para *Supabase → Authentication → Providers → Google* e ative.

## 6. Microsoft

1. Em <https://portal.azure.com>, *Microsoft Entra ID → Registros de aplicativo → Novo registro*.
2. **Tipos de conta:** “Contas em qualquer diretório organizacional e contas pessoais da Microsoft”
   (assim funcionam e-mails da Fatec/institucionais e contas Outlook/Hotmail).
3. **URI de redirecionamento (Web):** `https://SEU_PROJECT_REF.supabase.co/auth/v1/callback`.
4. *Certificados e segredos → Novo segredo do cliente*: copie o **Valor** (aparece uma vez só).
5. Em *Supabase → Authentication → Providers → Azure*: *Application (client) ID*, o segredo, e deixe
   *Azure Tenant URL* em branco (usa `common`). Ative.

## 7. Variáveis do front-end

*Project Settings → API* (ou *API Keys*): copie a **Project URL** e a chave **anon / publishable**.

```bash
cp .env.example .env.local
```

Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e reinicie o `npm run dev`.
**Nunca** use a chave `service_role` / `secret` no front-end.

## 8. Keep-alive (GitHub Actions)

No GitHub, *Settings → Secrets and variables → Actions*, crie `SUPABASE_URL` e `SUPABASE_ANON_KEY`
(mesmos valores do passo 7). Rode o workflow **keep-alive** uma vez pela aba *Actions* para conferir.

## 9. Teste rápido

- [ ] `/criar-conta` com e-mail → chega o e-mail de confirmação → link abre o app em `/boas-vindas`.
- [ ] Assistente: curso → semestre → matérias → cai no Início com “Bom dia, <nome>”.
- [ ] *Table Editor*: o curso, o semestre (`atual = true`) e as matérias aparecem com o seu `usuario_id`.
- [ ] Menu do usuário (rodapé da sidebar) → **Sair** → volta para `/entrar`.
- [ ] Entrar com senha errada mostra “E-mail ou senha incorretos.” abaixo do campo.
- [ ] `/recuperar-senha` → e-mail → link abre `/redefinir-senha` → nova senha funciona.
- [ ] Google e Microsoft levam ao assistente na primeira vez e ao Início nas seguintes.
