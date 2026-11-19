-- Correção de segurança (achada na revisão de 19/11/2026): as regras de edição só conferiam o dono, não o "depois".
-- Um aluno conseguia, editando algo seu: mudar a mensagem para o canal "avisos" (aviso falso do professor) ou para
-- outra turma; mover material para turma de que não participa ou marcá-lo como "oficial"; mudar dúvida, avaliação
-- ou voto de turma/votação. Agora só o texto e os campos normais mudam; o "onde" fica travado.
-- Vale para quem usa o app (papel authenticated). Funções internas (security definer) continuam livres.

create or replace function public.travar_mensagem() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.turma_id is distinct from old.turma_id or new.autor_id is distinct from old.autor_id then
    raise exception 'nao_pode_mudar: turma e autor da mensagem';
  end if;
  if new.canal is distinct from old.canal and not sou_professor_da_turma(new.turma_id) then
    raise exception 'nao_pode_mudar: canal da mensagem';
  end if;
  if new.fixada is distinct from old.fixada and not (sou_professor_da_turma(new.turma_id) or sou_admin()) then
    raise exception 'nao_pode_mudar: só o professor fixa mensagens';
  end if;
  return new;
end $$;
drop trigger if exists travar_mensagem on public.mensagens;
create trigger travar_mensagem before update on public.mensagens for each row execute function public.travar_mensagem();

create or replace function public.travar_material() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.dono_id is distinct from old.dono_id then raise exception 'nao_pode_mudar: dono do material'; end if;
  if new.turma_id is distinct from old.turma_id and new.turma_id is not null and not esta_na_turma(new.turma_id) then
    raise exception 'nao_pode_mudar: só dá para compartilhar com uma turma sua';
  end if;
  if new.oficial is distinct from old.oficial
     and not (sou_admin() or (new.turma_id is not null and sou_professor_da_turma(new.turma_id))) then
    raise exception 'nao_pode_mudar: só o professor marca material como oficial';
  end if;
  return new;
end $$;
drop trigger if exists travar_material on public.materiais;
create trigger travar_material before update on public.materiais for each row execute function public.travar_material();

-- Criar material também: "oficial" só para professor/admin, e turma só se a pessoa está nela.
create or replace function public.conferir_material_novo() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.turma_id is not null and not esta_na_turma(new.turma_id) then
    raise exception 'nao_pode_mudar: só dá para compartilhar com uma turma sua';
  end if;
  if coalesce(new.oficial, false) and not (sou_admin() or (new.turma_id is not null and sou_professor_da_turma(new.turma_id))) then
    new.oficial := false;
  end if;
  return new;
end $$;
drop trigger if exists conferir_material_novo on public.materiais;
create trigger conferir_material_novo before insert on public.materiais for each row execute function public.conferir_material_novo();

create or replace function public.travar_turma_e_autor() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if (to_jsonb(new) ->> 'turma_id') is distinct from (to_jsonb(old) ->> 'turma_id')
     or (to_jsonb(new) ->> 'autor_id') is distinct from (to_jsonb(old) ->> 'autor_id')
     or (to_jsonb(new) ->> 'criado_por') is distinct from (to_jsonb(old) ->> 'criado_por') then
    raise exception 'nao_pode_mudar: turma e autor';
  end if;
  return new;
end $$;
drop trigger if exists travar_duvida on public.duvidas;
create trigger travar_duvida before update on public.duvidas for each row execute function public.travar_turma_e_autor();
drop trigger if exists travar_avaliacao on public.avaliacoes;
create trigger travar_avaliacao before update on public.avaliacoes for each row execute function public.travar_turma_e_autor();
drop trigger if exists travar_resposta on public.respostas;
create trigger travar_resposta before update on public.respostas for each row execute function public.travar_turma_e_autor();

create or replace function public.travar_voto() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user <> 'authenticated' then return new; end if;
  if new.proposta_id is distinct from old.proposta_id or new.usuario_id is distinct from old.usuario_id then
    raise exception 'nao_pode_mudar: voto é da votação em que foi dado';
  end if;
  return new;
end $$;
drop trigger if exists travar_voto on public.votos;
create trigger travar_voto before update on public.votos for each row execute function public.travar_voto();

revoke execute on function public.travar_mensagem(), public.travar_material(), public.conferir_material_novo(),
  public.travar_turma_e_autor(), public.travar_voto() from public, anon, authenticated;
