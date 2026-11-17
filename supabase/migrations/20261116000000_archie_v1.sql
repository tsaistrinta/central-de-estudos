-- Archie v1 (Fase 5): coletor, extração e curadoria que se aplica sozinha.
-- Rodar DEPOIS de 20261103000001_archie.sql (precisa do pgmq).
--
-- Ideia central: tudo o que o Archie quer mudar vira uma linha em `curadoria`.
--   * confiança alta  → o worker chama aplicar_curadoria() na hora (decisao = 'aprovado', decidido_por = null);
--   * confiança média → publica como "provável" e deixa um item pendente para o admin;
--   * confiança baixa → só o item pendente. O admin aprova ou recusa em /admin/curadoria.
-- Assim a regra de aplicar mora num lugar só (aqui) e a curadoria vira o histórico do que o Archie fez.

-- ===================== Segurança: funções internas =====================
-- O Postgres dá EXECUTE a PUBLIC em toda função nova (e o Supabase repete isso para anon/authenticated).
-- Estas funções são security definer e só devem rodar por dentro (triggers, pg_cron, outras funções).
revoke execute on function public.aplicar_proposta(uuid) from public, anon, authenticated;
revoke execute on function public.avaliar_proposta(uuid) from public, anon, authenticated;
revoke execute on function public.expirar_propostas() from public, anon, authenticated;
revoke execute on function public.trg_voto() from public, anon, authenticated;
revoke execute on function public.criar_perfil() from public, anon, authenticated;

-- ===================== Fontes e capturas =====================
alter table public.fontes
  add column extrator text not null default 'geral'
    check (extrator in ('calendario', 'grade', 'avisos', 'geral')),
  add column ultimo_erro text;

comment on column public.fontes.extrator is
  'Como o Archie lê a fonte: calendario (PDF do calendário acadêmico), grade (PDFs de horário por curso), avisos (imagens da home), geral (só guarda o texto).';

alter table public.capturas
  add column titulo text,
  add column itens int not null default 0,
  add column erro text;
create index capturas_documento on public.capturas (fonte_id, conteudo_url, capturado_em desc);

-- Fontes do seed: extrator certo e o endereço que o site usa de verdade (com index.php).
update public.fontes set extrator = 'avisos' where url ~ 'fatecid\.com\.br/site/?$';
update public.fontes set extrator = 'calendario', tipo = 'pagina',
  url = 'https://www.fatecid.com.br/site/index.php/calendario-academico/' where url ~ 'calendario-academico';
update public.fontes set extrator = 'grade',
  url = 'https://www.fatecid.com.br/site/index.php/grade-de-horarios-e-salas/' where url ~ 'grade-de-horarios';
update public.fontes set url = 'https://www.fatecid.com.br/site/index.php/editais/' where url ~ '/site/editais';

-- ===================== Curadoria =====================
alter table public.curadoria
  add column fonte_id uuid references public.fontes on delete set null,
  add column captura_id bigint references public.capturas on delete set null,
  add column confianca numeric(3, 2),
  add column resumo text,                 -- frase curta para o admin ("Feriado em 20/11 · Consciência Negra")
  add column decidido_em timestamptz;
create index curadoria_pendente on public.curadoria (tenant_id, criado_em desc) where decisao is null;
create index curadoria_item on public.curadoria (item_id) where item_id is not null;

alter table public.curadoria drop constraint if exists curadoria_item_tipo_check;
alter table public.curadoria add constraint curadoria_item_tipo_check check (item_tipo in (
  'evento_novo',      -- dados.evento → cria o evento
  'evento_provavel',  -- item_id = evento publicado como provável; aprovar = oficial, recusar = descartado
  'evento_mudanca',   -- item_id = evento; dados.campos → novos valores (inicio, fim, titulo, local)
  'evento_sumiu',     -- item_id = evento que não aparece mais na nova versão do documento; aprovar = cancelar
  'grade_turma',      -- item_id = turma; dados.aulas[] e dados.professor_nome → troca a grade da turma
  'disciplina_nova'   -- dados.disciplina (com ou sem id), dados.turma, dados.aulas[] → cria o que falta
));

-- ===================== Status do worker =====================
create table public.archie_status (
  worker text primary key,               -- nome da máquina (ARCHIE_WORKER)
  tenant_id uuid references public.tenants on delete cascade,
  versao text,
  modelos jsonb not null default '{}',
  iniciado_em timestamptz,
  ultimo_sinal timestamptz not null default now(),
  tarefa_atual text,
  processadas int not null default 0,
  erros int not null default 0,
  ultimo_erro text
);
alter table public.archie_status enable row level security;
create policy "archie_status: admin" on public.archie_status for select using (public.sou_admin());

