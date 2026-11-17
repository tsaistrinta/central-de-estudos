-- Central de Estudos — schema da nova direção (Fatec + Yara), Fases 2 a 4.
-- Substitui o schema do app pessoal antigo. Rodar num banco LIMPO (veja docs/setup-supabase.md).
-- A parte da Yara (pgvector, fila) fica em 20261103000001_yara.sql.
--
-- Segurança em camadas:
--   1. Cadastro só com e-mail de domínio permitido do tenant (trigger em auth.users).
--   2. RLS em todas as tabelas: dados pessoais por usuario_id = auth.uid();
--      dados de turma só para quem está matriculado; tudo dentro do tenant.

-- ===================== Tipos =====================
create type public.papel_usuario as enum ('aluno', 'monitor', 'representante', 'professor', 'admin');
create type public.escopo_evento as enum ('unidade', 'curso', 'turma', 'pessoal');
create type public.status_info as enum ('oficial', 'provavel', 'nao_confirmado', 'confirmado_turma', 'descartado');
create type public.tipo_evento as enum ('prova', 'entrega', 'trabalho', 'apresentacao', 'aula', 'reuniao',
  'leitura', 'projeto', 'lembrete', 'data_especial', 'outro');
create type public.voto_valor as enum ('sim', 'nao');
create type public.cor_materia as enum ('cobalto', 'azul', 'petroleo', 'verde', 'mostarda', 'laranja', 'framboesa', 'roxo');

-- ===================== Instituição e pessoas =====================
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  dominios_permitidos text[] not null default '{}',
  site_url text,
  periodo_atual text not null default '2026/2',   -- semestre letivo em curso
  inicio_periodo date,
  fim_periodo date,
  criado_em timestamptz not null default now()
);

create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  nome text not null,
  sigla text not null,
  semestres int not null default 6
);

create table public.perfis (
  id uuid primary key references auth.users on delete cascade,
  tenant_id uuid not null references public.tenants,
  nome text not null default '',
  email text not null unique,
  papel public.papel_usuario not null default 'aluno',
  quer_ser_professor boolean not null default false,   -- pedido aguardando o admin
  curso_id uuid references public.cursos,
  semestre int,
  turno text check (turno in ('manha', 'tarde', 'noite')),
  onboarding_concluido boolean not null default false,
  aceitou_termos_em timestamptz,
  revalidar_em date,
  preferencias jsonb not null default '{}',
  criado_em timestamptz not null default now()
);

create table public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos on delete cascade,
  nome text not null,
  sigla text,
  semestre_matriz int,
  cor public.cor_materia not null default 'cobalto',
  ementa text
);

create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references public.disciplinas on delete cascade,
  periodo_letivo text not null,
  turno text not null check (turno in ('manha', 'tarde', 'noite')),
  professor_nome text,
  professor_id uuid references public.perfis on delete set null,
  tamanho_real int,                 -- vagas da turma no site; null = conta quem entrou
  fonte text,
  criado_em timestamptz not null default now(),
  unique (disciplina_id, periodo_letivo, turno)
);

create table public.matriculas (
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  turma_id uuid not null references public.turmas on delete cascade,
  papel_turma public.papel_usuario not null default 'aluno',
  criado_em timestamptz not null default now(),
  primary key (usuario_id, turma_id)
);
create index on public.matriculas (turma_id);

-- ===================== Funções de apoio (RLS) =====================
create or replace function public.meu_tenant() returns uuid
language sql stable security definer set search_path = public as $$
  select tenant_id from perfis where id = auth.uid()
$$;

create or replace function public.sou_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'admin' from perfis where id = auth.uid()), false)
$$;

create or replace function public.meu_papel() returns public.papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid()
$$;

create or replace function public.esta_na_turma(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from matriculas where turma_id = t and usuario_id = auth.uid())
      or exists (select 1 from turmas where id = t and professor_id = auth.uid())
$$;

create or replace function public.sou_professor_da_turma(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from turmas tu join perfis p on p.id = auth.uid()
    where tu.id = t and p.papel in ('professor', 'admin')
      and (tu.professor_id = auth.uid() or p.papel = 'admin'))
$$;

create or replace function public.tocar_atualizado_em() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;

