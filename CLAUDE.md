# Central de Estudos — Briefing do projeto (para Claude Code)

> Este arquivo é o contexto-mestre do projeto. Leia-o inteiro antes de codar.
> Ele unifica os dois fluxos de trabalho: o **projeto/back-end** e o **frontend (identidade Foco)**.
> Especificação visual detalhada: [`docs/design/identidade-foco-telas-desktop.md`](docs/design/identidade-foco-telas-desktop.md).

---

## 0. Antes de tudo (estado do repositório)

- **Repo:** https://github.com/tsaistrinta/central-de-estudos (público, branch `main`).
- **Local:** `C:\dev\central-de-estudos` (já fora do OneDrive).
- **Importante:** a fundação Foco (seção 3) está em disco, com build e lint passando, mas pode **ainda não ter sido commitada**. Confirme `git status` e **commite/push** antes de evoluir.
- **Referências de design** ficam em `docs/design/`: o `.md` da identidade Foco (versionado) e o zip com os 39 PNGs + `foco-telas.html` (fora do git, ver `.gitignore`).

---

## 1. O que é o projeto

App web **pessoal** (com login, dados privados por usuário) para um estudante de Análise e Desenvolvimento de Sistemas (FATEC) centralizar e reencontrar todo o material de estudo. Hierarquia: **Curso → Semestre → Matéria → Material**.

Nasceu como protótipo no **Base44** (no-code) e está sendo reconstruído com stack própria, open-source e de custo zero no lançamento, com plano de virar SaaS (planos de armazenamento pagos). Interface **toda em português do Brasil**, tema **claro**, responsiva. Visual de referência: **identidade Foco** (39 telas desktop 1440×900, seção 2.1).

### Funcionalidades (escopo do produto)
- **Acesso:** entrar, criar conta (aceite LGPD obrigatório, medidor de força da senha), recuperar senha, **assistente de primeiro acesso** (Curso → Semestre → Matérias; "Pular" leva ao Início vazio).
- **Início:** saudação por horário (Bom dia/Boa tarde/Boa noite), card "N materiais esperando revisão" (some quando está tudo revisado), próximo prazo, % do semestre revisado, até 4 próximos prazos, "Continuar estudando", progresso por matéria.
- **Busca global (Ctrl/Cmd+K):** resultados agrupados por tipo, navegação por teclado, full-text em português.
- **Cursos / Curso / Semestre / Matéria / Semestres:** cards e tabelas com contagens, % revisado e próximo prazo; semestre marcado como **"Atual"** alimenta a sidebar; matéria tem abas Materiais / Documentos / Prazos.
- **Materiais** em 4 tipos: `arquivo` (upload PDF/slides/imagens), `link`, `anotacao`, `codigo` (editor com syntax highlighting). Visões **Lista** (padrão, ações em lote), **Grade**, **Por matéria** e **Quadro** (arrastar muda o status de revisão). Detalhe em drawer lateral (Esc fecha).
- **Documentos conectados** (estilo Obsidian): Tiptap, **wikilinks `[[ ]]`** com autocomplete, backlinks e links de saída, salvamento automático, **grafo** interativo, **importar** (.md/.txt/.docx viram documentos; PDF/imagens viram anexos).
- **Agenda** (mês e dia) com 11 tipos de evento, eventos concluídos riscados, lembrete por e-mail opcional, descrição aceita `[[ ]]` para documentos e materiais.
- **Biblioteca de código** (materiais tipo Código, busca no conteúdo, botão Copiar) e **Revisar agora** (fila "estudar depois", atalhos J/K, O, R).
- **Configurações:** Perfil, Conta e segurança (logins sociais, sessões), Plano e armazenamento (barra por tipo de arquivo), Privacidade e dados (exportar .zip, excluir conta). **Planos** (fase 2).
- **Favoritos e etiquetas** livres em materiais e documentos.
- **Estados** em toda a UI: vazio com ação principal, skeletons (sem spinner de página), erro de conexão com "Tentar de novo", confirmação de exclusão em cascata (digitar o nome), toasts com Desfazer (5 s), armazenamento cheio, 404.

---

## 2. Stack (decidida — não trocar sem bom motivo)

| Camada | Tecnologia |
|---|---|
| **Front-end** | React 19 + Vite + TypeScript, Tailwind CSS v4, React Router, lucide-react (ícones), **shadcn/ui**. Por marco: **Tiptap** (editor), **react-force-graph** (grafo), **FullCalendar** (agenda), **dnd-kit** (quadro), **CodeMirror ou Shiki** (código — escolher no Marco 4). |
| **Back-end** | **Supabase** (Auth + Postgres + Edge Functions). **Cloudflare R2** para arquivos (S3-compatível). **Resend** para e-mail. |
| **Banco** | PostgreSQL (Supabase), com **RLS** e busca full-text (`tsvector` em português). |
| **Infra** | **Cloudflare Pages** (hospedagem + CI/CD). GitHub Actions (keep-alive anti-pausa). |

