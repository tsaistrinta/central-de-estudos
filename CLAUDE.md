# Central de Estudos — Briefing do projeto (para Claude Code)

> Contexto-mestre do projeto. Leia inteiro antes de codar.
> Documentação completa (14 seções): doc "Central de Estudos · Documentação do projeto" no claude.ai.
> Referência visual obrigatória: mockups 01–26 em `docs/design/central-fatec-telas.zip` (fora do git). **Fazer igual aos mockups.**

---

## 0. Estado do repositório

- **Repo:** https://github.com/tsaistrinta/central-de-estudos (público, `main`). **Local:** `/home/lucas/central-de-estudos` (Linux; antes `C:\dev\central-de-estudos`).
- **Nova direção (03/11/2026):** o app pessoal antigo (cursos/semestres, documentos conectados, grafo, biblioteca de código, planos pagos) foi substituído pela Central para a Fatec com a IA **Archie**. O app fica na raiz do repo (sem monorepo); o worker da IA entra em `workers/archie/` na Fase 5.
- **Fases 0 a 5: código feito** (seção 8). Falta o Lucas ligar o Supabase (`docs/setup-supabase.md`) e o Archie (`docs/archie.md`). Próxima: **Fase 6** (Archie v2).

---

## 1. O que é o projeto

PTG de ADS da **Fatec Indaiatuba** (autor: Lucas Tsai). Plataforma de estudos que **se alimenta sozinha**: o Archie, uma IA local, lê o site da unidade (fatecid.com.br), PDFs, planos de ensino e as conversas da turma, e monta agenda, horários, tarefas e avisos para cada aluno. Piloto com a turma do Lucas. UI toda em **português do Brasil**, tema claro, responsiva, PWA.

**Nome da IA: Archie**, em homenagem ao Dr. Archimedes Lammoglia, patrono da Fatec Indaiatuba ("Fatec Indaiatuba – Dr. Archimedes Lammoglia"). Nome decidido pelo Lucas em 16/11/2026; usar sempre "o Archie" (masculino) nos textos.

