-- Central de Estudos — schema inicial (Marco 2).
-- Espelha a seção 6 do CLAUDE.md. Rodar com `supabase db push` ou colar no SQL Editor.
--
-- Isolamento por usuário em duas camadas:
--   1. RLS "dono" em todas as tabelas (usuario_id = auth.uid()).
--   2. Chaves estrangeiras compostas (pai_id, usuario_id): uma linha só pode apontar
--      para pais do MESMO usuário, mesmo que alguém tente inserir o id de outra conta.

-- ─────────────────────────────────────────────────────────────
-- Perfil e plano
-- ─────────────────────────────────────────────────────────────

create table public.perfis (
  id uuid primary key references auth.users on delete cascade,
  nome text,
  avatar_url text,
  preferencias jsonb not null default '{}',
  onboarding_concluido boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.plano_usuario (
  usuario_id uuid primary key references auth.users on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'plus', 'pro')),
  cota_bytes bigint not null default 209715200,           -- 200 MB
  limite_arquivo_bytes bigint not null default 26214400,  -- 25 MB
  bytes_usados bigint not null default 0 check (bytes_usados >= 0),
  stripe_customer_id text,
  atualizado_em timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Curso → Semestre → Matéria → Material
-- ─────────────────────────────────────────────────────────────

create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  instituicao text,
  ordem int not null default 0,
  unique (id, usuario_id)
);

create table public.semestres (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  curso_id uuid not null,
  nome text not null check (length(trim(nome)) > 0),
  ordem int not null default 0,
  atual boolean not null default false,
  unique (id, usuario_id),
  foreign key (curso_id, usuario_id) references public.cursos (id, usuario_id) on delete cascade
);
create unique index semestre_atual_unico on public.semestres (usuario_id) where atual;

create table public.materias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  semestre_id uuid not null,
  nome text not null check (length(trim(nome)) > 0),
  professor text,
  cor text not null default 'cobalto'
    check (cor in ('cobalto','azul','petroleo','verde','mostarda','laranja','framboesa','roxo')),
  unique (id, usuario_id),
  foreign key (semestre_id, usuario_id) references public.semestres (id, usuario_id) on delete cascade
);

create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  materia_id uuid not null,
  tipo text not null check (tipo in ('arquivo','link','anotacao','codigo')),
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  url text,
  conteudo text,
  linguagem text,
  arquivo_chave_r2 text,
  arquivo_tamanho bigint,
  arquivo_mime text,
  favorito boolean not null default false,
  status_revisao text not null default 'estudar_depois'
    check (status_revisao in ('estudar_depois','ja_revisei')),
  ultimo_acesso timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  busca tsvector generated always as (
    to_tsvector('portuguese',
      coalesce(titulo,'') || ' ' || coalesce(descricao,'') || ' ' || coalesce(conteudo,''))
  ) stored,
  unique (id, usuario_id),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- Documentos conectados
-- ─────────────────────────────────────────────────────────────

create table public.grupos_documento (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  cor text not null default 'cobalto'
    check (cor in ('cobalto','azul','petroleo','verde','mostarda','laranja','framboesa','roxo')),
  unique (id, usuario_id)
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  materia_id uuid,
  grupo_id uuid,
  titulo text not null check (length(trim(titulo)) > 0),
  conteudo_json jsonb,
  conteudo_texto text,
  favorito boolean not null default false,
  anexo_chave_r2 text,
  criado_em timestamptz not null default now(),
  editado_em timestamptz not null default now(),
  busca tsvector generated always as (
    to_tsvector('portuguese', coalesce(titulo,'') || ' ' || coalesce(conteudo_texto,''))
  ) stored,
  unique (id, usuario_id),
  -- "set null (coluna)" (Postgres 15+) zera só o id do pai, preservando usuario_id.
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete set null (materia_id),
  foreign key (grupo_id, usuario_id) references public.grupos_documento (id, usuario_id) on delete set null (grupo_id)
);