**Regra de ouro da arquitetura:** os **arquivos ficam no R2 desde o dia 1** (10 GB grátis, egress $0). O front **nunca** recebe credenciais do R2 — upload/download via **URL pré-assinada** emitida por uma Edge Function, que checa a cota antes. Isso mantém a economia saudável quando virar SaaS.

### 2.1 Identidade visual — Foco (substitui a antiga violeta/rosa)

- **Fontes (Google Fonts):** **Geist** (tudo) e **Geist Mono** (datas, números, atalhos, código).
- **Uma única cor de ação:** azul `#2f4ad0` (hover `#2740b8`, fundo suave `#eaeefc`).
- **Tokens no padrão shadcn/ui** (`--background`, `--card`, `--foreground`, `--muted-foreground`, `--border`, `--primary`, `--accent`, `--ring`, `--success`, `--warning`, `--destructive`, `--highlight`…). Valores completos no doc de design. ⚠️ No shadcn, `accent` é o **fundo suave azul**, não uma cor de destaque.
- **8 cores de matéria/grupo** (nomes fixos): `cobalto`, `azul`, `petroleo`, `verde`, `mostarda`, `laranja`, `framboesa`, `roxo`. Usadas só como ponto de 8 px ou quadrado de 30–36 px com ícone branco — **sem faixas coloridas em cards**.
- **11 cores de tipo de evento** (`--evt-*`): pílula com texto na cor e fundo a 13%.
- **Status:** "Estudar depois" = aviso (`#b7700b`/`#fbf0dc`); "Já revisei" = sucesso (`#16834f`/`#e6f4ec`).
- **Layout:** **sidebar fixa de 224 px** (branca, borda direita): marca, busca (Ctrl K), Início, Cursos, Semestres, Materiais, Documentos, Agenda, Biblioteca, Revisar (contador), matérias do semestre atual, rodapé com usuário + engrenagem (Configurações). Conteúdo com padding 22×32 px sobre `--background`.
- **Medidas:** gap 14–16 px; raio cards 8, botões/inputs 6, modais 12, pílulas 999; controles 34–36 px de altura; ícones Lucide traço 1.75.
- **Marca:** logo de **chip/processador** (agora em azul, sem gradiente).

### 2.2 Rotas (alvo)

| Rota | Tela |
|---|---|
| `/entrar`, `/criar-conta`, `/recuperar-senha` | 01–03 (públicas, sem sidebar) |
| `/boas-vindas` | 04 · Primeiro acesso |
| `/` | 05 · Início |
| `/cursos`, `/cursos/:id` | 07 · Cursos, 08 · Curso |
| `/semestres`, `/semestres/:id` | 12 · Semestres, 09 · Semestre |
| `/materias/:id` | 11 · Matéria |
| `/materiais` (`?visao=lista\|grade\|materia\|quadro`) | 13–16 |
| `/documentos`, `/documentos/:id`, `/documentos/grafo`, `/documentos/importar` | 19–22 |
| `/agenda` (`?visao=mes\|dia`) | 23–24 (substitui `/calendario`) |
| `/biblioteca`, `/revisar` | 26, 27 |
| `/configuracoes/perfil\|conta\|plano\|privacidade` | 28–31 |
| `/planos` | 32 |
| `*` | 39 · Página não encontrada |

Busca global (06), novo material (17–18), nova matéria (10), novo evento (25) e confirmação de exclusão (36) são **modais/drawers**, não rotas.

---

## 3. Estado atual — Marco 1.5: fundação Foco (FEITO)

