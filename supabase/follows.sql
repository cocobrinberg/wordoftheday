-- Following other players: find friends, followers and following.
-- Run after accounts.sql: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- Safe to run more than once.
--
-- The table has row level security on and no policies, so the browser can't
-- read or write it directly. The app only goes through the functions below,
-- which act as whoever owns the session token.

create table if not exists public.follows (
  follower   text not null references public.accounts on delete cascade,
  following  text not null references public.accounts on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, following),
  check (follower <> following)
);
create index if not exists follows_following_idx on public.follows (following);
alter table public.follows enable row level security;
revoke all on table public.follows from anon, authenticated;

-- Players whose username contains the search text (or the newest players when
-- it's empty), with whether you follow them and whether they follow you.
create or replace function public.find_players(p_token uuid, p_query text)
returns table (username text, i_follow boolean, follows_me boolean)
language sql stable security definer set search_path = public as $$
  with me as (select s.username from account_sessions s where s.token = p_token)
  select a.username,
         exists (select 1 from follows f where f.follower = me.username and f.following = a.username),
         exists (select 1 from follows f where f.follower = a.username and f.following = me.username)
  from accounts a, me
  where a.username <> me.username
    and a.username like '%' || replace(replace(replace(lower(trim(coalesce(p_query, ''))),
          '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by (a.username like replace(replace(replace(lower(trim(coalesce(p_query, ''))),
              '\', '\\'), '%', '\%'), '_', '\_') || '%') desc,
           case when trim(coalesce(p_query, '')) = '' then a.created_at end desc nulls last,
           a.username
  limit 25;
$$;

-- Everyone you follow or who follows you, with both directions.
create or replace function public.my_connections(p_token uuid)
returns table (username text, i_follow boolean, follows_me boolean)
language sql stable security definer set search_path = public as $$
  with me as (select s.username from account_sessions s where s.token = p_token),
  other as (
    select f.following as username from follows f, me where f.follower = me.username
    union
    select f.follower from follows f, me where f.following = me.username
  )
  select o.username,
         exists (select 1 from follows f, me where f.follower = me.username and f.following = o.username),
         exists (select 1 from follows f, me where f.follower = o.username and f.following = me.username)
  from other o
  order by o.username;
$$;

-- Follows (p_follow = true) or unfollows (false) another player.
create or replace function public.set_follow(p_token uuid, p_username text, p_follow boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me text := (select username from account_sessions where token = p_token);
  v_them text := lower(trim(p_username));
begin
  if v_me is null then raise exception 'Not signed in'; end if;
  if v_them = v_me then raise exception 'You can''t follow yourself'; end if;
  if p_follow then
    if not exists (select 1 from accounts where username = v_them) then
      raise exception 'No player is called %', v_them;
    end if;
    insert into follows (follower, following) values (v_me, v_them) on conflict do nothing;
  else
    delete from follows where follower = v_me and following = v_them;
  end if;
end;
$$;

revoke all on function public.find_players(uuid, text), public.my_connections(uuid),
  public.set_follow(uuid, text, boolean) from public;
grant execute on function public.find_players(uuid, text), public.my_connections(uuid),
  public.set_follow(uuid, text, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
