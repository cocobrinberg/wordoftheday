-- Puts every account on the leaderboard and counts every quiz answer.
-- Run after stats.sql: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once. It also sets up streaks, so streaks.sql isn't needed.
--
-- Before this, the leaderboard only listed accounts that had answered a word of
-- the day, and answers about practice-bank words (most quiz questions) were
-- never saved, so they never counted.

-- Practice-bank answers have no row in "words"; they store the word itself.
alter table public.quiz_attempts alter column word_id drop not null;
alter table public.quiz_attempts add column if not exists bank_word text;

-- Saves one practice-bank answer for the signed-in account.
create or replace function public.record_bank_attempt(p_token uuid, p_word text, p_correct boolean)
returns setof public.quiz_attempts
language plpgsql security definer set search_path = public as $$
declare
  v_username text := (select username from account_sessions where token = p_token);
begin
  if v_username is null then raise exception 'Not signed in'; end if;
  if length(coalesce(trim(p_word), '')) = 0 then raise exception 'Missing word'; end if;
  return query
    insert into quiz_attempts (word_id, bank_word, correct, username)
    values (null, lower(trim(p_word)), p_correct, v_username)
    returning *;
end;
$$;

-- Every account, including ones with no answers yet, best percentage first.
-- Only usernames and counts are shared, never which words someone got wrong.
create or replace function public.leaderboard()
returns table (username text, right_count bigint, total bigint, percent numeric)
language sql stable security definer set search_path = public as $$
  select a.username,
         count(q.id) filter (where q.correct) as right_count,
         count(q.id) as total,
         coalesce(round(100.0 * count(q.id) filter (where q.correct) / nullif(count(q.id), 0), 1), 0)
           as percent
  from accounts a
  left join quiz_attempts q on q.username = a.username
  group by a.username
  order by 4 desc, 3 desc, 1;
$$;

-- Days in a row (New York time) with at least one answer. Still "current" if
-- the last day played was today or yesterday.
create or replace function public.streaks()
returns table (username text, current_streak int, best_streak int)
language sql stable security definer set search_path = public as $$
  with days as (
    select distinct q.username, (q.created_at at time zone 'America/New_York')::date as d
    from quiz_attempts q
    where q.username is not null
  ),
  runs as (
    -- Consecutive days share the same (day - row number).
    select days.username, d,
           d - (row_number() over (partition by days.username order by d))::int as grp
    from days
  ),
  islands as (
    select runs.username, count(*)::int as len, max(d) as last_day
    from runs
    group by runs.username, grp
  )
  select islands.username,
         coalesce(max(len) filter (
           where last_day >= (now() at time zone 'America/New_York')::date - 1
         ), 0) as current_streak,
         max(len) as best_streak
  from islands
  group by islands.username
  order by 2 desc, 3 desc, 1;
$$;

revoke all on function public.record_bank_attempt(uuid, text, boolean), public.leaderboard(),
  public.streaks() from public;
grant execute on function public.record_bank_attempt(uuid, text, boolean), public.leaderboard(),
  public.streaks() to anon, authenticated;

notify pgrst, 'reload schema';
