# Central de Estudos — Briefing do projeto (para Claude Code)

> Contexto-mestre do projeto. Leia inteiro antes de codar.
> Documentação completa (14 seções): doc "Central de Estudos · Documentação do projeto" no claude.ai.
> Referência visual obrigatória: mockups 01–26 em `docs/design/central-fatec-telas.zip` (fora do git). **Fazer igual aos mockups.**

---

## 0. Estado do repositório

- **Repo:** https://github.com/tsaistrinta/central-de-estudos (público, `main`). **Local:** `C:\dev\central-de-estudos`.
- **Nova direção (03/11/2026):** o app pessoal antigo (cursos/semestres, documentos conectados, grafo, biblioteca de código, planos pagos) foi substituído pela Central para a Fatec com a IA **Yara**. O app fica na raiz do repo (sem monorepo); o worker da IA entra em `workers/yara/` na Fase 5.
- **Fase 0 e Fase 1: feitas** (seção 8). Próxima: **Fase 2** (Supabase novo + login por código).

---

## 1. O que é o projeto

PTG de ADS da **Fatec Indaiatuba** (autor: Lucas Tsai). Plataforma de estudos que **se alimenta sozinha**: a Yara, uma IA local, lê o site da unidade (fatecid.com.br), PDFs, planos de ensino e as conversas da turma, e monta agenda, horários, tarefas e avisos para cada aluno. Piloto com a turma do Lucas. UI toda em **português do Brasil**, tema claro, responsiva, PWA.

### Regras do produto (não negociáveis)
- **Zero trabalho extra para secretaria e coordenação.** Tudo da instituição vem de coleta automática.
- **Cadastro só com e-mail institucional** de domínio permitido do tenant (`@aluno.cps.sp.gov.br`), validado por **código de 6 dígitos** (OTP). Sem login social.
- **Nunca** pedir ou guardar a senha do SIGA.
- **Edição do aluno nunca é sobrescrita** pela Yara: ela pergunta "a data oficial mudou, aplicar?" (`evento_override`).
- **Toda informação captada mostra a origem** (selo + link da fonte): Oficial · Provável · Esperando a turma · Confirmado pela turma · Descartado.
- **Validação coletiva:** base = vagas da turma no site (`turmas.tamanho_real`) ou, se nulo, membros da turma. Confirma com sim ≥ max(5, 25% da base) **e** sim ≥ 80% dos votos. Descarta se não > 50% com quórum ou após 72 h. Professor ou fonte oficial fecham na hora. Só alunos matriculados votam; votos visíveis (avatares, clique mostra a lista).
- **Reações:** um componente único com lista de quem reagiu (mural, conversa, dúvidas, materiais).
- **Sem WhatsApp/Telegram** por enquanto: toda conversa acontece dentro da Central.

### Papéis
Aluno (padrão) · Monitor · Representante · Professor (aprovado pelo admin) · Admin (Lucas, dono da plataforma). Cada instituição/unidade é um **tenant** isolado.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 + Vite + TypeScript, Tailwind v4, React Router, lucide-react, shadcn/ui. Por fase: **FullCalendar 6** (agenda), **TanStack Query**, dnd-kit (Kanban), vite-plugin-pwa |
| Back-end | Supabase (Auth OTP + Postgres + RLS + Realtime + Edge Functions + pgvector + pgmq). **Cloudflare R2** para arquivos (URL pré-assinada). Resend para os códigos |
| IA (Fase 5) | `workers/yara`: Python 3.12 + Docker; httpx, trafilatura, PyMuPDF; Ollama com `qwen3.5:9b` (texto+imagem), `qwen3.5:4b`, `qwen3-embedding:0.6b`. Roda no PC do Lucas; só conexões de saída (puxa jobs da fila) |
| Infra | Cloudflare Pages. GitHub Actions (keep-alive). Domínio: centraldeestudos.com.br (a confirmar) |

O front **nunca** recebe credenciais do R2 nem a service role.

### 2.1 Identidade Foco
- Tokens em `src/index.css` (padrão shadcn) — **fonte de verdade**. Geist / Geist Mono. Ação: `#2f4ad0` (hover `#2740b8`, suave `#eaeefc` = `accent`). Superfícies escuras: `--dark: #14275a`.
- 8 cores de matéria (`cobalto` … `roxo`) e 11 de tipo de evento (`--evt-*`, pílula com fundo a 13%).
- Sidebar fixa **224 px** com "Meu espaço · privado" (Hoje, Agenda, Minhas matérias, Caixa de entrada, Tarefas, Revisão, Notas e faltas) e "Comunidade" (Minha turma, Meu curso, Fatec · unidade, disciplinas). **Na Agenda vira trilho de ícones de 68 px** (`AppRail`).
- Raio 8 cartões, 6 botões/campos, 12 modais, 999 pílulas. Controles 34–36 px. Ícones Lucide traço 1.75.
- Componentes Foco em `src/components/foco/` (`SeloStatus`, `SeloYara`, `PilulaEvento`, `EtiquetaEvento`).

### 2.2 Rotas

| Rota | Tela (mockup) |
|---|---|
| `/entrar`, `/criar-conta`, `/recuperar-senha` | 01 |
| `/boas-vindas` | 02 · Primeiro acesso |
| `/` | 03 · Hoje |
| `/agenda?visao=dia\|semana-util\|semana\|mes\|lista` | 20–25 |
| `/materias`, `/materias/:id` | 09 |
| `/entrada` | 04 · Caixa de entrada |
| `/tarefas` | 06 |
| `/revisao` | 05 · Plano até a prova |
| `/notas` | 07 |
| `/turma`, `/turmas/:id` | 08–10, 19 (conversa, mural, dúvidas, confirmações) |
| `/curso`, `/unidade` | 11 |
| `/admin/visao\|fontes\|curadoria\|contas\|servidor` | 14–18 |
| `/configuracoes/perfil\|notificacoes\|agenda\|privacidade` | 26 (agenda) |

