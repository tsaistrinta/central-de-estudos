-- Duas matrizes de ADS rodando ao mesmo tempo (a grade ADS_NOVO.pdf é da matriz nova; ADS_NOT.pdf, da antiga).
-- Disciplinas com o mesmo nome nas duas (ex.: Engenharia de Software II) viram turmas separadas, e o Archie só
-- liga uma linha do PDF à disciplina do mesmo semestre e da mesma matriz.
alter table public.disciplinas add column if not exists matriz text check (matriz in ('nova', 'antiga'));
comment on column public.disciplinas.matriz is 'null = matriz única/antiga; nova = matriz nova do curso';

-- O que veio da grade da matriz nova.
update public.disciplinas d set matriz = 'nova'
from public.turmas t
where t.disciplina_id = d.id and t.horario_fonte_url ilike '%NOVO%' and d.matriz is null;

-- Ao aplicar a curadoria da grade: a turma guarda a fonte e a disciplina nova guarda a matriz.
create or replace function public.turma_guardar_fonte_do_horario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.decisao = 'aprovado' and old.decisao is distinct from 'aprovado'
     and new.item_tipo in ('grade_turma', 'disciplina_nova') and new.item_id is not null then
    update turmas set
      horario_fonte_url = coalesce(new.dados ->> 'documento_url',
                                   (select c.conteudo_url from capturas c where c.id = new.captura_id),
                                   horario_fonte_url),
      horario_pagina = coalesce((new.dados ->> 'pagina')::int, horario_pagina),
      horario_atualizado_em = now()
    where id = new.item_id;
    if new.item_tipo = 'disciplina_nova' and new.dados -> 'disciplina' ->> 'matriz' is not null then
      update disciplinas set matriz = new.dados -> 'disciplina' ->> 'matriz'
      where id = (select disciplina_id from turmas where id = new.item_id) and matriz is null;
    end if;
  end if;
  return null;
end $$;
revoke execute on function public.turma_guardar_fonte_do_horario() from public, anon, authenticated;
