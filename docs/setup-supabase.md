# Ligar o back-end (Fases 2 a 4)

Passo a passo do que **só você** pode fazer (contas, chaves, painel do Supabase). O código já está pronto.
Sem estes passos o app roda em **modo demonstração**: tudo funciona com dados de exemplo na memória, mas nada é salvo.

> Nenhuma chave secreta vai para o código. No `.env.local` entram só a URL e a chave **anon/publishable**.
> As chaves do R2 e a service role ficam como segredos das Edge Functions.

---

## 1. Zerar o banco antigo

O schema novo substitui o do app pessoal antigo (cursos/semestres/documentos).

1. Supabase → seu projeto → **Database → Tables**. Se aparecerem tabelas antigas (`semestres`, `documentos`, `plano_usuario`…), abra **SQL Editor → New query** e rode:
   ```sql
   drop schema public cascade;
   create schema public;
   grant usage on schema public to postgres, anon, authenticated, service_role;
   grant all on schema public to postgres, service_role;
   alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
   alter default privileges in schema public grant all on functions to postgres, anon, authenticated, service_role;
   alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;
   drop trigger if exists central_criar_perfil on auth.users;
   ```
2. **Authentication → Users**: apague os usuários de teste antigos (eles não têm perfil no schema novo).

## 2. Rodar o schema novo e o seed

No **SQL Editor**, rode nesta ordem (cole o arquivo inteiro e clique em *Run*):

1. `supabase/migrations/20261027000000_schema_inicial.sql`
2. `supabase/seed.sql` (Fatec Indaiatuba, ADS, turmas e horários do piloto, calendário acadêmico 2026/2)

Confira em **Table Editor** se `tenants`, `turmas`, `eventos`, `propostas`, `votos` aparecem com o cadeado de RLS.

> O seed tem as disciplinas e horários do **3º semestre noite** marcados como PROVISÓRIOS. Antes do piloto,
> ajuste nomes, professores, salas e horários pela grade do site (ou deixe para o Archie na Fase 5).

## 3. Código de 6 dígitos no e-mail

1. **Authentication → Sign In / Providers → Email**: deixe **Enable Email** e **Confirm email** ligados. Desligue Google e Microsoft (não são mais usados).
2. **Authentication → Email Templates**, nos modelos **Confirm signup** e **Magic Link**, troque o corpo por algo como:
   ```html
   <h2>Seu código da Central de Estudos</h2>
   <p>Digite este código no app: <b style="font-size:24px;letter-spacing:4px">{{ .Token }}</b></p>
   <p>Ele vale por 10 minutos. Se não foi você, ignore este e-mail.</p>
   ```
   (O importante é ter `{{ .Token }}`; sem ele o Supabase manda só um link.)
3. **Authentication → Sign In / Providers → Email → Email OTP Expiration**: `600` segundos (10 min). **Email OTP Length**: `6`.
4. **SMTP (Resend)**: o e-mail padrão do Supabase só manda poucos e-mails por hora. Em <https://resend.com> crie a conta, verifique o seu domínio (SPF/DKIM) e em **Project Settings → Authentication → SMTP Settings** preencha host `smtp.resend.com`, porta `465`, usuário `resend`, senha = API key do Resend, remetente `nao-responda@SEU-DOMINIO`.
5. Teste com o seu `@aluno.cps.sp.gov.br`: o código costuma cair no **lixo eletrônico** do Outlook da Fatec na primeira vez. Marque como "não é lixo".

## 4. URLs

**Authentication → URL Configuration**:

- **Site URL:** `http://localhost:5173` (depois a URL do Cloudflare Pages ou do domínio).
- **Redirect URLs:** `http://localhost:5173/**` e, no deploy, `https://SEU-DOMINIO/**`.

## 5. `.env.local`

Na raiz do projeto, copie `.env.example` para `.env.local` e preencha com **Project Settings → API**:

```
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-anon-key
```

Rode `npm install` e `npm run dev`. Crie a sua conta pelo app (com o e-mail da Fatec).

## 6. Virar admin

Depois de criar a sua conta, no SQL Editor:

```sql
update public.perfis set papel = 'admin' where email = 'SEU.EMAIL@aluno.cps.sp.gov.br';
```

Recarregue o app: aparece **Administração** na barra lateral (contas, turmas, fontes, curadoria).

## 7. Arquivos no Cloudflare R2

1. Cloudflare → **R2 → Create bucket** `central-de-estudos` (região automática).
2. **R2 → Manage API tokens → Create API token** com permissão *Object Read & Write* só nesse bucket. Guarde *Access Key ID* e *Secret*.
3. No bucket → **Settings → CORS policy**:
   ```json
   [{ "AllowedOrigins": ["http://localhost:5173", "https://SEU-DOMINIO"], "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
   ```
4. Publique as Edge Functions (precisa do CLI uma vez):
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npx supabase secrets set R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=central-de-estudos
   npx supabase functions deploy r2-upload-url
   npx supabase functions deploy r2-download-url
   npx supabase functions deploy agenda-ics --no-verify-jwt
   ```
   (`SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` já existem dentro das funções.)

## 8. Expirar confirmações em 72 h (opcional agora)

**Database → Extensions**: ligue `pg_cron`. No SQL Editor:

```sql
select cron.schedule('expirar-propostas', '*/15 * * * *', $$select public.expirar_propostas()$$);
```

(O arquivo `20261103000001_archie.sql` faz isso junto com a parte do Archie. Para ligar o Archie — extensões, as duas migrações dele, Ollama e o worker — siga `docs/archie.md`.)

## 9. Keep-alive

GitHub → repositório → **Settings → Secrets and variables → Actions**: crie `SUPABASE_URL` e `SUPABASE_ANON_KEY`. O workflow `keep-alive` pinga o banco a cada 3 dias para o plano Free não pausar.

---

## Checklist de teste

- [ ] Criar conta com e-mail que **não** é da Fatec → mensagem pedindo o e-mail institucional.
- [ ] Criar conta com `@aluno.cps.sp.gov.br` → código chega → entra no primeiro acesso.
- [ ] Primeiro acesso: ADS → 3º → Noite → turmas marcadas → abre a agenda com as aulas.
- [ ] Agenda: criar evento por frase, arrastar, redimensionar, apagar; ligar/desligar camadas.
- [ ] Clicar numa aula passada → Fui/Faltei → aparece em Notas e faltas.
- [ ] Turma: mandar mensagem, reagir, abrir "ver quem"; criar uma confirmação e votar com 2 contas.
- [ ] Admin: aprovar um professor, ligar o professor a uma turma, mudar vagas da turma.
- [ ] Configurações → Agenda → copiar o link .ics e assinar no Outlook (depois do passo 7).