-- ===================== Cadastro: domínio permitido → perfil =====================
-- Usado pela tela de criar conta para avisar antes de enviar.
create or replace function public.dominio_permitido(email text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from tenants where lower(split_part(email, '@', 2)) = any (dominios_permitidos))
$$;
grant execute on function public.dominio_permitido(text) to anon, authenticated;

create or replace function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  dominio text := lower(split_part(new.email, '@', 2));
  t uuid;
begin
  select id into t from tenants where dominio = any (dominios_permitidos) limit 1;
  if t is null then
    raise exception 'dominio_nao_permitido: use seu e-mail institucional da Fatec'
      using errcode = 'P0001';
  end if;
  insert into perfis (id, tenant_id, nome, email, aceitou_termos_em, revalidar_em)
  values (new.id, t, coalesce(new.raw_user_meta_data ->> 'nome', ''), lower(new.email), now(),
          (now() + interval '6 months')::date);
  return new;
end $$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil();

-- Nomes visíveis para colegas do mesmo tenant (sem e-mail): votos, conversa, membros.
create view public.pessoas with (security_barrier) as
  select id, nome, papel from public.perfis where tenant_id = public.meu_tenant();
grant select on public.pessoas to authenticated;

-- ===================== Fontes da Yara =====================
create table public.fontes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  nome text not null,
  url text not null,
  tipo text not null default 'pagina' check (tipo in ('pagina', 'pdf', 'imagem', 'rss')),
  frequencia_min int not null default 60,
  ultimo_hash text,
  ultima_verificacao timestamptz,
  status text not null default 'ativa' check (status in ('ativa', 'pausada', 'erro')),
  criado_em timestamptz not null default now()
);

create table public.capturas (
  id bigserial primary key,
  fonte_id uuid not null references public.fontes on delete cascade,
  hash text not null,
  conteudo_url text,
  mudou boolean not null default true,
  capturado_em timestamptz not null default now()
);

-- ===================== Agenda =====================
create table public.aulas_horario (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas on delete cascade,
  dia_semana int not null check (dia_semana between 0 and 6),   -- 0 = domingo
  inicio time not null,
  fim time not null,
  sala text,
  fonte_id uuid references public.fontes on delete set null
);
create index on public.aulas_horario (turma_id);

create table public.eventos (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default public.meu_tenant() references public.tenants on delete cascade,
  escopo public.escopo_evento not null default 'pessoal',
  escopo_id uuid,                        -- curso, turma ou usuário, conforme o escopo
  disciplina_id uuid references public.disciplinas on delete set null,
  titulo text not null,
  tipo public.tipo_evento not null default 'outro',
  inicio timestamptz not null,
  fim timestamptz,
  dia_todo boolean not null default false,
  local text,
  descricao text,
  rrule text,                            -- RFC 5545, ex.: FREQ=WEEKLY;BYDAY=SA;UNTIL=20261121
  lembretes int[],                       -- minutos antes; null = padrão do tipo
  origem text not null default 'manual' check (origem in ('manual', 'yara', 'professor', 'turma', 'importado')),
  fonte_id uuid references public.fontes on delete set null,
  documento_url text,
  confianca numeric(3, 2),
  status public.status_info not null default 'oficial',
  cancelado boolean not null default false,
  criado_por uuid default auth.uid() references public.perfis on delete set null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (escopo <> 'pessoal' or escopo_id is not null)
);
create index eventos_periodo on public.eventos (tenant_id, inicio);
create index eventos_escopo on public.eventos (escopo, escopo_id);
create trigger eventos_atualizado_em before update on public.eventos
  for each row execute function public.tocar_atualizado_em();

-- Pessoal: o padrão do escopo pessoal é o próprio usuário.
create or replace function public.eventos_padrao() returns trigger language plpgsql as $$
begin
  if new.escopo = 'pessoal' and new.escopo_id is null then new.escopo_id := auth.uid(); end if;
  return new;
end $$;
create trigger eventos_padrao before insert on public.eventos
  for each row execute function public.eventos_padrao();

-- Versão do aluno de um evento oficial (nunca sobrescrita pela Yara).
create table public.evento_override (
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  evento_id uuid not null references public.eventos on delete cascade,
  campos jsonb not null default '{}',
  oculto boolean not null default false,
  primary key (usuario_id, evento_id)
);

