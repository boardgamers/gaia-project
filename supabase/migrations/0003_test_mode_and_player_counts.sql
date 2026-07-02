-- Test games (one account holding several seats), real player counts, and
-- registered-only invites. See docs/lost-fleet/BACKEND.md §2/§12.
--
-- 1. Gaia Project — with or without Lost Fleet — physically supports 2-4
--    players; there is no 5-player board (the Lost Fleet sector layouts and
--    Interspace tile sets stop at 4p). The original 2-5 bound was wrong.
-- 2. One account may now hold multiple seats in the same game: "test games"
--    where the owner plays every seat, or one person playing two seats among
--    friends. commit_turn already checks ownership per seat and
--    claim_my_seats claims every matching seat, so only the email-uniqueness
--    rules have to go.
-- 3. Invites are restricted to already-registered users: a typo'd email used
--    to create a seat nobody could ever claim, silently blocking the game.
--    Friends sign in once (Google or magic link), then they can be invited.

alter table public.games drop constraint games_player_count_check;
alter table public.games add constraint games_player_count_check
  check (player_count between 2 and 4);

alter table public.players drop constraint players_game_id_invited_email_key;

create or replace function public.create_game(
  p_name text,
  p_seed text,
  p_player_count int,
  p_options jsonb,
  p_invites jsonb,
  p_current_seat int
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_game    uuid;
  v_missing text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_seed is null or length(trim(p_seed)) = 0 then
    raise exception 'seed required';
  end if;
  if p_player_count is null or p_player_count < 2 or p_player_count > 4 then
    raise exception 'player_count must be 2-4';
  end if;
  if jsonb_typeof(p_options) is distinct from 'object' then
    raise exception 'options must be a json object';
  end if;
  if jsonb_typeof(p_invites) is distinct from 'array'
     or jsonb_array_length(p_invites) <> p_player_count then
    raise exception 'invites must list exactly % players', p_player_count;
  end if;
  if (select count(distinct (i ->> 'seat')::int) from jsonb_array_elements(p_invites) i
        where (i ->> 'seat')::int between 0 and p_player_count - 1) <> p_player_count then
    raise exception 'invite seats must be exactly 0..%', p_player_count - 1;
  end if;
  if exists (select 1 from jsonb_array_elements(p_invites) i
             where coalesce(lower(i ->> 'email'), '') = '') then
    raise exception 'each seat needs an email';
  end if;
  -- Every invited email must already belong to an account, so no seat can be
  -- orphaned by a typo. (Duplicates are fine: that is a test game / one
  -- person playing several seats.)
  select string_agg(e.email, ', ') into v_missing
  from (select distinct lower(i ->> 'email') as email
        from jsonb_array_elements(p_invites) i) e
  where not exists (select 1 from auth.users u where lower(u.email) = e.email);
  if v_missing is not null then
    raise exception 'not registered yet: % — they need to sign in to the site once before you can invite them', v_missing;
  end if;
  if not exists (select 1 from jsonb_array_elements(p_invites) i
                 where lower(i ->> 'email') = v_email) then
    raise exception 'the game creator must occupy one of the seats';
  end if;
  if p_current_seat is null or p_current_seat < 0 or p_current_seat >= p_player_count then
    raise exception 'current_seat must be a valid seat';
  end if;

  insert into public.games (created_by, name, seed, player_count, options, current_seat)
  values (v_uid, coalesce(p_name, ''), p_seed, p_player_count, p_options, p_current_seat)
  returning id into v_game;

  insert into public.players (game_id, seat, invited_email, display_name, user_id)
  select v_game,
         (i ->> 'seat')::int,
         lower(i ->> 'email'),
         coalesce(i ->> 'display_name', ''),
         u.id
  from jsonb_array_elements(p_invites) i
  left join auth.users u on lower(u.email) = lower(i ->> 'email');

  return v_game;
end;
$$;