- **Deps instaladas:** react-router-dom, @supabase/supabase-js, lucide-react, tailwindcss, @tailwindcss/vite, clsx, tailwind-merge, class-variance-authority. `npm run build` e `npm run lint` passam.
- **shadcn/ui configurado à mão:** `components.json` (estilo new-york), alias `@/` em `tsconfig.app.json` e `vite.config.ts`, `cn()` em `src/lib/utils.ts`, `src/components/ui/button.tsx`. Novos primitivos: `npx shadcn@latest add <nome>`.
- `src/index.css` — tokens Foco em `:root` + `@theme inline` (classes `bg-primary`, `text-muted-foreground`, `bg-materia-cobalto`, `bg-evento-prova`, `rounded-md/lg/xl`…).
- `index.html` — Geist + Geist Mono. `public/favicon.svg` e `ChipLogo.tsx` — chip em azul.
- `src/components/` — `AppSidebar.tsx` (sidebar 224 px), `Layout.tsx`, `AuthLayout.tsx` (telas públicas, sem sidebar), `PageStub.tsx` (aceita o nº da tela de referência).
- `src/App.tsx` — todas as rotas da seção 2.2 (`/calendario` redireciona para `/agenda`); páginas stub em `src/pages` e `src/pages/auth`; `Configuracoes.tsx` com as 4 abas; `NaoEncontrada.tsx` (404).
- `src/pages/Dashboard.tsx` — esqueleto da tela 05 (saudação por horário, cards, painéis) com estados vazios.
- `src/api/entities.ts` — `list({ limite, pagina })` com ordenação padrão por tabela; `create` não envia `usuario_id` (vem do `default auth.uid()`) e dá erro claro sem login.
- `src/types/index.ts` — `Perfil`, `PlanoUsuario`, `CorMateria`, `Tier` e os campos novos da seção 6.
- keep-alive com `curl -fsS`; `LICENSE` (MIT); README reconciliado.

### Marco 2 — código pronto, falta ligar o Supabase
- `supabase/migrations/20261027000000_schema_inicial.sql` — schema da seção 6 com RLS, **FKs compostas `(pai_id, usuario_id)`** (impedem apontar para dados de outra conta), índices, triggers de `atualizado_em`/`editado_em`, trigger de cadastro (perfil + plano Free) e RPC `definir_semestre_atual`.
- `src/api/auth.ts` — login por e-mail, Google e Microsoft (`azure`), cadastro, recuperação/redefinição de senha, sair, perfil, mensagens de erro em PT-BR.
- `src/lib/auth.tsx` — `AuthProvider` + `useAuth()` (sessão, perfil, `configurado`). Sem `.env.local` → **modo demonstração**: rotas abertas, nada é salvo.
- `src/components/RotaProtegida.tsx` — `RotaProtegida` (exige login; manda para `/boas-vindas` até `onboarding_concluido`) e `RotaPublica`.
- Telas 01–04 reais (`src/pages/auth`), `/redefinir-senha`, `/termos` e `/privacidade` (texto preliminar). Layouts `AuthDividido` (01–02) e `AuthCartao` (03).
- Sidebar com menu do usuário (Configurações, Sair); Início com "Bom dia, <nome>".
- Guia: [`docs/setup-supabase.md`](docs/setup-supabase.md).

**Ainda NÃO existe:** projeto Supabase criado, dados reais na sidebar/Início, busca Ctrl K (o campo é só visual), CRUD das telas, testes.

---

## 4. Pendências imediatas

1. **Seguir `docs/setup-supabase.md`** (feito pelo usuário): criar o projeto, rodar a migration, configurar URLs, Resend, Google e Microsoft, preencher `.env.local` e os secrets do keep-alive.
2. Rodar o checklist de teste do guia e corrigir o que falhar.
3. Depois, **Marco 3** (seção 8).

---

## 5. Arquitetura

### Versão Free (lançamento)
```
Usuário (navegador/PWA)
  → App React (Vite) hospedado no Cloudflare Pages
      → Supabase: login (Google + Microsoft + e-mail) e dados (Postgres via API, RLS)
      → Edge Function "upload-url" → checa cota → URL pré-assinada do R2
      → (navegador envia/baixa o arquivo DIRETO do R2)
      → Supabase → Resend (cadastro, reset de senha, lembretes de evento)
  GitHub Actions → ping anti-pausa no Supabase a cada 3 dias
```

### Limites do Free (verificados 2026)
- Supabase Free: 500 MB Postgres, 5 GB tráfego API/mês, 50k logins, **pausa após 7 dias ocioso** (keep-alive resolve).
- Cloudflare R2 Free: **10 GB, egress $0**.
- Resend Free: 100 e-mails/dia (conta também os lembretes de evento).
- **Cota por usuário no Free: 200 MB** (limite por arquivo: 25 MB).

### Evolução paga (v2, não agora)
Mesma arquitetura + **Stripe** (assinaturas + "GB extra" por uso) → webhook atualiza `tier`/`cota_bytes` no Postgres. Supabase Pro (backup, sem pausa), Cloudflare Pages/Vercel Pro (uso comercial), Resend pago. Planos: Free 200 MB · Plus 5 GB · Pro 50 GB (preços em validação — tela 32). R2 pay-as-you-go ($0,015/GB, egress $0) → margem alta.

---

