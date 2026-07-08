-- Open-lobby hosted games: regular games are created with only the host seated and the remaining
-- seats left open in the lobby. Players can then claim/abandon a seat until the table is full,
-- at which point the game activates automatically.

alter table public.games
  drop constraint if exists games_status_check;

alter table public.games
  add constraint games_status_check check (status in ('open', 'active', 'finished'));

alter table public.games
  add column if not exists starting_seat int,
  add column if not exists setup_move text;

alter table public.games
  drop constraint if exists games_open_requires_starting_seat;

alter table public.games
  add constraint games_open_requires_starting_seat
  check (status <> 'open' or starting_seat is not null);

create or replace function public.create_game(
  p_name text,
  p_seed text,
  p_player_count int,
  p_options jsonb,
  p_invites jsonb,
  p_current_seat int,
  p_setup_move text default null,
  p_open_lobby boolean default false
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_game uuid;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
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
  if not exists (select 1 from jsonb_array_elements(p_invites) i
                 where nullif(i ->> 'user_id', '')::uuid = v_uid) then
    raise exception 'the game creator must occupy one of the seats';
  end if;
  if p_current_seat is null or p_current_seat < 0 or p_current_seat >= p_player_count then
    raise exception 'current_seat must be a valid seat';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_invites) i
    where coalesce(i ->> 'user_id', '') <> ''
      and not exists (select 1 from auth.users u where u.id = (i ->> 'user_id')::uuid)
  ) then
    raise exception 'an invited user no longer exists';
  end if;
  if not p_open_lobby and exists (
    select 1 from jsonb_array_elements(p_invites) i where coalesce(i ->> 'user_id', '') = ''
  ) then
    raise exception 'each seat needs an invited user';
  end if;

  insert into public.games (
    created_by,
    name,
    seed,
    player_count,
    options,
    status,
    current_seat,
    starting_seat,
    setup_move
  )
  values (
    v_uid,
    coalesce(p_name, ''),
    p_seed,
    p_player_count,
    p_options,
    case when p_open_lobby then 'open' else 'active' end,
    case when p_open_lobby then null else p_current_seat end,
    p_current_seat,
    nullif(trim(coalesce(p_setup_move, '')), '')
  )
  returning id into v_game;

  insert into public.players (game_id, seat, invited_email, display_name, user_id)
  select
    v_game,
    (i ->> 'seat')::int,
    case
      when coalesce(i ->> 'user_id', '') <> '' then lower(u.email)
      else format('open-seat-%s@lobby.invalid', i ->> 'seat')
    end,
    case
      when coalesce(i ->> 'user_id', '') <> '' then coalesce(i ->> 'display_name', '')
      else ''
    end,
    u.id
  from jsonb_array_elements(p_invites) i
  left join auth.users u on u.id = nullif(i ->> 'user_id', '')::uuid;

  if p_setup_move is not null and length(trim(p_setup_move)) > 0 then
    insert into public.moves (game_id, seq, seat, move, committed_by)
    values (v_game, 1, p_player_count - 1, p_setup_move, v_uid);

    update public.games set move_count = 1 where id = v_game;
  end if;

  return v_game;
end;
$$;

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

  select coalesce(
           nullif(raw_user_meta_data ->> 'full_name', ''),
           nullif(raw_user_meta_data ->> 'name', ''),
           split_part(email::text, '@', 1)
         )
  into v_display_name
  from auth.users
  where id = v_uid;

  update public.players
  set user_id = v_uid,
      invited_email = v_email,
      display_name = coalesce(v_display_name, split_part(v_email, '@', 1))
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

create or replace function public.leave_open_game_seat(p_game_id uuid, p_seat int)
returns public.games
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_uid is null then
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
    raise exception 'only open lobby seats can be abandoned';
  end if;

  update public.players
  set user_id = null,
      invited_email = format('open-seat-%s@lobby.invalid', p_seat),
      display_name = ''
  where game_id = p_game_id and seat = p_seat and user_id = v_uid;

  if not found then
    raise exception 'seat % is not yours', p_seat;
  end if;

  update public.games
  set current_seat = null
  where id = p_game_id
  returning * into v_game;

  return v_game;
end;
$$;

revoke execute on function public.create_game(text, text, int, jsonb, jsonb, int, text, boolean) from public, anon;
grant execute on function public.create_game(text, text, int, jsonb, jsonb, int, text, boolean) to authenticated;

revoke execute on function public.join_open_game_seat(uuid, int) from public, anon;
grant execute on function public.join_open_game_seat(uuid, int) to authenticated;

revoke execute on function public.leave_open_game_seat(uuid, int) from public, anon;
grant execute on function public.leave_open_game_seat(uuid, int) to authenticated;
