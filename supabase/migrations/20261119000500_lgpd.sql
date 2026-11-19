-- LGPD (art. 18): o aluno baixa todos os seus dados e exclui a própria conta sozinho, sem pedir a ninguém.
-- Ao excluir, o que é só dele some; o que ele publicou para a turma (mensagens, dúvidas, respostas, acervo)
-- fica sem autor ("Ex-aluno"), para a conversa e o acervo da disciplina não ficarem com buracos.

-- 1) Conteúdo da comunidade passa a ficar sem autor quando a conta é excluída (antes era apagado junto).
alter table public.mensagens alter column autor_id drop not null;
alter table public.mensagens drop constraint if exists mensagens_autor_id_fkey,
  add constraint mensagens_autor_id_fkey foreign key (autor_id) references public.perfis on delete set null;
alter table public.duvidas alter column autor_id drop not null;
alter table public.duvidas drop constraint if exists duvidas_autor_id_fkey,
  add constraint duvidas_autor_id_fkey foreign key (autor_id) references public.perfis on delete set null;
alter table public.respostas drop constraint if exists respostas_autor_id_fkey,
  add constraint respostas_autor_id_fkey foreign key (autor_id) references public.perfis on delete set null;
alter table public.acervo_itens alter column autor_id drop not null;
alter table public.acervo_itens drop constraint if exists acervo_itens_autor_id_fkey,
  add constraint acervo_itens_autor_id_fkey foreign key (autor_id) references public.perfis on delete set null;
-- Material compartilhado com a turma também fica (sem dono); o material privado é apagado pela função abaixo.
alter table public.materiais alter column dono_id drop not null;
alter table public.materiais drop constraint if exists materiais_dono_id_fkey,
  add constraint materiais_dono_id_fkey foreign key (dono_id) references public.perfis on delete set null;

-- 2) Exportar: tudo o que é do aluno, num JSON só.
create or replace function public.exportar_meus_dados() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare eu uuid := auth.uid();
begin
  if eu is null then raise exception 'precisa_entrar'; end if;
  return jsonb_build_object(
    'gerado_em', now(),
    'aviso', 'Dados pessoais da sua conta na Central de Estudos (LGPD, art. 18).',
    'perfil', (select to_jsonb(p) from perfis p where p.id = eu),
    'matriculas', coalesce((select jsonb_agg(jsonb_build_object('turma_id', m.turma_id, 'disciplina', d.nome,
                     'periodo', t.periodo_letivo, 'desde', m.criado_em))
                   from matriculas m join turmas t on t.id = m.turma_id join disciplinas d on d.id = t.disciplina_id
                   where m.usuario_id = eu), '[]'),
    'pedidos_de_entrada', coalesce((select jsonb_agg(to_jsonb(x)) from pedidos_turma x where x.usuario_id = eu), '[]'),
    'agenda_pessoal', coalesce((select jsonb_agg(to_jsonb(x)) from eventos x where x.escopo = 'pessoal' and x.escopo_id = eu), '[]'),
    'ajustes_em_eventos', coalesce((select jsonb_agg(to_jsonb(x)) from evento_override x where x.usuario_id = eu), '[]'),
    'preferencias_da_agenda', (select to_jsonb(x) - 'ics_token' from agenda_preferencias x where x.usuario_id = eu),
    'materiais', coalesce((select jsonb_agg(to_jsonb(x) - 'busca') from materiais x where x.dono_id = eu), '[]'),
    'tarefas', coalesce((select jsonb_agg(to_jsonb(x)) from tarefas x where x.usuario_id = eu), '[]'),
    'revisao', coalesce((select jsonb_agg(to_jsonb(x)) from revisao_itens x where x.usuario_id = eu), '[]'),
    'notas', coalesce((select jsonb_agg(to_jsonb(x)) from notas x where x.usuario_id = eu), '[]'),
    'frequencia', coalesce((select jsonb_agg(to_jsonb(x)) from frequencia x where x.usuario_id = eu), '[]'),
    'mensagens', coalesce((select jsonb_agg(to_jsonb(x)) from mensagens x where x.autor_id = eu), '[]'),
    'duvidas', coalesce((select jsonb_agg(to_jsonb(x)) from duvidas x where x.autor_id = eu), '[]'),
    'respostas', coalesce((select jsonb_agg(to_jsonb(x)) from respostas x where x.autor_id = eu), '[]'),
    'votos', coalesce((select jsonb_agg(to_jsonb(x)) from votos x where x.usuario_id = eu), '[]'),
    'reacoes', coalesce((select jsonb_agg(to_jsonb(x)) from reacoes x where x.usuario_id = eu), '[]'),
    'acervo', coalesce((select jsonb_agg(to_jsonb(x)) from acervo_itens x where x.autor_id = eu), '[]'),
    'denuncias', coalesce((select jsonb_agg(to_jsonb(x)) from acervo_denuncias x where x.usuario_id = eu), '[]'),
    'notificacoes', coalesce((select jsonb_agg(to_jsonb(x)) from notificacoes x where x.usuario_id = eu), '[]')
  );
end $$;

-- 3) Excluir a conta: pede a palavra EXCLUIR; o último admin não pode se excluir (a plataforma ficaria sem dono).
create or replace function public.excluir_minha_conta(p_confirmacao text) returns void
language plpgsql security definer set search_path = public, auth as $$
declare eu uuid := auth.uid(); t uuid;
begin
  if eu is null then raise exception 'precisa_entrar'; end if;
  if upper(trim(coalesce(p_confirmacao, ''))) <> 'EXCLUIR' then raise exception 'confirmacao_invalida'; end if;
  select tenant_id into t from perfis where id = eu;
  if (select papel from perfis where id = eu) = 'admin'
     and (select count(*) from perfis where tenant_id = t and papel = 'admin') <= 1 then
    raise exception 'ultimo_admin';
  end if;
  delete from materiais where dono_id = eu and turma_id is null;        -- privados: somem
  delete from eventos where escopo = 'pessoal' and escopo_id = eu;       -- agenda pessoal: some
  insert into auditoria (ator_id, acao, alvo, dados)                      -- registro sem dado pessoal
  values (null, 'conta_excluida', 'perfil', jsonb_build_object('tenant_id', t, 'quando', now()));
  delete from auth.users where id = eu;                                   -- perfis e o resto em cascata
end $$;

revoke execute on function public.exportar_meus_dados() from public, anon;
revoke execute on function public.excluir_minha_conta(text) from public, anon;
grant execute on function public.exportar_meus_dados() to authenticated;
grant execute on function public.excluir_minha_conta(text) to authenticated;
