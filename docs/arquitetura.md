# Arquitetura — Central de Estudos

Híbrida: o app, o banco e os arquivos ficam na nuvem (acesso de qualquer lugar); a IA local (Yara) roda num PC com GPU e só faz conexões de saída.

```mermaid
flowchart LR
    U["Aluno / professor<br/>navegador ou celular (PWA)"] --> FE["App React + Vite<br/>Cloudflare Pages"]
    FE -->|"login por código · dados · Realtime"| SB["Supabase (São Paulo)<br/>Auth · Postgres + RLS"]
    FE -->|"pede URL assinada"| EF["Edge Functions<br/>r2-upload-url · r2-download-url · agenda-ics"]
    EF --> R2["Cloudflare R2<br/>arquivos"]
    FE -.->|"envia/baixa direto"| R2
    SB -->|"código de 6 dígitos"| RS["Resend (SMTP)"]
    OUT["Outlook · Google · iPhone"] -->|"assina o .ics"| EF
    subgraph PC["PC do Lucas (depois: servidor da Fatec)"]
      Y["Worker Yara<br/>Python + Ollama (Qwen3.5)"]
    end
    Y -->|"puxa tarefas da fila (pgmq) · grava eventos"| SB
    Y -->|"lê páginas e PDFs públicos"| SITE["fatecid.com.br"]
    GH["GitHub Actions"] -->|"keep-alive a cada 3 dias"| SB
```

## Peças

| Peça | O que faz |
|---|---|
| `src/` | SPA React 19 + TypeScript + Tailwind v4 (identidade Foco). Sem `.env.local` roda em modo demonstração. |
| `src/api/*` | Única camada que fala com o Supabase. Cada função tem a versão demonstração (`demo.ts`). |
| `supabase/migrations` | Schema, RLS e regras (domínio do e-mail, validação coletiva, aplicação das propostas). |
| `supabase/functions` | URLs assinadas do R2 e o feed `.ics` pessoal. |
| `workers/yara` (Fase 5) | Coletor + extração com IA local. Se parar, o app continua; as tarefas esperam na fila. |

## Segurança

- Cadastro só com e-mail de domínio permitido do tenant; o trigger `criar_perfil` recusa o resto.
- RLS em todas as tabelas: dados pessoais por `auth.uid()`, dados da turma só para quem está nela.
- O front nunca recebe a service role nem as chaves do R2. O `.ics` usa um token pessoal e secreto.
- A Central nunca pede nem guarda a senha do SIGA.

## Limites do plano gratuito (piloto)

Supabase Free (500 MB de banco, pausa após 7 dias sem uso → keep-alive), R2 (10 GB, download sem custo), Resend (100 e-mails/dia), Cloudflare Pages.