-- ===================== Avisos para quem é afetado =====================
-- Quem editou a própria versão de um evento oficial recebe "a data oficial mudou, aplicar?".
create or replace function public.avisar_mudanca_evento(p_evento uuid, p_titulo text, p_payload jsonb)
returns int language sql security definer set search_path = public as $$
  with x as (
    insert into notificacoes (usuario_id, tipo, titulo, payload)
    select o.usuario_id, 'evento_oficial_mudou', p_titulo, p_payload || jsonb_build_object('evento_id', p_evento)
    from evento_override o where o.evento_id = p_evento
    returning 1)
  select count(*)::int from x
$$;
revoke execute on function public.avisar_mudanca_evento(uuid, text, jsonb) from public, anon, authenticated;

-- ===================== Aplicar um item da curadoria =====================
-- Uso interno: o worker (conexão do banco) e decidir_curadoria(). Devolve o id criado/alterado.
create or replace function public.aplicar_curadoria(p_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c curadoria;
  e jsonb;
  campos jsonb;
  alvo uuid;
  antes eventos;
  v_curso uuid;
  v_disc uuid;
  v_turma uuid;
  n int;
begin
  select * into c from curadoria where id = p_id for update;
  if not found then raise exception 'curadoria_nao_encontrada'; end if;

  if c.item_tipo = 'evento_novo' then
    e := c.dados -> 'evento';
    insert into eventos (tenant_id, escopo, escopo_id, disciplina_id, titulo, tipo, inicio, fim, dia_todo, local,
                         descricao, origem, fonte_id, documento_url, confianca, status, cancelado, criado_por)
    values (c.tenant_id, (e ->> 'escopo')::escopo_evento, (e ->> 'escopo_id')::uuid, (e ->> 'disciplina_id')::uuid,
            e ->> 'titulo', coalesce((e ->> 'tipo')::tipo_evento, 'outro'), (e ->> 'inicio')::timestamptz,
            (e ->> 'fim')::timestamptz, coalesce((e ->> 'dia_todo')::boolean, false), e ->> 'local',
            e ->> 'descricao', 'archie', c.fonte_id, e ->> 'documento_url', c.confianca,
            coalesce((e ->> 'status')::status_info, 'oficial'), false, null)
    returning id into alvo;

  elsif c.item_tipo = 'evento_provavel' then
    update eventos set status = 'oficial' where id = c.item_id;
    alvo := c.item_id;

  elsif c.item_tipo = 'evento_mudanca' then
    campos := c.dados -> 'campos';
    select * into antes from eventos where id = c.item_id;
    if not found then raise exception 'evento_nao_encontrado'; end if;
    if antes.origem not in ('archie', 'importado') then raise exception 'evento_nao_e_da_archie'; end if;
    update eventos set
      titulo = coalesce(campos ->> 'titulo', titulo),
      inicio = coalesce((campos ->> 'inicio')::timestamptz, inicio),
      fim = case when campos ? 'fim' then (campos ->> 'fim')::timestamptz else fim end,
      dia_todo = coalesce((campos ->> 'dia_todo')::boolean, dia_todo),
      local = case when campos ? 'local' then campos ->> 'local' else local end,
      documento_url = coalesce(c.dados ->> 'documento_url', documento_url),
      fonte_id = coalesce(c.fonte_id, fonte_id),
      origem = 'archie', status = 'oficial', confianca = coalesce(c.confianca, confianca)
    where id = c.item_id;
    perform avisar_mudanca_evento(c.item_id, 'A data oficial mudou: ' || antes.titulo,
      jsonb_build_object('antes', jsonb_build_object('inicio', antes.inicio, 'fim', antes.fim), 'depois', campos));
    alvo := c.item_id;

  elsif c.item_tipo = 'evento_sumiu' then
    update eventos set cancelado = true where id = c.item_id and origem in ('archie', 'importado');
    if found then
      perform avisar_mudanca_evento(c.item_id, 'Saiu do calendário oficial',
        jsonb_build_object('motivo', 'nao_aparece_mais'));
    end if;
    alvo := c.item_id;

  elsif c.item_tipo = 'grade_turma' then
    update turmas set professor_nome = coalesce(c.dados ->> 'professor_nome', professor_nome),
                      fonte = 'archie'
    where id = c.item_id;
    delete from aulas_horario where turma_id = c.item_id;
    insert into aulas_horario (turma_id, dia_semana, inicio, fim, sala, fonte_id)
    select c.item_id, (a ->> 'dia_semana')::int, (a ->> 'inicio')::time, (a ->> 'fim')::time, a ->> 'sala', c.fonte_id
    from jsonb_array_elements(coalesce(c.dados -> 'aulas', '[]')) a;
    insert into notificacoes (usuario_id, tipo, titulo, payload)
    select m.usuario_id, 'grade_mudou', 'O horário de ' || coalesce(c.dados ->> 'disciplina_nome', 'uma matéria') || ' mudou',
           jsonb_build_object('turma_id', c.item_id)
    from matriculas m where m.turma_id = c.item_id;
    alvo := c.item_id;

  elsif c.item_tipo = 'disciplina_nova' then
    -- dados.disciplina.id preenchido = disciplina já existe, só falta a turma do período.
    v_disc := (c.dados -> 'disciplina' ->> 'id')::uuid;
    if v_disc is null then
      v_curso := (c.dados -> 'disciplina' ->> 'curso_id')::uuid;
      select count(*) into n from disciplinas where curso_id = v_curso;
      insert into disciplinas (curso_id, nome, sigla, semestre_matriz, cor)
      values (v_curso, c.dados -> 'disciplina' ->> 'nome', c.dados -> 'disciplina' ->> 'sigla',
              (c.dados -> 'disciplina' ->> 'semestre_matriz')::int,
              (enum_range(null::cor_materia))[1 + n % 8])
      returning id into v_disc;
    end if;
    insert into turmas (disciplina_id, periodo_letivo, turno, professor_nome, fonte)
    values (v_disc, c.dados -> 'turma' ->> 'periodo_letivo', c.dados -> 'turma' ->> 'turno',
            c.dados -> 'turma' ->> 'professor_nome', 'archie')
    on conflict (disciplina_id, periodo_letivo, turno) do update set professor_nome = excluded.professor_nome
    returning id into v_turma;
    insert into aulas_horario (turma_id, dia_semana, inicio, fim, sala, fonte_id)
    select v_turma, (a ->> 'dia_semana')::int, (a ->> 'inicio')::time, (a ->> 'fim')::time, a ->> 'sala', c.fonte_id
    from jsonb_array_elements(coalesce(c.dados -> 'aulas', '[]')) a;
    alvo := v_turma;

  else
    raise exception 'tipo_de_curadoria_desconhecido: %', c.item_tipo;
  end if;

  update curadoria set decisao = 'aprovado', decidido_em = now(),
                       item_id = coalesce(item_id, alvo)
  where id = p_id;
  return alvo;
end $$;
revoke execute on function public.aplicar_curadoria(uuid) from public, anon, authenticated;

-- Admin aprova ou recusa um item pendente.
create or replace function public.decidir_curadoria(p_id uuid, p_aprovar boolean) returns void
language plpgsql security definer set search_path = public as $$
declare c curadoria;
begin
  if not sou_admin() then raise exception 'so_admin'; end if;
  select * into c from curadoria where id = p_id and tenant_id = meu_tenant();
  if not found then raise exception 'curadoria_nao_encontrada'; end if;
  if c.decisao is not null then return; end if;
  if p_aprovar then
    perform aplicar_curadoria(p_id);
  else
    if c.item_tipo = 'evento_provavel' then
      update eventos set status = 'descartado' where id = c.item_id and origem = 'archie';
    end if;
    update curadoria set decisao = 'rejeitado', decidido_em = now() where id = p_id;
  end if;
  update curadoria set decidido_por = auth.uid() where id = p_id;
  insert into auditoria (ator_id, acao, alvo, dados)
  values (auth.uid(), case when p_aprovar then 'curadoria_aprovada' else 'curadoria_recusada' end,
          c.item_tipo, jsonb_build_object('curadoria_id', p_id, 'item_id', c.item_id, 'resumo', c.resumo));
end $$;
revoke execute on function public.decidir_curadoria(uuid, boolean) from public, anon;
grant execute on function public.decidir_curadoria(uuid, boolean) to authenticated;

-- ===================== Botão "Verificar agora" =====================
create or replace function public.archie_pedir_coleta(p_fonte uuid) returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if not sou_admin() then raise exception 'so_admin'; end if;
  if not exists (select 1 from fontes where id = p_fonte and tenant_id = meu_tenant()) then
    raise exception 'fonte_nao_encontrada';
  end if;
  return (select pgmq.send('archie_jobs',
    jsonb_build_object('tipo', 'coletar', 'fonte_id', p_fonte, 'forcar', true, 'pedido_por', auth.uid())));
end $$;
revoke execute on function public.archie_pedir_coleta(uuid) from public, anon;
grant execute on function public.archie_pedir_coleta(uuid) to authenticated;

-- O admin vê na tela o resultado das últimas visitas.
create or replace view public.ultimas_capturas with (security_invoker = true) as
  select distinct on (c.fonte_id) c.fonte_id, c.id, c.hash, c.conteudo_url, c.titulo, c.itens, c.erro, c.mudou, c.capturado_em
  from public.capturas c
  order by c.fonte_id, c.capturado_em desc;
grant select on public.ultimas_capturas to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.curadoria, public.archie_status;
  end if;
end $$;