create table public.links_documentos (
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  origem_id uuid not null,
  destino_id uuid not null,
  primary key (origem_id, destino_id),
  foreign key (origem_id, usuario_id) references public.documentos (id, usuario_id) on delete cascade,
  foreign key (destino_id, usuario_id) references public.documentos (id, usuario_id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- Agenda
-- ─────────────────────────────────────────────────────────────

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  materia_id uuid,
  titulo text not null check (length(trim(titulo)) > 0),
  descricao text,
  data date not null,
  hora time,                                              -- null = "Dia todo"
  tipo text not null check (tipo in ('prova','entrega','trabalho','apresentacao','aula',
    'reuniao','leitura','projeto','lembrete','data_especial','outro')),
  concluido boolean not null default false,
  lembrete_minutos int check (lembrete_minutos is null or lembrete_minutos >= 0),
  lembrete_enviado_em timestamptz,
  unique (id, usuario_id),
  foreign key (materia_id, usuario_id) references public.materias (id, usuario_id) on delete set null (materia_id)
);

create table public.referencias_evento (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  evento_id uuid not null,
  documento_id uuid,
  material_id uuid,
  check (num_nonnulls(documento_id, material_id) = 1),
  foreign key (evento_id, usuario_id) references public.eventos (id, usuario_id) on delete cascade,
  foreign key (documento_id, usuario_id) references public.documentos (id, usuario_id) on delete cascade,
  foreign key (material_id, usuario_id) references public.materiais (id, usuario_id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- Etiquetas
-- ─────────────────────────────────────────────────────────────

create table public.etiquetas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  nome text not null check (length(trim(nome)) > 0),
  unique (usuario_id, nome),
  unique (id, usuario_id)
);

create table public.material_etiqueta (
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  material_id uuid not null,
  etiqueta_id uuid not null,
  primary key (material_id, etiqueta_id),
  foreign key (material_id, usuario_id) references public.materiais (id, usuario_id) on delete cascade,
  foreign key (etiqueta_id, usuario_id) references public.etiquetas (id, usuario_id) on delete cascade
);

create table public.documento_etiqueta (
  usuario_id uuid not null default auth.uid() references auth.users on delete cascade,
  documento_id uuid not null,
  etiqueta_id uuid not null,
  primary key (documento_id, etiqueta_id),
  foreign key (documento_id, usuario_id) references public.documentos (id, usuario_id) on delete cascade,
  foreign key (etiqueta_id, usuario_id) references public.etiquetas (id, usuario_id) on delete cascade
);

-- ─────────────────────────────────────────────────────────────
-- Índices
-- ─────────────────────────────────────────────────────────────

create index on public.materiais using gin (busca);
create index on public.documentos using gin (busca);

create index on public.cursos (usuario_id);
create index on public.semestres (usuario_id);
create index on public.semestres (curso_id);
create index on public.materias (usuario_id);
create index on public.materias (semestre_id);
create index on public.materiais (usuario_id, criado_em desc);
create index on public.materiais (materia_id);
create index on public.materiais (usuario_id, status_revisao);
create index on public.grupos_documento (usuario_id);
create index on public.documentos (usuario_id, editado_em desc);
create index on public.documentos (materia_id);
create index on public.documentos (grupo_id);
create index on public.links_documentos (usuario_id);
create index on public.links_documentos (destino_id);   -- backlinks
create index on public.eventos (usuario_id, data);
create index on public.eventos (materia_id);
create index on public.referencias_evento (usuario_id);
create index on public.referencias_evento (evento_id);
create index on public.etiquetas (usuario_id);
create index on public.material_etiqueta (usuario_id);
create index on public.material_etiqueta (etiqueta_id);
create index on public.documento_etiqueta (usuario_id);
create index on public.documento_etiqueta (etiqueta_id);

-- ─────────────────────────────────────────────────────────────
-- Datas de atualização automáticas
-- ─────────────────────────────────────────────────────────────

create function public.tocar_atualizado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

create function public.tocar_editado_em() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.editado_em := now();
  return new;
end $$;

create trigger materiais_atualizado_em before update on public.materiais
  for each row execute function public.tocar_atualizado_em();
create trigger plano_usuario_atualizado_em before update on public.plano_usuario
  for each row execute function public.tocar_atualizado_em();
create trigger documentos_editado_em before update on public.documentos
  for each row execute function public.tocar_editado_em();

-- ─────────────────────────────────────────────────────────────
-- Cadastro: cria perfil + plano Free ao surgir um usuário no Auth
-- ─────────────────────────────────────────────────────────────

create function public.criar_perfil_e_plano() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id, nome, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome',
             new.raw_user_meta_data ->> 'full_name',
             new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.plano_usuario (usuario_id) values (new.id);
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil_e_plano();

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────

alter table public.perfis enable row level security;
create policy "perfil: dono lê" on public.perfis
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil: dono edita" on public.perfis
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- plano_usuario: só leitura para o dono; alterações apenas pela service role (Edge Functions/Stripe).
alter table public.plano_usuario enable row level security;
create policy "plano: dono lê" on public.plano_usuario
  for select to authenticated using (usuario_id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'cursos', 'semestres', 'materias', 'materiais', 'grupos_documento', 'documentos',
    'links_documentos', 'eventos', 'referencias_evento', 'etiquetas',
    'material_etiqueta', 'documento_etiqueta'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "dono" on public.%I for all to authenticated
         using (usuario_id = (select auth.uid()))
         with check (usuario_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Semestre atual (o índice parcial impede dois "atuais" ao mesmo tempo,
-- então a troca desmarca o antigo antes de marcar o novo)
-- ─────────────────────────────────────────────────────────────

create function public.definir_semestre_atual(semestre uuid) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.semestres set atual = false
    where usuario_id = (select auth.uid()) and atual and id <> semestre;
  update public.semestres set atual = true
    where usuario_id = (select auth.uid()) and id = semestre;
end $$;
