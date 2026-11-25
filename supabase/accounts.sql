-- Accounts for Word of the Day.
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- The tables have row level security on and no policies, so the browser can't
-- read them directly (password hashes never leave the database). The app only
-- talks to them through the functions below.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.accounts (
  username      text primary key check (username ~ '^[a-z0-9_]{3,20}$'),
  password_hash text not null,
  background    text not null default '#f0f9ff' check (background ~ '^#[0-9a-f]{6}$'),
  created_at    timestamptz not null default now()
);
alter table public.accounts enable row level security;

create table if not exists public.account_sessions (
  token      uuid primary key default gen_random_uuid(),
  username   text not null references public.accounts on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.account_sessions enable row level security;

-- True when nobody has taken this username yet (case-insensitive).
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from accounts where username = lower(trim(p_username)));
$$;

-- Creates the account and returns a session token.
create or replace function public.create_account(p_username text, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_username text := lower(trim(p_username));
  v_token uuid;
begin
  if v_username !~ '^[a-z0-9_]{3,20}$' then
    raise exception 'Usernames are 3-20 letters, numbers or underscores';
  end if;
  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Passwords must be at least 8 characters';
  end if;
  begin
    insert into accounts (username, password_hash)
    values (v_username, crypt(p_password, gen_salt('bf')));
  exception when unique_violation then
    raise exception 'That username is already taken';
  end;
  insert into account_sessions (username) values (v_username) returning token into v_token;
  return v_token;
end;
$$;

-- Returns a session token when the username and password match.
create or replace function public.sign_in(p_username text, p_password text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare
  v_username text := lower(trim(p_username));
  v_token uuid;
begin
  if not exists (
    select 1 from accounts
    where username = v_username and password_hash = crypt(p_password, password_hash)
  ) then
    raise exception 'Wrong username or password';
  end if;
  insert into account_sessions (username) values (v_username) returning token into v_token;
  return v_token;
end;
$$;

-- The signed-in account for a session token (no rows if the token is unknown).
create or replace function public.get_account(p_token uuid)
returns table (username text, background text)
language sql stable security definer set search_path = public as $$
  select a.username, a.background
  from account_sessions s join accounts a using (username)
  where s.token = p_token;
$$;

create or replace function public.set_background(p_token uuid, p_background text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update accounts set background = lower(p_background)
  where username = (select username from account_sessions where token = p_token);
  if not found then raise exception 'Not signed in'; end if;
end;
$$;

create or replace function public.sign_out(p_token uuid)
returns void language sql security definer set search_path = public as $$
  delete from account_sessions where token = p_token;
$$;

revoke all on function public.username_available(text), public.create_account(text, text),
  public.sign_in(text, text), public.get_account(uuid), public.set_background(uuid, text),
  public.sign_out(uuid) from public;
grant execute on function public.username_available(text), public.create_account(text, text),
  public.sign_in(text, text), public.get_account(uuid), public.set_background(uuid, text),
  public.sign_out(uuid) to anon, authenticated;
