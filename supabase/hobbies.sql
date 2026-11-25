-- Hobbies for Word of the Day accounts. Run after accounts.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.

alter table public.accounts add column if not exists hobbies text[] not null default '{}';

-- get_account now also returns hobbies, so the old version has to go first.
drop function if exists public.get_account(uuid);
create function public.get_account(p_token uuid)
returns table (username text, background text, hobbies text[])
language sql stable security definer set search_path = public as $$
  select a.username, a.background, a.hobbies
  from account_sessions s join accounts a using (username)
  where s.token = p_token;
$$;

create or replace function public.set_hobbies(p_token uuid, p_hobbies text[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_hobbies text[];
begin
  select coalesce(array_agg(h), '{}') into v_hobbies
  from (select distinct lower(trim(x)) as h from unnest(p_hobbies) as x) t
  where h <> '';
  if cardinality(v_hobbies) <> 5 then
    raise exception 'Please enter five different hobbies';
  end if;
  if exists (select 1 from unnest(v_hobbies) h where length(h) > 40) then
    raise exception 'Keep each hobby under 40 characters';
  end if;
  update accounts set hobbies = v_hobbies
  where username = (select username from account_sessions where token = p_token);
  if not found then raise exception 'Not signed in'; end if;
end;
$$;

revoke all on function public.get_account(uuid), public.set_hobbies(uuid, text[]) from public;
grant execute on function public.get_account(uuid), public.set_hobbies(uuid, text[])
  to anon, authenticated;

notify pgrst, 'reload schema';
