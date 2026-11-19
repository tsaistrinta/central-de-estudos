-- Correção de segurança (achada pelos testes de segurança em 19/11/2026): o limite de 8 códigos errados por hora
-- não funcionava. A função registrava a tentativa e depois lançava erro, e o erro desfazia o registro junto;
-- a contagem nunca subia. Agora o código errado devolve null (sem erro), a tentativa fica gravada e a nona
-- tentativa na mesma hora é recusada, mesmo com o código certo.
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
    return null;  -- o app mostra "código inválido"
  end if;
  insert into matriculas (usuario_id, turma_id) values (auth.uid(), t) on conflict do nothing;
  update pedidos_turma set status = 'aprovado', decidido_em = now()
  where turma_id = t and usuario_id = auth.uid() and status = 'pendente';
  return t;
end $$;
revoke execute on function public.entrar_com_codigo(text) from public, anon;
grant execute on function public.entrar_com_codigo(text) to authenticated;

-- Tentativas antigas não precisam ficar para sempre.
delete from public.tentativas_codigo where criado_em < now() - interval '1 day';