create table public.agenda_preferencias (
  usuario_id uuid primary key default auth.uid() references public.perfis on delete cascade,
  camadas_ocultas text[] not null default '{}',
  lembretes_padrao jsonb not null default '{"prova":[1440,120],"entrega":[2880,180],"aula":[15],"outro":[30]}',
  hora_inicio int not null default 8,
  hora_fim int not null default 23,
  mostrar_sugestoes boolean not null default true,
  mostrar_propostas boolean not null default true,
  ics_token text unique not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);

-- ===================== Espaço pessoal =====================
create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  dono_id uuid not null default auth.uid() references public.perfis on delete cascade,
  turma_id uuid references public.turmas on delete cascade,   -- preenchido = material compartilhado com a turma
  disciplina_id uuid references public.disciplinas on delete set null,
  tipo text not null check (tipo in ('arquivo', 'link', 'anotacao')),
  titulo text not null,
  url text,
  conteudo text,
  arquivo_chave_r2 text,
  arquivo_tamanho bigint,
  arquivo_mime text,
  semana int,
  na_entrada boolean not null default false,                -- ainda na caixa de entrada
  status_revisao text not null default 'estudar_depois' check (status_revisao in ('estudar_depois', 'ja_revisei')),
  oficial boolean not null default false,                   -- publicado pelo professor
  origem text not null default 'manual',
  criado_em timestamptz not null default now(),
  busca tsvector generated always as (
    to_tsvector('portuguese', coalesce(titulo, '') || ' ' || coalesce(conteudo, ''))) stored
);
create index on public.materiais using gin (busca);
create index on public.materiais (dono_id);
create index on public.materiais (turma_id);

create table public.tarefas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  titulo text not null,
  descricao text,
  coluna text not null default 'a_fazer' check (coluna in ('a_fazer', 'fazendo', 'feito')),
  ordem double precision not null default 0,
  prazo date,
  disciplina_id uuid references public.disciplinas on delete set null,
  origem_evento_id uuid references public.eventos on delete set null,
  subtarefas jsonb not null default '[]',
  criado_em timestamptz not null default now()
);
create index on public.tarefas (usuario_id);

create table public.revisao_itens (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  material_id uuid references public.materiais on delete cascade,
  disciplina_id uuid references public.disciplinas on delete set null,
  pergunta text not null,
  resposta text,
  proxima_em date not null default current_date,
  intervalo_dias int not null default 1,
  facilidade numeric(4, 2) not null default 2.5,
  repeticoes int not null default 0,
  criado_em timestamptz not null default now()
);
create index on public.revisao_itens (usuario_id, proxima_em);

create table public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas on delete cascade,
  nome text not null,
  peso numeric not null default 1,
  data date,
  criado_por uuid default auth.uid() references public.perfis on delete set null
);

create table public.notas (
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  avaliacao_id uuid not null references public.avaliacoes on delete cascade,
  valor numeric(4, 2) check (valor between 0 and 10),
  origem text not null default 'manual',
  primary key (usuario_id, avaliacao_id)
);

create table public.frequencia (
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  turma_id uuid not null references public.turmas on delete cascade,
  data date not null,
  presente boolean not null,
  aulas int not null default 1,          -- aulas daquele dia (cada bloco de 50 min conta)
  primary key (usuario_id, turma_id, data)
);

-- ===================== Comunidade =====================
create table public.mensagens (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas on delete cascade,
  canal text not null default 'geral',
  autor_id uuid not null default auth.uid() references public.perfis on delete cascade,
  texto text not null,
  anexos jsonb not null default '[]',
  fixada boolean not null default false,
  criado_em timestamptz not null default now()
);
create index on public.mensagens (turma_id, canal, criado_em);

create table public.duvidas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfis on delete cascade,
  texto text not null,
  resolvida boolean not null default false,
  criado_em timestamptz not null default now()
);

create table public.respostas (
  id uuid primary key default gen_random_uuid(),
  duvida_id uuid not null references public.duvidas on delete cascade,
  autor_id uuid default auth.uid() references public.perfis on delete cascade,   -- null = Yara
  texto text not null,
  fontes jsonb not null default '[]',
  confirmada_por uuid references public.perfis on delete set null,
  criado_em timestamptz not null default now()
);

