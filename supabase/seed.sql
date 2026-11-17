-- Seed do piloto: Fatec Indaiatuba · ADS · 2026/2.
-- Rodar DEPOIS da migração. Confira nomes, horários e salas com a grade oficial do site
-- (o Archie passa a manter isso sozinho a partir da Fase 5).

insert into public.tenants (id, nome, slug, dominios_permitidos, site_url, periodo_atual, inicio_periodo, fim_periodo) values
  ('00000000-0000-0000-0000-000000000001', 'Fatec Indaiatuba', 'fatec-indaiatuba',
   array['aluno.cps.sp.gov.br', 'fatec.sp.gov.br', 'cps.sp.gov.br'],
   'https://www.fatecid.com.br/site/', '2026/2', '2026-07-27', '2026-12-14');

insert into public.cursos (id, tenant_id, nome, sigla, semestres) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001',
   'Análise e Desenvolvimento de Sistemas', 'ADS', 6);

-- Disciplinas do 3º semestre usadas no piloto (PROVISÓRIO: confirmar com a matriz do curso).
insert into public.disciplinas (id, curso_id, nome, sigla, semestre_matriz, cor) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000a1', 'Programação Orientada a Objetos', 'POO', 3, 'laranja'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000a1', 'Estatística', 'EST', 3, 'petroleo'),
  ('00000000-0000-0000-0000-0000000000d3', '00000000-0000-0000-0000-0000000000a1', 'Engenharia de Software II', 'ES II', 3, 'roxo'),
  ('00000000-0000-0000-0000-0000000000d4', '00000000-0000-0000-0000-0000000000a1', 'Interação Humano-Computador', 'IHC', 3, 'framboesa'),
  ('00000000-0000-0000-0000-0000000000d5', '00000000-0000-0000-0000-0000000000a1', 'Sociedade e Tecnologia', 'SOC', 3, 'mostarda'),
  ('00000000-0000-0000-0000-0000000000d6', '00000000-0000-0000-0000-0000000000a1', 'Banco de Dados', 'BD', 3, 'azul');

insert into public.turmas (id, disciplina_id, periodo_letivo, turno, professor_nome, tamanho_real, fonte) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000d1', '2026/2', 'noite', 'Prof. Furgeri', 40, 'vagas padrão'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000d2', '2026/2', 'noite', 'Prof. Carlos', 40, 'vagas padrão'),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000d3', '2026/2', 'noite', 'Prof. Marlon', 40, 'vagas padrão'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000d4', '2026/2', 'noite', 'Prof. Michel', 40, 'vagas padrão'),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000d5', '2026/2', 'noite', 'Profa. Miriam', 40, 'vagas padrão'),
  ('00000000-0000-0000-0000-0000000000e6', '00000000-0000-0000-0000-0000000000d6', '2026/2', 'noite', null, 40, 'vagas padrão');

-- Grade da noite (PROVISÓRIO): 19:00–20:40 e 20:50–22:30.
insert into public.aulas_horario (turma_id, dia_semana, inicio, fim, sala) values
  ('00000000-0000-0000-0000-0000000000e1', 1, '19:00', '20:40', 'Sala 7'),
  ('00000000-0000-0000-0000-0000000000e2', 1, '20:50', '22:30', 'Sala 12'),
  ('00000000-0000-0000-0000-0000000000e1', 2, '19:00', '20:40', 'Sala 7'),
  ('00000000-0000-0000-0000-0000000000e3', 2, '20:50', '22:30', 'Lab. 3'),
  ('00000000-0000-0000-0000-0000000000e6', 3, '19:00', '22:30', 'Lab. 2'),
  ('00000000-0000-0000-0000-0000000000e4', 4, '19:00', '20:40', 'Sala 5'),
  ('00000000-0000-0000-0000-0000000000e5', 4, '20:50', '22:30', 'Sala 9'),
  ('00000000-0000-0000-0000-0000000000e4', 5, '19:00', '20:40', 'Sala 5'),
  ('00000000-0000-0000-0000-0000000000e2', 5, '20:50', '22:30', 'Sala 12');

-- Fontes que o Archie vigia (Fase 5). Os endereços com index.php são os que o site usa de verdade.
insert into public.fontes (tenant_id, nome, url, tipo, extrator, frequencia_min) values
  ('00000000-0000-0000-0000-000000000001', 'Home do site (avisos)', 'https://www.fatecid.com.br/site/', 'pagina', 'avisos', 60),
  ('00000000-0000-0000-0000-000000000001', 'Calendário Acadêmico', 'https://www.fatecid.com.br/site/index.php/calendario-academico/', 'pagina', 'calendario', 120),
  ('00000000-0000-0000-0000-000000000001', 'Grade de Horários e Salas', 'https://www.fatecid.com.br/site/index.php/grade-de-horarios-e-salas/', 'pagina', 'grade', 120),
  ('00000000-0000-0000-0000-000000000001', 'Editais', 'https://www.fatecid.com.br/site/index.php/editais/', 'pagina', 'geral', 360);

-- Calendário acadêmico 2026/2 (lido do PDF do site; o Archie confere nas próximas versões).
insert into public.eventos (tenant_id, escopo, escopo_id, titulo, tipo, inicio, fim, dia_todo, origem, status, documento_url) values
  ('00000000-0000-0000-0000-000000000001', 'curso', '00000000-0000-0000-0000-0000000000a1', 'Semana de Tecnologia ADS', 'data_especial', '2026-10-05 00:00-03', '2026-10-10 23:59-03', true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Feriado · Nossa Senhora Aparecida', 'data_especial', '2026-10-12 00:00-03', null, true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Feriado · Finados', 'data_especial', '2026-11-02 00:00-03', null, true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Sábado letivo · reposição', 'aula', '2026-11-14 00:00-03', null, true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Feriado · Proclamação da República', 'data_especial', '2026-11-15 00:00-03', null, true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Feriado · Consciência Negra', 'data_especial', '2026-11-20 00:00-03', null, true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Oficina de monografia', 'data_especial', '2026-11-23 00:00-03', '2026-11-27 23:59-03', true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Sábado letivo · reposição', 'aula', '2026-11-28 00:00-03', null, true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Fim do semestre letivo', 'data_especial', '2026-12-14 00:00-03', null, true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Revisão de médias', 'data_especial', '2026-12-15 00:00-03', '2026-12-17 23:59-03', true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/'),
  ('00000000-0000-0000-0000-000000000001', 'unidade', null, 'Exames finais', 'prova', '2026-12-22 00:00-03', '2026-12-23 23:59-03', true, 'importado', 'oficial', 'https://www.fatecid.com.br/site/calendario-academico/');

-- Liga as datas acima à fonte, para o Archie conferir com as próximas versões do PDF.
update public.eventos set fonte_id = (select id from public.fontes where extrator = 'calendario' limit 1)
where origem = 'importado' and documento_url like '%calendario-academico%';
