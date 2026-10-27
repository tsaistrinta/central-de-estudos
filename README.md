<div align="center">

<img src="docs/logo-chip.svg" width="96" alt="Logo Central de Estudos" />

# Central de Estudos

**Repositório pessoal para centralizar, organizar e encontrar rapidamente todo o material de estudo de cursos.**

![Status](https://img.shields.io/badge/status-em%20desenvolvimento-7c3aed)
![Front-end](https://img.shields.io/badge/front--end-React%20%2B%20Vite%20%2B%20TS-61dafb)
![Back-end](https://img.shields.io/badge/back--end-Supabase%20%2B%20Cloudflare%20R2-3ecf8e)
![Banco](https://img.shields.io/badge/banco-PostgreSQL-336791)
![Licença](https://img.shields.io/badge/licença-MIT-black)

</div>

---

## Sobre o projeto

A **Central de Estudos** é um aplicativo web para o estudante guardar e reencontrar tudo o que acumula ao longo de seus cursos: arquivos, links, anotações e trechos de código, organizados numa hierarquia **Curso → Semestre → Matéria → Material**. Cada usuário tem login próprio e seus dados são privados.

O projeto nasceu como protótipo numa plataforma no-code (Base44) e está sendo reconstruído com stack própria, de código aberto e sem custo de lançamento, visando evoluir para um produto com planos de armazenamento.

## Funcionalidades

- **Dashboard** com próximos prazos, favoritos, adicionados recentemente e progresso por matéria.
- **Materiais em 4 tipos:** arquivo (upload de PDF/slides/imagens), link, anotação e snippet de código com destaque de sintaxe.
- **Documentos conectados** no estilo Obsidian: editor rich text, wikilinks `[[ ]]` com autocomplete, backlinks e visão em grafo interativa.
- **Agenda de prazos** (provas, entregas e mais) e fila de **revisão** ("estudar depois" / "já revisei").
- **Busca global** (Ctrl K) full-text em português e **filtros combinados** por matéria, tipo e etiqueta.
- **Favoritos e etiquetas livres** em todo material e documento.
- Interface clara (identidade **Foco**), responsiva e 100% em português do Brasil.

## Stack utilizada

| Camada | Tecnologias |
|---|---|
| **Front-end** | React, Vite, TypeScript, Tailwind CSS v4, React Router, shadcn/ui, lucide-react. Previstos: Tiptap (editor), react-force-graph (grafo), FullCalendar (agenda) |
| **Back-end** | Supabase — autenticação (OAuth Google e Microsoft + e-mail), API REST/Realtime e Edge Functions (Deno/TypeScript); Cloudflare R2 (armazenamento de arquivos, compatível com S3); Resend (e-mails) |
| **Banco de dados** | PostgreSQL (gerenciado pelo Supabase), com Row Level Security e busca full-text |
| **Infra / Deploy** | Cloudflare Pages (hospedagem com CI/CD); GitHub Actions (keep-alive) |

Todas as camadas rodam em planos gratuitos no lançamento. Os arquivos ficam no Cloudflare R2 desde o início (10 GB grátis, download sem custo), o que mantém a arquitetura pronta para escalar.

## Arquitetura

```mermaid
flowchart LR
    U["Usuário<br/>(navegador)"] --> FE["App React + Vite<br/>Cloudflare Pages"]
    FE -->|"auth + dados (SQL)"| SB["Supabase<br/>Auth · PostgreSQL · RLS"]
    FE -->|"pede URL pré-assinada"| EF["Supabase Edge Functions<br/>upload-url · download-url"]
    EF -->|"gera URL assinada + confere cota"| R2["Cloudflare R2<br/>arquivos (S3)"]
    FE -.->|"upload/baixa direto"| R2
    SB -->|"e-mail de cadastro"| RS["Resend"]
```

O navegador envia e baixa arquivos **direto do R2** por URLs pré-assinadas de validade curta, emitidas pelas Edge Functions só após checar a cota do usuário. Nenhuma credencial do R2 chega ao front-end. O diagrama detalhado está em [`docs/arquitetura.md`](docs/arquitetura.md).

## Estrutura de pastas

```
central-de-estudos/
├─ public/              # estáticos (_redirects para SPA, ícone do app)
├─ src/
│  ├─ api/              # adaptador de dados: entities.ts
│  ├─ components/       # layout e componentes do app
│  │  └─ ui/            # primitivos do shadcn/ui
│  ├─ lib/              # clientes e utilitários (supabase.ts, utils.ts)
│  ├─ pages/            # telas/rotas (auth/ para as telas públicas)
│  ├─ types/            # tipos TypeScript
│  ├─ index.css         # tokens da identidade Foco
│  ├─ App.tsx
│  └─ main.tsx
├─ docs/
│  ├─ arquitetura.md    # diagrama e documentação de arquitetura
│  └─ design/           # identidade Foco: tokens, regras e as 39 telas
├─ .github/workflows/   # keep-alive (ping anti-pausa do Supabase)
├─ .env.example         # modelo das variáveis de ambiente
├─ CLAUDE.md            # briefing do projeto
├─ LICENSE
└─ README.md
```

Previstos nos próximos marcos: `supabase/migrations` (schema, RLS, triggers), `supabase/functions` (upload-url, confirmar-upload, download-url) e `src/api/upload.ts`.

## Como rodar localmente

Pré-requisitos: **Node.js LTS** e **Git**.

```bash
# 1. clonar o repositório
git clone https://github.com/<seu-usuario>/central-de-estudos.git
cd central-de-estudos

# 2. instalar as dependências
npm install

# 3. configurar o ambiente
cp .env.example .env.local
# preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

# 4. rodar em desenvolvimento
npm run dev
```

O app sobe em `http://localhost:5173`.

## Roadmap

- **v1 — Free (atual):** stack gratuita, cota de 200 MB por usuário, arquivos no R2.
- **v2 — Planos pagos:** integração com Stripe (assinaturas + "GB extra"), Supabase Pro (backup e sem pausa), cotas por plano (Free 200 MB · Plus 5 GB · Pro 50 GB).
- **v3 — Mobile:** PWA instalável; app nativo (React Native/Expo) como trabalho futuro.

## Autor

**Lucas T. Strinta** — Análise e Desenvolvimento de Sistemas (FATEC).

## Licença

Distribuído sob a licença MIT. Veja `LICENSE` para mais detalhes.
