-- Fontes oficiais que faltavam (achadas em 19/11/2026 na página do curso de ADS e no menu da Secretaria):
-- projetos pedagógicos (ementas, objetivos, bibliografia), matrizes curriculares (semestre de cada disciplina),
-- conteúdo programático e corpo docente. Todas públicas. O Archie guarda o texto com o link (extrator "geral")
-- para responder com a fonte; a leitura estruturada das ementas entra numa próxima versão.
insert into public.fontes (tenant_id, nome, url, tipo, frequencia_min, extrator)
select t.id, f.nome, f.url, f.tipo, f.frequencia, 'geral'
from public.tenants t
cross join (values
  ('ADS · Projeto pedagógico (matriz nova)', 'https://www.fatecid.com.br/site/wp-content/uploads/2026/11/PPC-ADS-Novo.pdf', 'pdf', 1440),
  ('ADS · Projeto pedagógico (matriz antiga)', 'https://www.fatecid.com.br/site/wp-content/uploads/2026/11/PPC-ADS-Antigo.pdf', 'pdf', 1440),
  ('ADS · Matriz curricular nova', 'https://www.fatecid.com.br/site/wp-content/uploads/2026/11/Matriz-ADS-Nova.pdf', 'pdf', 1440),
  ('ADS · Matriz curricular antiga', 'https://www.fatecid.com.br/site/wp-content/uploads/2026/11/Matriz-ADS-Antiga.pdf', 'pdf', 1440),
  ('ADS · Conteúdo programático', 'https://www.fatecid.com.br/site/wp-content/uploads/downloads/secretaria/conteudo/conteudo_ads.pdf', 'pdf', 1440),
  ('Corpo docente', 'https://www.fatecid.com.br/site/index.php/corpo-docente/', 'pagina', 1440),
  ('Página do curso de ADS', 'https://www.fatecid.com.br/site/index.php/analise-de-sistemas/', 'pagina', 1440)
) as f(nome, url, tipo, frequencia)
where t.site_url ilike '%fatecid.com.br%'
  and not exists (select 1 from public.fontes x where x.tenant_id = t.id and x.url = f.url);
