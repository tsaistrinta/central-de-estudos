-- Entrada verificada nas turmas, acervo permanente por disciplina com moderação do Archie,
-- quarentena e ajustes de segurança. Rodar depois de 20261116000000_archie_v1.sql.

-- ===================== 1. Entrada nas turmas =====================
-- Antes, qualquer aluno podia se matricular sozinho em qualquer turma. Agora só por:
--   (a) código de entrada que o professor (ou o admin) passa para a turma, ou
--   (b) pedido aprovado pelo professor da turma ou pelo admin.
drop policy if exists "matriculas: entrar" on public.matriculas;

create or replace function public.turma_do_meu_tenant(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from turmas tu join disciplinas d on d.id = tu.disciplina_id
                 join cursos c on c.id = d.curso_id where tu.id = t and c.tenant_id = meu_tenant())
$$;

-- Pode aprovar pedidos e ver/gerar o código: professor da turma ou admin.
create or replace function public.pode_aprovar_turma(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (sou_admin() and turma_do_meu_tenant(t)) or exists (select 1 from turmas where id = t and professor_id = auth.uid())
$$;

create table public.turma_codigos (
  turma_id uuid primary key references public.turmas on delete cascade,
  codigo text not null,
  gerado_por uuid references public.perfis on delete set null,
  gerado_em timestamptz not null default now()
);
create unique index turma_codigos_codigo on public.turma_codigos (upper(codigo));
alter table public.turma_codigos enable row level security;
create policy "codigos: quem aprova vê" on public.turma_codigos for select using (pode_aprovar_turma(turma_id));

create table public.pedidos_turma (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  mensagem text check (char_length(mensagem) <= 300),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado', 'cancelado')),
  criado_em timestamptz not null default now(),
  decidido_por uuid references public.perfis on delete set null,
  decidido_em timestamptz
);
create unique index pedidos_turma_um_pendente on public.pedidos_turma (turma_id, usuario_id) where status = 'pendente';
create index on public.pedidos_turma (turma_id, status);
alter table public.pedidos_turma enable row level security;
create policy "pedidos: ver" on public.pedidos_turma for select
  using (usuario_id = auth.uid() or pode_aprovar_turma(turma_id));

-- Tentativas erradas de código (contra adivinhação): sem política, só as funções mexem.
create table public.tentativas_codigo (
  id bigserial primary key,
  usuario_id uuid not null references public.perfis on delete cascade,
  criado_em timestamptz not null default now()
);
create index on public.tentativas_codigo (usuario_id, criado_em desc);
alter table public.tentativas_codigo enable row level security;


create or replace function public.avisar_quem_aprova(t uuid, p_titulo text, p_payload jsonb) returns void
language sql security definer set search_path = public as $$
  insert into notificacoes (usuario_id, tipo, titulo, payload)
  select distinct u, 'pedido_turma', p_titulo, p_payload from (
    select professor_id u from turmas where id = t and professor_id is not null
    union select p.id from perfis p where p.papel = 'admin' and p.tenant_id = meu_tenant()
  ) x where u is not null and u <> auth.uid()
$$;

create or replace function public.pedir_entrada(p_turma uuid, p_mensagem text default null) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'precisa_entrar'; end if;
  if not turma_do_meu_tenant(p_turma) then raise exception 'turma_nao_encontrada'; end if;
  if exists (select 1 from matriculas where turma_id = p_turma and usuario_id = auth.uid()) then return 'ja_na_turma'; end if;
  if exists (select 1 from pedidos_turma where turma_id = p_turma and usuario_id = auth.uid() and status = 'pendente') then
    return 'pendente';
  end if;
  if (select count(*) from pedidos_turma where usuario_id = auth.uid() and status = 'pendente') >= 15 then
    raise exception 'pedidos_demais';
  end if;
  insert into pedidos_turma (turma_id, mensagem) values (p_turma, nullif(trim(p_mensagem), ''));
  perform avisar_quem_aprova(p_turma, 'Pedido para entrar na turma',
    jsonb_build_object('turma_id', p_turma, 'usuario_id', auth.uid()));
  return 'pendente';
end $$;

create or replace function public.cancelar_pedido(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update pedidos_turma set status = 'cancelado', decidido_em = now()
  where id = p_id and usuario_id = auth.uid() and status = 'pendente'
$$;

create or replace function public.decidir_pedido(p_id uuid, p_aprovar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare p pedidos_turma;
begin
  select * into p from pedidos_turma where id = p_id for update;
  if p.id is null or p.status <> 'pendente' then raise exception 'pedido_nao_encontrado'; end if;
  if not pode_aprovar_turma(p.turma_id) then raise exception 'sem_permissao'; end if;
  update pedidos_turma set status = case when p_aprovar then 'aprovado' else 'recusado' end,
         decidido_por = auth.uid(), decidido_em = now() where id = p_id;
  if p_aprovar then
    insert into matriculas (usuario_id, turma_id) values (p.usuario_id, p.turma_id) on conflict do nothing;
  end if;
  insert into notificacoes (usuario_id, tipo, titulo, payload) values (p.usuario_id, 'pedido_turma',
    case when p_aprovar then 'Você entrou na turma' else 'Seu pedido para entrar na turma foi recusado' end,
    jsonb_build_object('turma_id', p.turma_id, 'aprovado', p_aprovar));
end $$;

-- Código de 6 caracteres sem letras ou números que se confundem (0/O, 1/I/L).
create or replace function public.gerar_codigo_turma(p_turma uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  novo text;
begin
  if not pode_aprovar_turma(p_turma) then raise exception 'sem_permissao'; end if;
  loop
    select string_agg(substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1), '') into novo
    from generate_series(1, 6);
    exit when not exists (select 1 from turma_codigos where upper(codigo) = novo);
  end loop;
  insert into turma_codigos (turma_id, codigo, gerado_por) values (p_turma, novo, auth.uid())
  on conflict (turma_id) do update set codigo = excluded.codigo, gerado_por = excluded.gerado_por, gerado_em = now();
  return novo;
end $$;

create or replace function public.apagar_codigo_turma(p_turma uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not pode_aprovar_turma(p_turma) then raise exception 'sem_permissao'; end if;
  delete from turma_codigos where turma_id = p_turma;
end $$;

-- O aluno digita o código e entra direto. 8 erros por hora bloqueiam novas tentativas.
create or replace function public.entrar_com_codigo(p_codigo text) returns uuid
language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'precisa_entrar'; end if;
  if (select count(*) from tentativas_codigo where usuario_id = auth.uid() and criado_em > now() - interval '1 hour') >= 8 then
    raise exception 'tentativas_demais';
  end if;
  select tc.turma_id into t from turma_codigos tc
  where upper(tc.codigo) = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'))
    and turma_do_meu_tenant(tc.turma_id);
  if t is null then
    insert into tentativas_codigo (usuario_id) values (auth.uid());
    raise exception 'codigo_invalido';
  end if;
  insert into matriculas (usuario_id, turma_id) values (auth.uid(), t) on conflict do nothing;
  update pedidos_turma set status = 'aprovado', decidido_em = now()
  where turma_id = t and usuario_id = auth.uid() and status = 'pendente';
  return t;
end $$;

-- Primeiro acesso: as turmas escolhidas viram pedidos (antes viravam matrícula direto).
create or replace function public.concluir_onboarding(p_curso uuid, p_semestre int, p_turno text, p_turmas uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare t uuid;
begin
  if auth.uid() is null then raise exception 'precisa_entrar'; end if;
  update perfis set curso_id = p_curso, semestre = p_semestre, turno = p_turno, onboarding_concluido = true
  where id = auth.uid();
  foreach t in array coalesce(p_turmas, '{}') loop
    if turma_do_meu_tenant(t) then perform pedir_entrada(t, null); end if;
  end loop;
  insert into agenda_preferencias (usuario_id) values (auth.uid()) on conflict do nothing;
end $$;

-- Admin: todos os pedidos pendentes do tenant, com o nome de quem pediu.
create or replace function public.pedidos_pendentes() returns table (
  id uuid, turma_id uuid, usuario_id uuid, nome text, email text, mensagem text, criado_em timestamptz,
  disciplina text, semestre_matriz int, turno text)
language sql stable security definer set search_path = public as $$
  select p.id, p.turma_id, p.usuario_id, pe.nome, pe.email, p.mensagem, p.criado_em, d.nome, d.semestre_matriz, tu.turno
  from pedidos_turma p join perfis pe on pe.id = p.usuario_id
  join turmas tu on tu.id = p.turma_id join disciplinas d on d.id = tu.disciplina_id
  where p.status = 'pendente' and pode_aprovar_turma(p.turma_id) and turma_do_meu_tenant(p.turma_id)
  order by p.criado_em
$$;

-- ===================== 2. Acervo permanente da disciplina =====================
-- Fica de um semestre para o outro. Todo envio passa pelo Archie antes de aparecer.
create or replace function public.cursa_disciplina(d uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select sou_admin()
      or exists (select 1 from matriculas m join turmas t on t.id = m.turma_id
                 where t.disciplina_id = d and m.usuario_id = auth.uid())
      or exists (select 1 from turmas t where t.disciplina_id = d and t.professor_id = auth.uid())
$$;

create table public.acervo_itens (
  id uuid primary key default gen_random_uuid(),
  disciplina_id uuid not null references public.disciplinas on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfis on delete cascade,
  tipo text not null default 'outro'
    check (tipo in ('prova_antiga', 'resumo', 'lista', 'trabalho', 'slides', 'livro_apostila', 'outro')),
  titulo text not null check (char_length(titulo) between 3 and 140),
  descricao text check (char_length(descricao) <= 1000),
  periodo_origem text,                 -- ex.: 2026/2
  link_url text check (link_url is null or link_url ~* '^https://'),
  arquivo_chave text,
  arquivo_nome text,
  arquivo_tamanho bigint check (arquivo_tamanho is null or arquivo_tamanho <= 26214400),
  arquivo_mime text,
  status text not null default 'em_analise' check (status in ('em_analise', 'publicado', 'quarentena', 'removido')),
  moderacao jsonb,                     -- o que o Archie concluiu (motivo, categorias, confiança, hash, modelo…)
  moderado_em timestamptz,
  revisado_por uuid references public.perfis on delete set null,
  revisado_em timestamptz,
  criado_em timestamptz not null default now(),
  check (arquivo_chave is not null or link_url is not null)
);
create index on public.acervo_itens (disciplina_id, status, criado_em desc);
create index on public.acervo_itens (autor_id);
create index on public.acervo_itens (status) where status in ('em_analise', 'quarentena');
alter table public.acervo_itens enable row level security;

-- Publicado: quem cursa ou cursou a disciplina. O autor vê os próprios em qualquer estado. Admin vê tudo.
create policy "acervo: ver" on public.acervo_itens for select using (
  autor_id = auth.uid() or sou_admin() or (status = 'publicado' and cursa_disciplina(disciplina_id)));
create policy "acervo: enviar" on public.acervo_itens for insert with check (
  autor_id = auth.uid() and cursa_disciplina(disciplina_id)
  and (arquivo_chave is null or arquivo_chave like auth.uid()::text || '/%'));
create policy "acervo: autor apaga" on public.acervo_itens for delete using (autor_id = auth.uid() or sou_admin());

-- Ninguém escolhe o próprio status: todo envio entra "em análise" e vai para a fila do Archie.
create or replace function public.acervo_ao_enviar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.status := 'em_analise';
  new.moderacao := null; new.moderado_em := null; new.revisado_por := null; new.revisado_em := null;
  return new;
end $$;
create trigger acervo_ao_enviar before insert on public.acervo_itens
  for each row execute function public.acervo_ao_enviar();

create or replace function public.acervo_enfileirar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform pgmq.send('archie_jobs', jsonb_build_object('tipo', 'moderar_acervo', 'item_id', new.id));
  return null;
end $$;
create trigger acervo_enfileirar after insert on public.acervo_itens
  for each row execute function public.acervo_enfileirar();

-- Denúncias da comunidade: 3 denúncias tiram o item do ar e mandam para a quarentena.
create table public.acervo_denuncias (
  item_id uuid not null references public.acervo_itens on delete cascade,
  usuario_id uuid not null default auth.uid() references public.perfis on delete cascade,
  motivo text not null check (char_length(motivo) between 3 and 300),
  criado_em timestamptz not null default now(),
  primary key (item_id, usuario_id)
);
alter table public.acervo_denuncias enable row level security;
create policy "denuncias: ver as minhas" on public.acervo_denuncias for select using (usuario_id = auth.uid() or sou_admin());
create policy "denuncias: denunciar" on public.acervo_denuncias for insert with check (
  usuario_id = auth.uid() and exists (select 1 from acervo_itens i where i.id = item_id and i.status = 'publicado'
                                      and cursa_disciplina(i.disciplina_id)));

create or replace function public.acervo_contar_denuncias() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from acervo_denuncias where item_id = new.item_id) >= 3 then
    update acervo_itens set status = 'quarentena', moderado_em = now(),
      moderacao = coalesce(moderacao, '{}'::jsonb) || jsonb_build_object('motivo', 'Retirado após 3 denúncias da comunidade.',
                                                                        'origem', 'denuncias')
    where id = new.item_id and status = 'publicado';
  end if;
  return null;
end $$;
create trigger acervo_contar_denuncias after insert on public.acervo_denuncias
  for each row execute function public.acervo_contar_denuncias();

-- Uso interno do worker do Archie (conexão própria): grava a decisão da moderação.
create or replace function public.archie_moderar(p_item uuid, p_publicar boolean, p_moderacao jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid; t text;
begin
  update acervo_itens set status = case when p_publicar then 'publicado' else 'quarentena' end,
         moderacao = p_moderacao, moderado_em = now()
  where id = p_item and status = 'em_analise' returning autor_id, titulo into a, t;
  if a is not null and not p_publicar then
    insert into notificacoes (usuario_id, tipo, titulo, payload) values (a, 'acervo',
      'Seu envio ao acervo ficou retido para revisão', jsonb_build_object('item_id', p_item, 'titulo', t));
  end if;
end $$;

-- Admin decide o que está na quarentena: publicar (liberar) ou remover de vez.
create or replace function public.decidir_quarentena(p_item uuid, p_publicar boolean, p_nota text default null) returns void
language plpgsql security definer set search_path = public as $$
declare a uuid; t text;
begin
  if not sou_admin() then raise exception 'so_admin'; end if;
  update acervo_itens set status = case when p_publicar then 'publicado' else 'removido' end,
         revisado_por = auth.uid(), revisado_em = now(),
         moderacao = coalesce(moderacao, '{}'::jsonb) || jsonb_build_object('nota_admin', nullif(trim(p_nota), ''))
  where id = p_item and status in ('quarentena', 'em_analise')
    and exists (select 1 from disciplinas d join cursos c on c.id = d.curso_id
                where d.id = disciplina_id and c.tenant_id = meu_tenant())
  returning autor_id, titulo into a, t;
  if a is null then raise exception 'item_nao_encontrado'; end if;
  insert into notificacoes (usuario_id, tipo, titulo, payload) values (a, 'acervo',
    case when p_publicar then 'Seu envio foi publicado no acervo' else 'Seu envio ao acervo foi removido' end,
    jsonb_build_object('item_id', p_item, 'titulo', t));
end $$;

-- Quarentena para o admin: quem enviou, quando, o arquivo, o motivo e o histórico do autor.
create or replace function public.listar_quarentena() returns table (
  id uuid, status text, titulo text, tipo text, descricao text, link_url text,
  arquivo_chave text, arquivo_nome text, arquivo_tamanho bigint, arquivo_mime text,
  criado_em timestamptz, moderado_em timestamptz, moderacao jsonb,
  disciplina text, autor_id uuid, autor_nome text, autor_email text, autor_curso text, autor_semestre int,
  autor_envios int, autor_retidos int, denuncias int)
language sql stable security definer set search_path = public as $$
  select i.id, i.status, i.titulo, i.tipo, i.descricao, i.link_url,
         i.arquivo_chave, i.arquivo_nome, i.arquivo_tamanho, i.arquivo_mime,
         i.criado_em, i.moderado_em, i.moderacao,
         d.nome, p.id, p.nome, p.email, cu.nome, p.semestre,
         (select count(*)::int from acervo_itens x where x.autor_id = p.id),
         (select count(*)::int from acervo_itens x where x.autor_id = p.id and x.status in ('quarentena', 'removido')),
         (select count(*)::int from acervo_denuncias x where x.item_id = i.id)
  from acervo_itens i join disciplinas d on d.id = i.disciplina_id join cursos c on c.id = d.curso_id
  join perfis p on p.id = i.autor_id left join cursos cu on cu.id = p.curso_id
  where sou_admin() and c.tenant_id = meu_tenant() and i.status in ('quarentena', 'em_analise')
  order by (i.status = 'quarentena') desc, i.criado_em desc
$$;

-- ===================== 3. Segurança =====================
-- Funções internas: ninguém de fora chama direto (o Postgres dá EXECUTE a todos por padrão).
revoke execute on function public.archie_moderar(uuid, boolean, jsonb) from public, anon, authenticated;
revoke execute on function public.avisar_quem_aprova(uuid, text, jsonb) from public, anon, authenticated;
revoke execute on function public.acervo_ao_enviar() from public, anon, authenticated;
revoke execute on function public.acervo_enfileirar() from public, anon, authenticated;
revoke execute on function public.acervo_contar_denuncias() from public, anon, authenticated;

-- Funções para quem está logado (nunca para visitante anônimo).
do $$
declare f text;
begin
  foreach f in array array[
    'public.pode_aprovar_turma(uuid)', 'public.turma_do_meu_tenant(uuid)', 'public.cursa_disciplina(uuid)',
    'public.pedir_entrada(uuid, text)', 'public.cancelar_pedido(uuid)', 'public.decidir_pedido(uuid, boolean)',
    'public.gerar_codigo_turma(uuid)', 'public.apagar_codigo_turma(uuid)', 'public.entrar_com_codigo(text)',
    'public.pedidos_pendentes()', 'public.decidir_quarentena(uuid, boolean, text)', 'public.listar_quarentena()',
    'public.concluir_onboarding(uuid, integer, text, uuid[])', 'public.fechar_proposta(uuid, boolean)',
    'public.meu_papel()', 'public.meu_tenant()', 'public.sou_admin()', 'public.esta_na_turma(uuid)',
    'public.quorum_da_turma(uuid)', 'public.sou_professor_da_turma(uuid)']
  loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

alter function public.tocar_atualizado_em() set search_path = public;
do $$
declare f regprocedure;
begin
  for f in select oid::regprocedure from pg_proc where proname = 'eventos_padrao' and pronamespace = 'public'::regnamespace loop
    execute format('alter function %s set search_path = public', f);
  end loop;
end $$;

-- Tempo real para quem aprova ver os pedidos chegarem e o aluno ver o acervo mudar de estado.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.pedidos_turma, public.acervo_itens;
  end if;
end $$;