-- Validação coletiva
create table public.propostas (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas on delete cascade,
  tipo text not null check (tipo in ('novo_evento', 'mudar_data', 'cancelar', 'outro')),
  alvo_evento_id uuid references public.eventos on delete cascade,
  titulo text not null,
  dados jsonb not null default '{}',     -- novo_evento/mudar_data: {titulo, tipo, inicio, fim, local}
  origem text not null default 'turma' check (origem in ('turma', 'yara')),
  trecho_origem text,
  status public.status_info not null default 'nao_confirmado',
  criado_por uuid default auth.uid() references public.perfis on delete set null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '72 hours',
  fechada_por uuid references public.perfis on delete set null,
  fechada_em timestamptz
);
create index on public.propostas (turma_id, status);

create table public.votos (
  proposta_id uuid not null references public.propostas on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  valor public.voto_valor not null,
  votado_em timestamptz not null default now(),
  primary key (proposta_id, usuario_id)
);

create table public.reacoes (
  alvo_tipo text not null check (alvo_tipo in ('mensagem', 'material', 'resposta', 'duvida')),
  alvo_id uuid not null,
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  emoji text not null,
  turma_id uuid references public.turmas on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (alvo_tipo, alvo_id, usuario_id, emoji)
);

-- ===================== Operação =====================
create table public.curadoria (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants on delete cascade,
  item_tipo text not null,
  item_id uuid,
  dados jsonb not null default '{}',
  motivo text,
  decisao text check (decisao in ('aprovado', 'rejeitado')),
  decidido_por uuid references public.perfis on delete set null,
  criado_em timestamptz not null default now()
);

