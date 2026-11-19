-- Índices achados no teste de carga (600 alunos, 22 mil eventos, 65 mil mensagens, 22 mil materiais):
-- os materiais de uma matéria e as dúvidas da turma eram lidos varrendo a tabela inteira.
create index if not exists materiais_disciplina_criado on public.materiais (disciplina_id, criado_em desc);
create index if not exists duvidas_turma_criado on public.duvidas (turma_id, criado_em desc);
create index if not exists respostas_duvida on public.respostas (duvida_id);
create index if not exists reacoes_usuario on public.reacoes (usuario_id);