## 6. Modelo de dados (schema Postgres — criar em `supabase/migrations`)

Toda tabela tem `usuario_id default auth.uid()` para o RLS ser direto e o front não precisar enviar o campo. Ligar RLS em todas com a política "dono" (`usuario_id = auth.uid()`).

```sql
create table perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text, avatar_url text,
  preferencias jsonb not null default '{}',             -- interruptores da tela 28
  onboarding_concluido boolean not null default false,  -- assistente da tela 04
  criado_em timestamptz default now()
);
create table plano_usuario (
  usuario_id uuid primary key references auth.users on delete cascade,
  tier text not null default 'free' check (tier in ('free','plus','pro')),
  cota_bytes bigint not null default 209715200,        -- 200 MB
  limite_arquivo_bytes bigint not null default 26214400, -- 25 MB
  bytes_usados bigint not null default 0,
  stripe_customer_id text, atualizado_em timestamptz default now()
);
create table cursos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null, instituicao text, ordem int default 0
);
create table semestres (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  curso_id uuid not null references cursos on delete cascade,
  nome text not null, ordem int default 0,
  atual boolean not null default false                  -- aparece na sidebar
);
create unique index semestre_atual_unico on semestres (usuario_id) where atual;
create table materias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  semestre_id uuid not null references semestres on delete cascade,
  nome text not null, professor text,
  cor text not null check (cor in ('cobalto','azul','petroleo','verde','mostarda','laranja','framboesa','roxo'))
);
create table materiais (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  materia_id uuid not null references materias on delete cascade,
  tipo text not null check (tipo in ('arquivo','link','anotacao','codigo')),
  titulo text not null, descricao text, url text, conteudo text, linguagem text,
  arquivo_chave_r2 text, arquivo_tamanho bigint, arquivo_mime text,
  favorito boolean default false,
  status_revisao text default 'estudar_depois' check (status_revisao in ('estudar_depois','ja_revisei')),
  ultimo_acesso timestamptz,                            -- "Continuar estudando"
  criado_em timestamptz default now(), atualizado_em timestamptz default now(),
  busca tsvector generated always as (
    to_tsvector('portuguese', coalesce(titulo,'')||' '||coalesce(descricao,'')||' '||coalesce(conteudo,''))
  ) stored
);
create table grupos_documento (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null,
  cor text not null check (cor in ('cobalto','azul','petroleo','verde','mostarda','laranja','framboesa','roxo'))
);
create table documentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  materia_id uuid references materias on delete set null,
  grupo_id uuid references grupos_documento on delete set null,
  titulo text not null, conteudo_json jsonb, conteudo_texto text,
  favorito boolean default false, anexo_chave_r2 text,
  criado_em timestamptz default now(), editado_em timestamptz default now(),
  busca tsvector generated always as (
    to_tsvector('portuguese', coalesce(titulo,'')||' '||coalesce(conteudo_texto,''))
  ) stored
);
create table links_documentos (
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  origem_id uuid not null references documentos on delete cascade,
  destino_id uuid not null references documentos on delete cascade,
  primary key (origem_id, destino_id)
);
create table eventos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  materia_id uuid references materias on delete set null,
  titulo text not null, descricao text, data date not null, hora time,  -- sem hora = "Dia todo"
  tipo text not null check (tipo in ('prova','entrega','trabalho','apresentacao','aula',
    'reuniao','leitura','projeto','lembrete','data_especial','outro')),
  concluido boolean not null default false,             -- riscado na agenda
  lembrete_minutos int,                                 -- null = sem lembrete por e-mail
  lembrete_enviado_em timestamptz
);
create table referencias_evento (                       -- [[ ]] na descrição do evento
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  evento_id uuid not null references eventos on delete cascade,
  documento_id uuid references documentos on delete cascade,
  material_id uuid references materiais on delete cascade,
  check (num_nonnulls(documento_id, material_id) = 1)
);
create table etiquetas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null, unique (usuario_id, nome)
);
create table material_etiqueta (
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  material_id uuid references materiais on delete cascade,
  etiqueta_id uuid references etiquetas on delete cascade,
  primary key (material_id, etiqueta_id)
);
create table documento_etiqueta (
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  documento_id uuid references documentos on delete cascade,
  etiqueta_id uuid references etiquetas on delete cascade,
  primary key (documento_id, etiqueta_id)
);
create index on materiais using gin (busca);
create index on documentos using gin (busca);
-- + índice em usuario_id de cada tabela
-- RLS: alter table X enable row level security;
--      create policy "dono" on X for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
-- perfis: política por id = auth.uid(). plano_usuario: SELECT do dono; UPDATE só service role.
-- trigger after insert em auth.users → cria perfis + plano_usuario (free, 200 MB).
-- lembretes: pg_cron a cada 5 min chama Edge Function que envia via Resend e grava lembrete_enviado_em.
```