create table public.notificacoes (
  id bigserial primary key,
  usuario_id uuid not null references public.perfis on delete cascade,
  tipo text not null,
  titulo text not null,
  payload jsonb not null default '{}',
  lida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index on public.notificacoes (usuario_id, criado_em desc);

create table public.auditoria (
  id bigserial primary key,
  ator_id uuid references public.perfis on delete set null,
  acao text not null,
  alvo text,
  dados jsonb,
  criado_em timestamptz not null default now()
);

-- ===================== Validação coletiva: regra =====================
-- Base = vagas da turma (tamanho_real) ou, se nula, alunos matriculados.
-- Confirma: sim >= max(5, 25% da base) e sim >= 80% dos votos.
-- Descarta: com quórum, não > 50%. Expira: 72 h sem quórum (expirar_propostas).
create or replace function public.quorum_da_turma(t uuid) returns int
language sql stable security definer set search_path = public as $$
  select greatest(5, ceil(coalesce(
    (select tamanho_real from turmas where id = t),
    (select count(*) from matriculas where turma_id = t and papel_turma <> 'professor')) * 0.25))::int
$$;

create or replace function public.aplicar_proposta(p uuid) returns void
language plpgsql security definer set search_path = public as $$
declare pr propostas; tu turmas; d disciplinas; novo public.status_info;
begin
  select * into pr from propostas where id = p;
  novo := case when pr.status = 'oficial' then 'oficial'::public.status_info else 'confirmado_turma'::public.status_info end;
  if pr.tipo = 'novo_evento' then
    select * into tu from turmas where id = pr.turma_id;
    select * into d from disciplinas where id = tu.disciplina_id;
    insert into eventos (tenant_id, escopo, escopo_id, disciplina_id, titulo, tipo, inicio, fim, local,
                         cancelado, origem, status, criado_por)
    select c.tenant_id, 'turma', pr.turma_id, d.id, coalesce(pr.dados ->> 'titulo', pr.titulo),
           coalesce((pr.dados ->> 'tipo')::public.tipo_evento, 'outro'), (pr.dados ->> 'inicio')::timestamptz,
           (pr.dados ->> 'fim')::timestamptz, pr.dados ->> 'local', coalesce((pr.dados ->> 'cancelado')::boolean, false),
           'turma', novo, pr.criado_por
    from cursos c where c.id = d.curso_id;
  elsif pr.tipo = 'mudar_data' and pr.alvo_evento_id is not null then
    update eventos set inicio = coalesce((pr.dados ->> 'inicio')::timestamptz, inicio),
                       fim = coalesce((pr.dados ->> 'fim')::timestamptz, fim),
                       local = coalesce(pr.dados ->> 'local', local),
                       status = novo
    where id = pr.alvo_evento_id;
  elsif pr.tipo = 'cancelar' and pr.alvo_evento_id is not null then
    update eventos set cancelado = true, status = novo where id = pr.alvo_evento_id;
  end if;
end $$;

create or replace function public.avaliar_proposta(p uuid) returns public.status_info
language plpgsql security definer set search_path = public as $$
declare pr propostas; sim int; nao int; q int;
begin
  select * into pr from propostas where id = p;
  if pr.status <> 'nao_confirmado' then return pr.status; end if;
  select count(*) filter (where valor = 'sim'), count(*) filter (where valor = 'nao')
    into sim, nao from votos where proposta_id = p;
  q := quorum_da_turma(pr.turma_id);
  if sim >= q and sim >= 0.8 * (sim + nao) then
    update propostas set status = 'confirmado_turma', fechada_em = now() where id = p;
    perform aplicar_proposta(p);
    return 'confirmado_turma';
  elsif (sim + nao) >= q and nao > 0.5 * (sim + nao) then
    update propostas set status = 'descartado', fechada_em = now() where id = p;
    return 'descartado';
  end if;
  return 'nao_confirmado';
end $$;

create or replace function public.trg_voto() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform avaliar_proposta(coalesce(new.proposta_id, old.proposta_id)); return null; end $$;
create trigger votos_avaliar after insert or update or delete on public.votos
  for each row execute function public.trg_voto();

-- Professor (ou admin) fecha na hora: aceitar = oficial; recusar = descartado.
create or replace function public.fechar_proposta(p uuid, aceitar boolean) returns public.status_info
language plpgsql security definer set search_path = public as $$
declare pr propostas;
begin
  select * into pr from propostas where id = p;
  if not sou_professor_da_turma(pr.turma_id) then raise exception 'so_professor_pode_fechar'; end if;
  if pr.status <> 'nao_confirmado' then return pr.status; end if;
  update propostas set status = case when aceitar then 'oficial' else 'descartado' end::public.status_info,
                       fechada_por = auth.uid(), fechada_em = now()
  where id = p;
  if aceitar then perform aplicar_proposta(p); end if;
  return case when aceitar then 'oficial' else 'descartado' end::public.status_info;
end $$;
grant execute on function public.fechar_proposta(uuid, boolean) to authenticated;

-- Agendar com pg_cron a cada 15 min (docs/setup-supabase.md).
create or replace function public.expirar_propostas() returns int
language sql security definer set search_path = public as $$
  with x as (update propostas set status = 'descartado', fechada_em = now()
             where status = 'nao_confirmado' and expira_em < now() returning 1)
  select count(*)::int from x
$$;

-- Onboarding: entra nas turmas escolhidas e conclui o primeiro acesso de uma vez.
create or replace function public.concluir_onboarding(p_curso uuid, p_semestre int, p_turno text, p_turmas uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  update perfis set curso_id = p_curso, semestre = p_semestre, turno = p_turno, onboarding_concluido = true
  where id = auth.uid();
  insert into matriculas (usuario_id, turma_id)
  select auth.uid(), t from unnest(p_turmas) t
  join turmas tu on tu.id = t join disciplinas d on d.id = tu.disciplina_id
  join cursos c on c.id = d.curso_id and c.tenant_id = meu_tenant()
  on conflict do nothing;
  insert into agenda_preferencias (usuario_id) values (auth.uid()) on conflict do nothing;
end $$;
grant execute on function public.concluir_onboarding(uuid, int, text, uuid[]) to authenticated;

-- ===================== RLS =====================
alter table public.tenants enable row level security;
alter table public.cursos enable row level security;
alter table public.perfis enable row level security;
alter table public.disciplinas enable row level security;
alter table public.turmas enable row level security;
alter table public.matriculas enable row level security;
alter table public.fontes enable row level security;
alter table public.capturas enable row level security;
alter table public.aulas_horario enable row level security;
alter table public.eventos enable row level security;
alter table public.evento_override enable row level security;
alter table public.agenda_preferencias enable row level security;
alter table public.materiais enable row level security;
alter table public.tarefas enable row level security;
alter table public.revisao_itens enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.notas enable row level security;
alter table public.frequencia enable row level security;
alter table public.mensagens enable row level security;
alter table public.duvidas enable row level security;
alter table public.respostas enable row level security;
alter table public.propostas enable row level security;
alter table public.votos enable row level security;
alter table public.reacoes enable row level security;
alter table public.curadoria enable row level security;
alter table public.notificacoes enable row level security;
alter table public.auditoria enable row level security;

-- Estrutura acadêmica: leitura no tenant; escrita só admin.
create policy "tenant: ver o meu" on public.tenants for select using (id = meu_tenant());
create policy "tenant: admin" on public.tenants for update using (sou_admin());
create policy "cursos: ver" on public.cursos for select using (tenant_id = meu_tenant());
create policy "cursos: admin" on public.cursos for all using (sou_admin()) with check (sou_admin());
create policy "disciplinas: ver" on public.disciplinas for select
  using (exists (select 1 from cursos c where c.id = curso_id and c.tenant_id = meu_tenant()));
create policy "disciplinas: admin" on public.disciplinas for all using (sou_admin()) with check (sou_admin());
create policy "turmas: ver" on public.turmas for select
  using (exists (select 1 from disciplinas d join cursos c on c.id = d.curso_id
                 where d.id = disciplina_id and c.tenant_id = meu_tenant()));
create policy "turmas: admin" on public.turmas for all using (sou_admin()) with check (sou_admin());
create policy "aulas: ver" on public.aulas_horario for select
  using (exists (select 1 from turmas t where t.id = turma_id));   -- herda o RLS de turmas
create policy "aulas: admin" on public.aulas_horario for all using (sou_admin()) with check (sou_admin());

-- Perfis: cada um vê e edita o seu (sem mudar papel/tenant); admin vê e edita todos do tenant.
create policy "perfil: ver o meu" on public.perfis for select using (id = auth.uid() or (sou_admin() and tenant_id = meu_tenant()));
create policy "perfil: editar o meu" on public.perfis for update using (id = auth.uid())
  with check (id = auth.uid() and (papel = meu_papel() or sou_admin()) and tenant_id = meu_tenant());
create policy "perfil: admin edita" on public.perfis for update using (sou_admin() and tenant_id = meu_tenant());

create policy "matriculas: ver as da minha turma" on public.matriculas for select
  using (usuario_id = auth.uid() or esta_na_turma(turma_id) or sou_admin());
create policy "matriculas: entrar" on public.matriculas for insert
  with check (usuario_id = auth.uid() and papel_turma = 'aluno');
create policy "matriculas: sair" on public.matriculas for delete using (usuario_id = auth.uid() or sou_admin());

-- Fontes e capturas: admin.
create policy "fontes: ver" on public.fontes for select using (tenant_id = meu_tenant());
create policy "fontes: admin" on public.fontes for all using (sou_admin()) with check (sou_admin());
create policy "capturas: admin" on public.capturas for select using (sou_admin());

-- Eventos
create policy "eventos: ver" on public.eventos for select using (
  tenant_id = meu_tenant() and (
    escopo in ('unidade', 'curso')
    or (escopo = 'turma' and (esta_na_turma(escopo_id) or sou_admin()))
    or (escopo = 'pessoal' and escopo_id = auth.uid())));
create policy "eventos: criar" on public.eventos for insert with check (
  tenant_id = meu_tenant() and (
    (escopo = 'pessoal' and escopo_id = auth.uid())
    or (escopo = 'turma' and sou_professor_da_turma(escopo_id))
    or sou_admin()));
create policy "eventos: editar" on public.eventos for update using (
  (escopo = 'pessoal' and escopo_id = auth.uid())
  or (escopo = 'turma' and sou_professor_da_turma(escopo_id))
  or sou_admin());
create policy "eventos: apagar" on public.eventos for delete using (
  (escopo = 'pessoal' and escopo_id = auth.uid()) or sou_admin());

create policy "override: dono" on public.evento_override for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "agenda_pref: dono" on public.agenda_preferencias for all
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Espaço pessoal
create policy "materiais: ver" on public.materiais for select
  using (dono_id = auth.uid() or (turma_id is not null and esta_na_turma(turma_id)) or sou_admin());
create policy "materiais: criar" on public.materiais for insert
  with check (dono_id = auth.uid() and (turma_id is null or esta_na_turma(turma_id))
              and (not oficial or sou_professor_da_turma(turma_id)));
create policy "materiais: editar" on public.materiais for update
  using (dono_id = auth.uid() or (turma_id is not null and sou_professor_da_turma(turma_id)));
create policy "materiais: apagar" on public.materiais for delete
  using (dono_id = auth.uid() or (turma_id is not null and sou_professor_da_turma(turma_id)));

create policy "tarefas: dono" on public.tarefas for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "revisao: dono" on public.revisao_itens for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "notas: dono" on public.notas for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "frequencia: dono" on public.frequencia for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "avaliacoes: ver" on public.avaliacoes for select using (esta_na_turma(turma_id) or sou_admin());
create policy "avaliacoes: turma cria" on public.avaliacoes for insert with check (esta_na_turma(turma_id));
create policy "avaliacoes: autor ou professor" on public.avaliacoes for update
  using (criado_por = auth.uid() or sou_professor_da_turma(turma_id));
create policy "avaliacoes: apagar" on public.avaliacoes for delete
  using (criado_por = auth.uid() or sou_professor_da_turma(turma_id));

-- Comunidade
create policy "mensagens: turma lê" on public.mensagens for select using (esta_na_turma(turma_id) or sou_admin());
create policy "mensagens: turma escreve" on public.mensagens for insert
  with check (autor_id = auth.uid() and esta_na_turma(turma_id)
              and (canal <> 'avisos' or sou_professor_da_turma(turma_id)));
create policy "mensagens: autor edita" on public.mensagens for update
  using (autor_id = auth.uid() or sou_professor_da_turma(turma_id));
create policy "mensagens: autor apaga" on public.mensagens for delete
  using (autor_id = auth.uid() or sou_professor_da_turma(turma_id));

create policy "duvidas: turma" on public.duvidas for select using (esta_na_turma(turma_id) or sou_admin());
create policy "duvidas: perguntar" on public.duvidas for insert with check (autor_id = auth.uid() and esta_na_turma(turma_id));
create policy "duvidas: autor ou professor" on public.duvidas for update
  using (autor_id = auth.uid() or sou_professor_da_turma(turma_id));
create policy "respostas: turma lê" on public.respostas for select
  using (exists (select 1 from duvidas d where d.id = duvida_id and (esta_na_turma(d.turma_id) or sou_admin())));
create policy "respostas: responder" on public.respostas for insert
  with check (autor_id = auth.uid() and exists (select 1 from duvidas d where d.id = duvida_id and esta_na_turma(d.turma_id)));
create policy "respostas: professor confirma" on public.respostas for update
  using (exists (select 1 from duvidas d where d.id = duvida_id and sou_professor_da_turma(d.turma_id)));

create policy "propostas: turma lê" on public.propostas for select using (esta_na_turma(turma_id) or sou_admin());
create policy "propostas: turma cria" on public.propostas for insert
  with check (criado_por = auth.uid() and esta_na_turma(turma_id) and status = 'nao_confirmado' and origem = 'turma');

create policy "votos: turma vê quem votou" on public.votos for select
  using (exists (select 1 from propostas p where p.id = proposta_id and (esta_na_turma(p.turma_id) or sou_admin())));
create policy "votos: aluno matriculado vota" on public.votos for insert with check (
  usuario_id = auth.uid() and exists (
    select 1 from propostas p join matriculas m on m.turma_id = p.turma_id
    where p.id = proposta_id and p.status = 'nao_confirmado' and p.expira_em > now()
      and m.usuario_id = auth.uid() and m.papel_turma in ('aluno', 'monitor', 'representante')));
create policy "votos: mudar o meu" on public.votos for update using (
  usuario_id = auth.uid() and exists (select 1 from propostas p where p.id = proposta_id and p.status = 'nao_confirmado'));
create policy "votos: tirar o meu" on public.votos for delete using (
  usuario_id = auth.uid() and exists (select 1 from propostas p where p.id = proposta_id and p.status = 'nao_confirmado'));

create policy "reacoes: ver" on public.reacoes for select using (turma_id is null or esta_na_turma(turma_id));
create policy "reacoes: minhas" on public.reacoes for insert with check (usuario_id = auth.uid() and (turma_id is null or esta_na_turma(turma_id)));
create policy "reacoes: tirar" on public.reacoes for delete using (usuario_id = auth.uid());

create policy "curadoria: admin" on public.curadoria for all using (sou_admin()) with check (sou_admin());
create policy "notificacoes: dono" on public.notificacoes for select using (usuario_id = auth.uid());
create policy "notificacoes: marcar lida" on public.notificacoes for update using (usuario_id = auth.uid());
create policy "auditoria: admin" on public.auditoria for select using (sou_admin());

-- ===================== Realtime =====================
-- Conversa, votos e agenda atualizam sem recarregar.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.mensagens, public.votos, public.propostas,
      public.eventos, public.reacoes, public.respostas;
  end if;
end $$;
