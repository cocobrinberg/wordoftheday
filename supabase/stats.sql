-- Per-account quiz scores and a leaderboard. Run after accounts.sql and hobbies.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Quiz answers now belong to an account. The browser no longer reads or writes
-- quiz_attempts directly (so nobody can post answers under someone else's name);
-- it goes through the functions below instead.

alter table public.quiz_attempts
  add column if not exists username text references public.accounts on delete cascade;
create index if not exists quiz_attempts_username_idx on public.quiz_attempts (username);

alter table public.quiz_attempts enable row level security;
revoke all on table public.quiz_attempts from anon, authenticated;

-- Saves one quiz answer for the signed-in account.
create or replace function public.record_attempt(p_token uuid, p_word_id bigint, p_correct boolean)
returns setof public.quiz_attempts
language plpgsql security definer set search_path = public as $$
declare
  v_username text := (select username from account_sessions where token = p_token);
begin
  if v_username is null then raise exception 'Not signed in'; end if;
  return query
    insert into quiz_attempts (word_id, correct, username)
    values (p_word_id, p_correct, v_username)
    returning *;
end;
$$;

-- Every quiz answer the signed-in account has given.
create or replace function public.my_attempts(p_token uuid)
returns setof public.quiz_attempts
language sql stable security definer set search_path = public as $$
  select q.* from quiz_attempts q
  join account_sessions s on s.username = q.username
  where s.token = p_token
  order by q.created_at;
$$;

-- Everyone's quiz totals, best percentage first. Only usernames and counts
-- are shared, never which words someone got wrong.
create or replace function public.leaderboard()
returns table (username text, right_count bigint, total bigint, percent numeric)
language sql stable security definer set search_path = public as $$
  select username,
         count(*) filter (where correct) as right_count,
         count(*) as total,
         round(100.0 * count(*) filter (where correct) / count(*), 1) as percent
  from quiz_attempts
  where username is not null
  group by username
  order by percent desc, total desc, username;
$$;

revoke all on function public.record_attempt(uuid, bigint, boolean), public.my_attempts(uuid),
  public.leaderboard() from public;
grant execute on function public.record_attempt(uuid, bigint, boolean), public.my_attempts(uuid),
  public.leaderboard() to anon, authenticated;

notify pgrst, 'reload schema';
