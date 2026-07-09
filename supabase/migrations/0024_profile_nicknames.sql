-- Adds user-level nicknames so players are never identified by their real Google
-- account name or email address in the lobby / in-game UI. Previously display_name
-- was derived per-seat from auth.users' raw_user_meta_data (full_name/name) or the
-- email local-part, with no way for a user to change it. Nicknames now live in a
-- small per-user profiles table with a random anonymous default ("Player 1234"),
-- editable from the lobby's settings menu via set_my_nickname().

create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  nickname   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (user_id = auth.uid());

create policy profiles_insert_own on public.profiles
  for insert to authenticated with check (user_id = auth.uid());

create policy profiles_update_own on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.random_default_nickname()
returns text
language sql
as $$
  select 'Player ' || lpad(floor(random() * 10000)::int::text, 4, '0');
$$;

-- Every new auth.users row (sign-up via any method) gets a random, anonymous
-- nickname up front so display_name never needs to fall back to Google
-- metadata/email again.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (user_id, nickname)
  values (new.id, public.random_default_nickname())
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Backfill everyone who already has an account.
insert into public.profiles (user_id, nickname)
select id, public.random_default_nickname()
from auth.users
on conflict (user_id) do nothing;

-- Immediately scrub any real name/email already sitting in players.display_name from
-- before this migration (the whole point of this change) - every claimed seat's
-- display_name is reset to the fresh random nickname above. Players can then pick a
-- friendlier nickname themselves via set_my_nickname(), but nothing personally
-- identifying is exposed even before they do.
update public.players p
set display_name = pr.nickname
from public.profiles pr
where p.user_id = pr.user_id
  and p.display_name is distinct from pr.nickname;

-- The only write path for a nickname: validates, upserts, and immediately syncs
-- every players row this user occupies (open lobby seats, active games, and
-- finished games alike) so a rename takes effect everywhere, not just future games.
create or replace function public.set_my_nickname(p_nickname text)
returns public.profiles
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_trimmed text := trim(coalesce(p_nickname, ''));
  v_profile public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if length(v_trimmed) = 0 then
    raise exception 'nickname cannot be empty';
  end if;
  if length(v_trimmed) > 40 then
    raise exception 'nickname must be 40 characters or fewer';
  end if;

  insert into public.profiles (user_id, nickname)
  values (v_uid, v_trimmed)
  on conflict (user_id) do update set nickname = excluded.nickname, updated_at = now()
  returning * into v_profile;

  update public.players
  set display_name = v_trimmed
  where user_id = v_uid;

  return v_profile;
end;
$$;

revoke execute on function public.set_my_nickname(text) from public, anon;
grant execute on function public.set_my_nickname(text) to authenticated;

-- join_open_game_seat now sources the seat's display_name from the user's profile
-- nickname instead of Google metadata / email-local-part.
create or replace function public.join_open_game_seat(p_game_id uuid, p_seat int)
returns public.games
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_display_name text;
  v_game public.games%rowtype;
  v_claimed int;
begin
  if v_uid is null or v_email = '' then
    raise exception 'not signed in';
  end if;

  select *
  into v_game
  from public.games
  where id = p_game_id
  for update;

  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'open' then
    raise exception 'game is no longer open';
  end if;
  if p_seat < 0 or p_seat >= v_game.player_count then
    raise exception 'seat must be between 0 and %', v_game.player_count - 1;
  end if;
  if exists (
    select 1 from public.players
    where game_id = p_game_id and user_id = v_uid and seat <> p_seat
  ) then
    raise exception 'you already occupy a seat in this game';
  end if;
  if exists (
    select 1 from public.players
    where game_id = p_game_id and seat = p_seat and user_id is not null and user_id <> v_uid
  ) then
    raise exception 'seat already taken';
  end if;

  select nickname into v_display_name from public.profiles where user_id = v_uid;
  if v_display_name is null then
    v_display_name := public.random_default_nickname();
    insert into public.profiles (user_id, nickname) values (v_uid, v_display_name)
    on conflict (user_id) do nothing;
  end if;

  update public.players
  set user_id = v_uid,
      invited_email = v_email,
      display_name = v_display_name
  where game_id = p_game_id and seat = p_seat;

  select count(*) into v_claimed
  from public.players
  where game_id = p_game_id and user_id is not null;

  update public.games
  set status = case when v_claimed = v_game.player_count then 'active' else 'open' end,
      current_seat = case when v_claimed = v_game.player_count then starting_seat else null end
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

revoke execute on function public.join_open_game_seat(uuid, int) from public, anon;
grant execute on function public.join_open_game_seat(uuid, int) to authenticated;
