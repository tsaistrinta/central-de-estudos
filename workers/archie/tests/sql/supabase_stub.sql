-- Imita o mínimo do Supabase para testar as migrações num Postgres 16 comum.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

-- pgmq de mentira (mesma assinatura das funções usadas).
create schema pgmq;
create table pgmq.q_archie_jobs (msg_id bigserial primary key, read_ct int not null default 0,
  enqueued_at timestamptz not null default now(), vt timestamptz not null default now(), message jsonb);
create function pgmq.create(q text) returns void language sql as $$ select $$;
create function pgmq.send(q text, msg jsonb) returns bigint language sql as
  $$ insert into pgmq.q_archie_jobs (message) values (msg) returning msg_id $$;
create function pgmq.read(q text, vt int, qty int)
  returns table (msg_id bigint, read_ct int, enqueued_at timestamptz, vt timestamptz, message jsonb)
  language sql as $$
    update pgmq.q_archie_jobs j set vt = now() + make_interval(secs => read.vt), read_ct = j.read_ct + 1
    where j.msg_id in (select x.msg_id from pgmq.q_archie_jobs x where x.vt <= now() order by x.msg_id limit qty for update skip locked)
    returning j.msg_id, j.read_ct, j.enqueued_at, j.vt, j.message $$;
create function pgmq.delete(q text, id bigint) returns boolean language sql as
  $$ with d as (delete from pgmq.q_archie_jobs where msg_id = id returning 1) select exists (select 1 from d) $$;
create function pgmq.archive(q text, id bigint) returns boolean language sql as
  $$ select pgmq.delete(q, id) $$;
grant usage on schema pgmq to authenticated;
grant all on all tables in schema pgmq to authenticated;
grant all on all sequences in schema pgmq to authenticated;

-- Como no Supabase: anon e authenticated recebem acesso às tabelas novas (o RLS é que filtra).
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