---

## 7. Decisões e padrões do projeto

- **Adaptador de dados** (`src/api/entities.ts`): toda tela acessa dados por ele (`list/create/update/remove`), nunca chamando o Supabase direto. Facilita testes e evolução. `usuario_id` vem do `default auth.uid()` do banco.
- **Upload (Edge Functions):** `upload-url` (checa `limite_arquivo_bytes` e `bytes_usados + tamanho ≤ cota_bytes`, gera PUT pré-assinado ~10 min, chaves `<usuario_id>/<material_id>/<arquivo>`), `confirmar-upload` (confere tamanho real, grava `arquivo_chave_r2`, soma em `bytes_usados`), `download-url` (GET pré-assinado só se a chave começa com o `usuario_id`). Segredos: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. **Nunca** no front. Recusa por cota → tela 38 (Armazenamento cheio). Upload com barra de progresso; "Salvar" só habilita ao terminar.
- **Editor de documentos:** **Tiptap** (não Quill). Nó customizado `wikilink` que guarda `{ documento_id, titulo }` (aponta por ID, exibe pelo título → renomear não quebra link). Autocomplete de `[[` com `@tiptap/suggestion`. Salvamento automático: gravar `conteudo_json`, extrair `conteudo_texto` e recalcular `links_documentos`.
- **Auth:** e-mail/senha (SMTP via Resend) + **Google** e **Microsoft** (Azure) OAuth. Apple fica fora no MVP (conta paga). Textos em PT-BR. Erro de credencial abaixo do campo de senha. Usuário sem curso → `/boas-vindas`.
- **Feedback de UI:** exclusões simples → toast com Desfazer; exclusões em cascata (curso, semestre, matéria) → modal que lista o que será apagado e pede para digitar o nome.
- **Atalhos:** Ctrl/Cmd+K (busca global); J/K, O, R na tela Revisar; Esc fecha drawers/modais.
- **Env:** `.env.local` (fora do git) com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- **Deploy:** Cloudflare Pages (build `npm run build`, saída `dist`, `public/_redirects` com `/* /index.html 200`). Variáveis `VITE_*` no painel.
- **LGPD:** aceite de termos obrigatório no cadastro, exportar dados (.zip com JSON + arquivos), excluir conta (banco + objetos no R2).

---

## 8. Roadmap (próximos marcos)

- **Marco 1.5 — Fundação Foco:** ✅ feito (seção 3).
- **Marco 2 — Supabase vivo:** 🟡 código pronto; falta o setup do guia. Criar projeto (região São Paulo), rodar o schema, RLS, trigger de cadastro, auth (Google + Microsoft + e-mail/Resend), `.env.local`, telas 01–04, rotas protegidas, menu do usuário/Sair.
- **Marco 3 — CRUD real:** Cursos → Curso → Semestre → Matéria → Materiais (telas 07–16) via adaptador; favoritos, etiquetas, status de revisão, ações em lote, estados (33–37).
- **Marco 4 — R2 + upload:** Edge Functions, URLs pré-assinadas, controle de cota (17, 30, 38), editor de código (18) e Biblioteca (26).
- **Marco 5 — Documentos:** Tiptap + wikilinks + backlinks + grafo + importar (19–22).
- **Marco 6 — Agenda** (23–25, lembretes), **Revisar** (27), **Início** com dados reais (05), **busca global** (06).
- **Marco 7 — polimento:** Configurações (28–31), responsivo/PWA, LGPD, keep-alive, deploy no Pages.
- **Futuro (v2):** Stripe + Planos (32); migrar dados do Base44 (~26 materiais, ~12 documentos — pode recadastrar na mão).

---

## 9. Como rodar
```bash
npm install
cp .env.example .env.local  # preencher VITE_SUPABASE_* quando o Supabase existir
npm run dev                 # http://localhost:5173
```

---

## 10. Convenções
- Código e UI em **português do Brasil**.
- TypeScript estrito; tipos em `src/types`.
- Componentes em `src/components` (primitivos do shadcn em `src/components/ui`), telas em `src/pages`, dados em `src/api`, libs/clients em `src/lib`.
- Commits curtos no padrão `feat:/fix:/chore:/docs:`.
- Tema sempre pelos tokens Foco (nada de cor literal solta); cor de matéria sempre pelo nome da paleta.
- Ao mudar algo visual, conferir a tela correspondente em `docs/design/`.