### Regras do produto (não negociáveis)
- **Zero trabalho extra para secretaria e coordenação.** Tudo da instituição vem de coleta automática.
- **Cadastro só com e-mail institucional** de domínio permitido do tenant (`@aluno.cps.sp.gov.br`), validado por **código de 6 dígitos** (OTP). Sem login social.
- **Nunca** pedir ou guardar a senha do SIGA.
- **Edição do aluno nunca é sobrescrita** pelo Archie: ele pergunta "a data oficial mudou, aplicar?" (`evento_override`).
- **Dupla leitura:** o Archie só publica sozinho o que leu igual por dois caminhos independentes (texto sem IA × IA); o que diverge fica na curadoria com as duas versões (`workers/archie/archie/conferencia.py`).
- **Toda informação captada mostra a origem** (selo + link da fonte): Oficial · Provável · Esperando a turma · Confirmado pela turma · Descartado.
- **Validação coletiva:** base = vagas da turma no site (`turmas.tamanho_real`) ou, se nulo, membros da turma. Confirma com sim ≥ max(5, 25% da base) **e** sim ≥ 80% dos votos. Descarta se não > 50% com quórum ou após 72 h. Professor ou fonte oficial fecham na hora. Só alunos matriculados votam; votos visíveis (avatares, clique mostra a lista).
- **Reações:** um componente único com lista de quem reagiu (mural, conversa, dúvidas, materiais).
- **Sem WhatsApp/Telegram** por enquanto: toda conversa acontece dentro da Central.
- **Ninguém se matricula sozinho numa turma:** entra com o **código da turma** (o professor ou o admin gera e passa em sala) ou **pede para entrar** e o professor da turma ou o admin aprova (`pedidos_turma`). O primeiro acesso e "Adicionar matéria" criam pedidos. 8 códigos errados por hora bloqueiam.
- **Acervo permanente por disciplina** (`acervo_itens`): provas antigas, resumos, listas que ficam para as próximas turmas; só quem cursa ou cursou a disciplina vê. **Todo envio entra "em análise"** e o Archie verifica (tipo real do arquivo, macro/JavaScript embutido, antivírus se houver, dados pessoais de terceiros, conteúdo impróprio/ilícito/malicioso pelo modelo local). O que reprova vai para a **quarentena** (`/admin/quarentena`) com nome, e-mail, curso, histórico do aluno, hash e motivo. 3 denúncias tiram do ar.
- **Archie só trata da vida acadêmica na Fatec** (aulas, calendário, provas, secretaria, PTG, estágio, conteúdo das disciplinas); fora disso recusa em uma frase. Segue a LGPD: não lê nem expõe dados pessoais de terceiros, modelo só local, nada vai para IA de terceiros. Detalhes e migração para o servidor da Fatec: doc "Archie · Migração para o servidor da Fatec e políticas de uso" (https://claude.ai/artifact/P5ryQ8vk592BT6QZXXbDWQ).

### Papéis
Aluno (padrão) · Monitor · Representante · Professor (aprovado pelo admin) · Admin (Lucas, dono da plataforma). Cada instituição/unidade é um **tenant** isolado.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Front-end | React 19 + Vite + TypeScript, Tailwind v4, React Router, lucide-react, shadcn/ui. Por fase: **FullCalendar 6** (agenda), **TanStack Query**, dnd-kit (Kanban), vite-plugin-pwa |
| Back-end | Supabase (Auth OTP + Postgres + RLS + Realtime + Edge Functions + pgvector + pgmq). **Cloudflare R2** para arquivos (URL pré-assinada). Resend para os códigos |
| IA (Fase 5) | `workers/archie`: Python 3.12 + Docker; httpx, trafilatura, PyMuPDF, psycopg 3; Ollama com `qwen3.5:9b` (texto+imagem, JSON com esquema) e `qwen3-embedding:0.6b`. Roda no PC do Lucas; só conexões de saída (fila pgmq + fontes vencidas). Detalhes em `docs/archie.md` |
| Infra | Cloudflare Pages. GitHub Actions (keep-alive). Domínio: centraldeestudos.com.br (a confirmar) |

O front **nunca** recebe credenciais do R2 nem a service role.

### 2.1 Identidade Foco
- Tokens em `src/index.css` (padrão shadcn) — **fonte de verdade**. Geist / Geist Mono. Ação: `#2f4ad0` (hover `#2740b8`, suave `#eaeefc` = `accent`). Superfícies escuras: `--dark: #14275a`.
- 8 cores de matéria (`cobalto` … `roxo`) e 11 de tipo de evento (`--evt-*`, pílula com fundo a 13%).
- Sidebar fixa **224 px** com "Meu espaço · privado" (Hoje, Agenda, Minhas matérias, Meus arquivos, Tarefas, Revisão, Notas e faltas) e "Comunidade" (Minha turma, Meu curso, Fatec · unidade, disciplinas). **Na Agenda vira trilho de ícones de 68 px** (`AppRail`).
- Raio 8 cartões, 6 botões/campos, 12 modais, 999 pílulas. Controles 34–36 px. Ícones Lucide traço 1.75.
- Componentes Foco em `src/components/foco/` (`SeloStatus`, `SeloArchie`, `PilulaEvento`, `EtiquetaEvento`).

### 2.2 Rotas

| Rota | Tela (mockup) |
|---|---|
| `/entrar`, `/criar-conta`, `/recuperar-senha` | 01 |
| `/boas-vindas` | 02 · Primeiro acesso |
| `/` | 03 · Hoje |
| `/agenda?visao=dia\|semana-util\|semana\|mes\|lista` | 20–25 |
| `/materias`, `/materias/:id` | 09 |
| `/arquivos` (antes `/entrada`) | 04 · Meus arquivos |
| `/tarefas` | 06 |
| `/revisao` | 05 · Plano até a prova |
| `/notas` | 07 |
| `/turma`, `/turmas/:id` | 08–10, 19 (conversa, mural, dúvidas, confirmações) |
| `/curso`, `/unidade` | 11 |
| `/admin/visao\|fontes\|curadoria\|contas\|entradas\|quarentena\|turmas\|servidor` | 14–18 |
| `/configuracoes/perfil\|notificacoes\|agenda\|privacidade` | 26 (agenda) |

Telas do professor (12–13) entram na Fase 4. Novo evento (23) e cartão do evento (21) são modais/popovers.

---

## 3. Agenda — prioridade nº 1 (seção 14 da documentação)

- Padrão Outlook com visual Foco: trilho + painel de calendários (260 px: Novo evento, minicalendário, camadas com checkbox colorido) + barra (Hoje, ← →, título, Dia/Semana útil/Semana/Mês/Lista, filtro, busca).
- FullCalendar 6 (`timeGrid`, `dayGrid`, `list`, `interaction`) com `eventContent` próprio; 08–23 h, slots de 30 min, snap 15 min, linha do agora.
- Evento: fundo da cor da matéria a 12%, barra esquerda 3 px. Prova = etiqueta PROVA; entrega = ENTREGA; proposta = tracejado âmbar; sugestão do Archie = listras azuis; cancelado = riscado a 55%; trabalho = hachurado.
- Cartão rápido ao clicar, criação por frase, arrastar/redimensionar com update otimista, atalhos (N, T, D, U, W, M, L, ← →, /, Ctrl+J), prefetch ±3 semanas, Realtime, link .ics pessoal.
- **Feito (Fase 3):** `src/pages/Agenda.tsx` + `src/components/agenda/` (Calendario com FullCalendar 6, CartaoEvento, NovoEvento com frase e horários livres, PainelCalendarios com camadas salvas nas preferências, `useDadosAgenda` com cache/prefetch/Realtime). Regras em `src/lib/agenda.ts` (`montarItens`): aulas da grade expandidas por dia, feriado e aula cancelada tiram a aula, prova no horário da aula ocupa o lugar dela, propostas abertas aparecem tracejadas. Parser de frases em `src/lib/frase.ts`.
---

## 4. Modelo de dados

Schema em `supabase/migrations/20261027000000_schema_inicial.sql` (testado no Postgres 16 com RLS) + `supabase/seed.sql` (Indaiatuba/ADS 2026/2, provisório) + `20261103000001_archie.sql` (pgvector, pgmq, pg_cron) + `20261116000000_archie_v1.sql` (Fase 5: `fontes.extrator`, `capturas`, curadoria aplicável, `archie_status`, view `ultimas_capturas`).

Tabelas: `tenants`, `cursos`, `perfis` (papel, curso, semestre, turno, onboarding), `disciplinas` (cor), `turmas` (`tamanho_real`, `professor_id`), `matriculas`, `aulas_horario`, `eventos` (escopo unidade/curso/turma/pessoal, origem, status, cancelado, rrule, lembretes), `evento_override`, `agenda_preferencias` (camadas ocultas, `ics_token`), `materiais` (R2, `na_entrada`, `oficial`), `tarefas`, `revisao_itens` (SM-2), `avaliacoes`, `notas`, `frequencia`, `mensagens` (canal `avisos` só professor), `duvidas`, `respostas`, `propostas`, `votos`, `reacoes`, `fontes`, `capturas`, `curadoria`, `notificacoes`, `auditoria`. View `pessoas` (nome e papel sem e-mail).

Migrações de 19/11 (as de 0300 em diante ainda não aplicadas em produção): `20261119000300_indices.sql`, `20261119000400_rls_rapido.sql` (políticas com `(select auth.uid())`), `20261119000500_lgpd.sql` (`exportar_meus_dados`, `excluir_minha_conta` com anonimização: mensagens/dúvidas/respostas/acervo/material da turma ficam sem autor, "Ex-aluno"), `20261119000000_fontes_oficiais.sql` (PPC, matrizes, conteúdo programático, corpo docente), `20261119000100_fonte_do_horario.sql` (`turmas.horario_fonte_url/horario_pagina`, preenchidos ao aplicar a grade), `20261119000200_limite_de_codigos.sql` (o limite de 8 códigos errados por hora não funcionava: o erro desfazia o registro).

Migração `20261118000000_entrada_e_acervo.sql`: `turma_codigos`, `pedidos_turma`, `tentativas_codigo`, `acervo_itens`, `acervo_denuncias`; funções `pedir_entrada`, `entrar_com_codigo`, `decidir_pedido`, `gerar_codigo_turma`, `pedidos_pendentes`, `cursa_disciplina`, `archie_moderar` (interna), `decidir_quarentena`, `listar_quarentena`; a política "matriculas: entrar" foi removida.

Funções: `criar_perfil` (trigger em auth.users, recusa domínio fora do tenant), `dominio_permitido`, `concluir_onboarding`, `quorum_da_turma`, `avaliar_proposta` (trigger nos votos), `aplicar_proposta` (cria/muda/cancela o evento), `fechar_proposta` (professor/admin), `expirar_propostas` (pg_cron). Archie: `aplicar_curadoria` (interna, usada pelo worker), `decidir_curadoria` (admin), `archie_pedir_coleta` (admin → fila), `avisar_mudanca_evento`. **Funções internas têm `revoke execute` de anon/authenticated** (o Postgres dá EXECUTE a todos por padrão) — fazer o mesmo em toda função security definer nova.

RLS: pessoal por `auth.uid()`; turma por `esta_na_turma()` (matrícula ou professor da turma); tudo no tenant; escrita da estrutura só admin; papel do próprio perfil não muda.

### Camada de dados do front
`src/api/` — `base.ts` (cliente + `modoDemo`), `academico.ts`, `agenda.ts`, `espaco.ts`, `comunidade.ts`, `admin.ts`, `auth.ts`. **Sem `.env.local` tudo é servido por `demo.ts`** (dados do piloto em volta da semana atual). Telas usam TanStack Query (`src/lib/query.ts`).

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
- [x] **Fase 2 · Supabase e contas** — schema novo com RLS, cadastro por código (OTP) com domínio do tenant, seed Indaiatuba/ADS, onboarding por turma. *Falta: o Lucas aplicar no Supabase.*
- [x] **Fase 3 · Espaço pessoal** — agenda Outlook (dia, semana útil, semana, mês, lista; cartão; frase; arrastar; camadas; atalhos; .ics), Hoje com dados, matérias/materiais (upload R2), Meus arquivos (antes "Caixa de entrada"), tarefas Kanban, revisão espaçada, notas e faltas (Fui/Faltei). *Falta: publicar as Edge Functions do R2 e do .ics.*
- [x] **Fase 4 · Comunidade** — turma (conversa com canais e Realtime, mural do professor, materiais, dúvidas, confirmações com votos visíveis, membros, entrar em outras turmas), reações com "ver quem", curso e unidade, admin (visão, fontes, curadoria, contas e pedidos de professor, turmas/vagas/professor, servidor), layout de celular.
- [x] **Fase 5 · Archie v1** — dupla leitura com publicação automática (19/11); 79 testes, incluindo 30 de segurança do banco (RLS por papel). `workers/archie`: coletor (robots.txt, 5 s por pedido, hash por documento), calendário (IA com JSON), grade de horários (leitura pela posição do texto, IA por imagem de reserva), avisos em imagem (visão), base de conhecimento com embeddings; publicação por confiança com curadoria; admin com curadoria do Archie, "Verificar agora" e status do worker. 22 testes (pytest, Postgres 16). *Falta: ligar extensões + migração, Ollama e o `.env` do worker (`docs/archie.md`); pedir à TI para liberar o coletor se o site responder 403.*
- [ ] **Fase 6 · Archie v2** — caixa de entrada, plano de ensino, SIGA, RAG, resumo diário.
- [ ] **Fase 7 · Painel admin** — básico já existe; falta auditoria/LGPD e estatísticas do piloto.
- [ ] **Fase 8 · PWA, deploy, piloto.**
- [ ] **Fase 9 · Avaliação para o PTG.**
