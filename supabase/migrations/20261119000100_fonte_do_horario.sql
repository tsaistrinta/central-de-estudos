-- Toda informação captada mostra a origem: o horário de cada turma passa a guardar o PDF (e a página)
-- da grade oficial de onde veio, para o aluno ver o link no cartão da aula e na página da matéria.
alter table public.turmas
  add column if not exists horario_fonte_url text,
  add column if not exists horario_pagina int,
  add column if not exists horario_atualizado_em timestamptz;

-- Quando a curadoria de grade é aplicada (pelo Archie ou pelo admin), a turma guarda a fonte.
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
  end if;
  return null;
end $$;
revoke execute on function public.turma_guardar_fonte_do_horario() from public, anon, authenticated;

drop trigger if exists curadoria_fonte_do_horario on public.curadoria;
create trigger curadoria_fonte_do_horario after update of decisao on public.curadoria
  for each row execute function public.turma_guardar_fonte_do_horario();

-- Turmas que já receberam horário do Archie: a fonte é o PDF da captura mais recente aplicada.
update public.turmas t set
  horario_fonte_url = x.url,
  horario_atualizado_em = x.quando
from (
  select distinct on (c.item_id) c.item_id, coalesce(c.dados ->> 'documento_url', cap.conteudo_url) url,
         coalesce(c.decidido_em, c.criado_em) quando
  from public.curadoria c left join public.capturas cap on cap.id = c.captura_id
  where c.decisao = 'aprovado' and c.item_tipo in ('grade_turma', 'disciplina_nova') and c.item_id is not null
  order by c.item_id, coalesce(c.decidido_em, c.criado_em) desc
) x
where t.id = x.item_id and x.url is not null;
