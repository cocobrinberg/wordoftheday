-- Word suggestions. Run after accounts.sql:
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- A suggested word goes straight into the words table on the first day,
-- starting tomorrow (New York time), that doesn't have a word yet.

alter table public.words add column if not exists suggested_by text references public.accounts on delete set null;

-- Upcoming suggestions one account can have waiting at once.
create or replace function public.suggest_word(
  p_token uuid, p_word text, p_part_of_speech text, p_definition text, p_example text
)
returns date
language plpgsql security definer set search_path = public as $$
declare
  v_username text := (select username from account_sessions where token = p_token);
  v_word text := lower(trim(p_word));
  v_tomorrow date := (now() at time zone 'America/New_York')::date + 1;
  v_day date;
begin
  if v_username is null then raise exception 'Not signed in'; end if;
  if v_word !~ '^[a-z]+(-[a-z]+)*$' or length(v_word) > 30 then
    raise exception 'Suggestions are a single word, letters only';
  end if;
  if length(coalesce(trim(p_definition), '')) = 0 then
    raise exception 'A definition is needed';
  end if;

  -- One suggestion at a time, so two people can't land on the same day.
  perform pg_advisory_xact_lock(hashtext('suggest_word'));

  if exists (select 1 from words where lower(word) = v_word) then
    raise exception '“%” has already been a word of the day', v_word;
  end if;
  if (select count(*) from words where suggested_by = v_username and day >= v_tomorrow) >= 3 then
    raise exception 'You already have 3 words waiting. Suggest another once one of them has had its day.';
  end if;

  select d::date into v_day
  from generate_series(v_tomorrow, v_tomorrow + 3650, interval '1 day') d
  where not exists (select 1 from words w where w.day = d::date)
  order by d
  limit 1;

  insert into words (word, part_of_speech, definition, example, day, suggested_by)
  values (v_word, coalesce(trim(p_part_of_speech), ''), trim(p_definition),
          coalesce(trim(p_example), ''), v_day, v_username);
  return v_day;
end;
$$;

revoke all on function public.suggest_word(uuid, text, text, text, text) from public;
grant execute on function public.suggest_word(uuid, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
