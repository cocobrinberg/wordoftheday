-- Daily streaks for the leaderboard. Run after stats.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- A streak is the number of days in a row (New York time) on which someone
-- answered at least one quiz question. It is still "current" if the last day
-- played was today or yesterday.

create or replace function public.streaks()
returns table (username text, current_streak int, best_streak int)
language sql stable security definer set search_path = public as $$
  with days as (
    select distinct username, (created_at at time zone 'America/New_York')::date as d
    from quiz_attempts
    where username is not null
  ),
  runs as (
    -- Consecutive days share the same (day - row number).
    select username, d,
           d - (row_number() over (partition by username order by d))::int as grp
    from days
  ),
  islands as (
    select username, count(*)::int as len, max(d) as last_day
    from runs
    group by username, grp
  )
  select username,
         coalesce(max(len) filter (
           where last_day >= (now() at time zone 'America/New_York')::date - 1
         ), 0) as current_streak,
         max(len) as best_streak
  from islands
  group by username
  order by current_streak desc, best_streak desc, username;
$$;

revoke all on function public.streaks() from public;
grant execute on function public.streaks() to anon, authenticated;

notify pgrst, 'reload schema';
