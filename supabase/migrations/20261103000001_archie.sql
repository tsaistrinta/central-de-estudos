-- Archie (Fase 5): base de conhecimento (pgvector) e fila de tarefas (pgmq).
-- No Supabase: Database → Extensions → ligar "vector" e "pgmq" antes de rodar.
create extension if not exists vector with schema extensions;
create extension if not exists pgmq;

create table public.conhecimento_trechos (
  id bigserial primary key,
  tenant_id uuid not null references public.tenants on delete cascade,
  fonte_id uuid references public.fontes on delete set null,
  captura_id bigint references public.capturas on delete set null,
  texto text not null,
  embedding extensions.vector(1024),
  metadados jsonb not null default '{}',
  criado_em timestamptz not null default now()
);
create index on public.conhecimento_trechos using hnsw (embedding extensions.vector_cosine_ops);
alter table public.conhecimento_trechos enable row level security;
create policy "conhecimento: admin" on public.conhecimento_trechos for select using (public.sou_admin());

select pgmq.create('archie_jobs');

-- Expirar propostas sem quórum (72 h). Ligue "pg_cron" em Database → Extensions.
create extension if not exists pg_cron;
select cron.schedule('expirar-propostas', '*/15 * * * *', $$select public.expirar_propostas()$$);