Telas do professor (12–13) entram na Fase 4. Novo evento (23) e cartão do evento (21) são modais/popovers.

---

## 3. Agenda — prioridade nº 1 (seção 14 da documentação)

- Padrão Outlook com visual Foco: trilho + painel de calendários (260 px: Novo evento, minicalendário, camadas com checkbox colorido) + barra (Hoje, ← →, título, Dia/Semana útil/Semana/Mês/Lista, filtro, busca).
- FullCalendar 6 (`timeGrid`, `dayGrid`, `list`, `interaction`) com `eventContent` próprio; 08–23 h, slots de 30 min, snap 15 min, linha do agora.
- Evento: fundo da cor da matéria a 12%, barra esquerda 3 px. Prova = etiqueta PROVA; entrega = ENTREGA; proposta = tracejado âmbar; sugestão da Yara = listras azuis; cancelado = riscado a 55%; trabalho = hachurado.
- Cartão rápido ao clicar, criação por frase, arrastar/redimensionar com update otimista, atalhos (N, T, D, U, W, M, L, ← →, /, Ctrl+J), prefetch ±3 semanas, Realtime, link .ics pessoal.
- **Fase 1 entregou a casca** (`src/pages/Agenda.tsx`, `src/components/agenda/`): trilho, painel com minicalendário funcional, barra com visões e atalhos, grade da semana vazia com linha do agora. A Fase 3 encaixa o FullCalendar dentro dela.

---

## 4. Modelo de dados

Schema completo e testado no kit inicial (`supabase/migrations/0001_schema.sql` do starter kit; será aplicado na Fase 2 substituindo `20261027000000_schema_inicial.sql`). Principais tabelas: `tenants`, `perfis` (papel, tenant), `cursos`, `disciplinas`, `turmas` (`tamanho_real`), `matriculas`, `aulas_horario`, `eventos` (escopo unidade/curso/turma/pessoal, origem, fonte, confiança, status, rrule, lembretes), `evento_override`, `agenda_preferencias` (camadas, lembretes, `ics_token`), `materiais`, `tarefas`, `avaliacoes`, `notas`, `frequencia`, `mensagens`, `duvidas`, `respostas`, `propostas`, `votos`, `reacoes`, `fontes`, `capturas`, `conhecimento_trechos` (pgvector 1024), `curadoria`, `notificacoes`, `auditoria`, fila `yara_jobs` (pgmq).

RLS: dados pessoais por `usuario_id = auth.uid()`; dados de turma só para quem está em `matriculas`; tudo filtrado pelo tenant; votar só aluno matriculado com proposta aberta.

---

## 5. Padrões do projeto

- **Adaptador de dados:** telas chamam `src/api/*`, nunca o Supabase direto.
- **Modo demonstração:** sem `.env.local` as rotas ficam abertas e nada é salvo.
- **Upload:** Edge Functions `upload-url` / `confirmar-upload` / `download-url` com URL pré-assinada do R2.
- **Estados:** vazio com ação principal, skeletons, erro com "Tentar de novo", toasts com Desfazer.
- **Env:** `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
- **Deploy:** Cloudflare Pages (`npm run build`, saída `dist`, `public/_redirects`).
- **LGPD:** termos aceitos no cadastro, exportar e excluir conta, coleta só de páginas públicas respeitando robots.txt.

---

## 6. Como rodar
```bash
npm install
cp .env.example .env.local   # preencher VITE_SUPABASE_*
npm run dev                  # http://localhost:5173
```
Antes de concluir qualquer tarefa: `npm run lint && npm run build`.

---

## 7. Convenções
- Código e UI em português do Brasil; TypeScript estrito; tipos em `src/types`.
- `src/components` (shadcn em `ui/`, Foco em `foco/`, agenda em `agenda/`), telas em `src/pages`, dados em `src/api`, libs em `src/lib` (constantes fora de arquivos de componente, por causa do fast refresh).
- Cores sempre pelos tokens (nada de cor literal solta).
- Commits `feat:/fix:/chore:/docs:`; um PR por funcionalidade.

---

## 8. Roteiro

- [x] **Fase 0 · Preparação** — repo reaproveitado, CLAUDE.md novo, mockups em `docs/design/`.
- [x] **Fase 1 · Fundação web** — navegação nova (sidebar + trilho), rotas novas com stubs, componentes Foco, casca da agenda.
- [ ] **Fase 2 · Supabase e contas** — schema novo com RLS (resetar o banco antigo), login por código no e-mail + Auth Hook de domínio, seed Fatec Indaiatuba/ADS, onboarding (curso, semestre, turmas).
- [ ] **Fase 3 · Espaço pessoal** — **agenda Outlook primeiro** (FullCalendar + TanStack Query), depois matérias/materiais (R2), tarefas, revisão, notas e faltas.
- [ ] **Fase 4 · Comunidade** — turmas, conversa (Realtime), dúvidas, reações, validação coletiva, professor.
- [ ] **Fase 5 · Yara v1** — coletor + calendário acadêmico + grade de horários + avisos em imagem.
- [ ] **Fase 6 · Yara v2** — caixa de entrada, plano de ensino, SIGA, RAG, resumo diário.
- [ ] **Fase 7 · Painel admin.**
- [ ] **Fase 8 · PWA, deploy, piloto.**
- [ ] **Fase 9 · Avaliação para o PTG.**
