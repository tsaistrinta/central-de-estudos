-- Desempenho das regras de acesso (aviso "auth_rls_initplan" do Supabase): auth.uid(), sou_admin() e meu_tenant()
-- eram calculados linha por linha. Embrulhados em (select ...), viram uma conta só por consulta.
-- A regra em si não muda: só a forma de calcular. Vale para todas as políticas do schema public.
do $$
declare
  r record;
  usando text;
  checando text;
  embrulhar constant text := '(?<!SELECT |select )\m(auth\.uid|sou_admin|meu_tenant)\(\)';
begin
  for r in
    select * from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ embrulhar or coalesce(with_check, '') ~ embrulhar)
  loop
    usando := case when r.qual is not null
      then ' using (' || regexp_replace(r.qual, embrulhar, '(select \1())', 'g') || ')' else '' end;
    checando := case when r.with_check is not null
      then ' with check (' || regexp_replace(r.with_check, embrulhar, '(select \1())', 'g') || ')' else '' end;
    execute format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename) || usando || checando;
  end loop;
end $$;
