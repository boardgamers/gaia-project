-- Assign hosted chess colours automatically once per Gaia game.  The assignment is performed in
-- the database (rather than independently in each browser) and under the chess row lock, so two
-- clients opening the panel at the same time always receive the same random teams.
--
-- Distinct signed-in people, rather than Gaia seats, define the chess-player count.  This preserves
-- the normal 2/3/4-player rules while keeping owner test games (one account controlling several
-- Gaia seats) usable: a lone account controls both chess colours and the board rotates each turn.

alter table public.chess_board
  add column if not exists assignment_version smallint not null default 0;

alter table public.chess_board
  drop constraint if exists chess_board_assignment_version_check;

alter table public.chess_board
  add constraint chess_board_assignment_version_check
  check (assignment_version between 0 and 1);

-- The previous manual-seat flow prohibited one account from appearing twice.  Automatic assignment
-- only repeats an account for a one-person test game, where that person must be able to play both
-- sides.  Every normal multiplayer assignment remains unique by construction below.
alter table public.chess_board
  drop constraint if exists chess_board_unique_team_users_check;

create or replace function public.ensure_chess_assignment(p_game_id uuid)
returns public.chess_board
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_board      public.chess_board%rowtype;
  v_users      uuid[];
  v_user_count integer;
  v_white_1    uuid;
  v_white_2    uuid;
  v_black_1    uuid;
  v_black_2    uuid;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;
  if not exists (select 1 from public.games g where g.id = p_game_id) then
    raise exception 'game not found';
  end if;

  insert into public.chess_board (game_id, updated_by)
  values (p_game_id, v_uid)
  on conflict (game_id) do nothing;

  select *
  into v_board
  from public.chess_board
  where game_id = p_game_id
  for update;

  if v_board.assignment_version >= 1 then
    return v_board;
  end if;

  -- `players` can contain the same account in several seats for an explicit owner test game.
  -- Shuffle the distinct people exactly once; the persisted row is the randomization record.
  select array_agg(person.user_id order by random())
  into v_users
  from (
    select distinct p.user_id
    from public.players p
    where p.game_id = p_game_id
      and p.user_id is not null
  ) person;

  v_user_count := coalesce(array_length(v_users, 1), 0);
  if v_user_count = 0 then
    raise exception 'game has no assigned players';
  end if;
  if v_user_count > 4 then
    raise exception 'unsupported chess player count';
  end if;

  if v_user_count = 1 then
    -- A one-account test game behaves like hosted pass-and-play.
    v_white_1 := v_users[1];
    v_black_1 := v_users[1];
  elsif v_user_count = 2 then
    v_white_1 := v_users[1];
    v_black_1 := v_users[2];
  elsif v_user_count = 3 then
    -- Randomly choose which colour is the two-person relay as well as shuffling its members.
    if random() < 0.5 then
      v_white_1 := v_users[1];
      v_white_2 := v_users[2];
      v_black_1 := v_users[3];
    else
      v_white_1 := v_users[1];
      v_black_1 := v_users[2];
      v_black_2 := v_users[3];
    end if;
  else
    v_white_1 := v_users[1];
    v_white_2 := v_users[2];
    v_black_1 := v_users[3];
    v_black_2 := v_users[4];
  end if;

  update public.chess_board
  set white_user = v_white_1,
      white_user_2 = v_white_2,
      black_user = v_black_1,
      black_user_2 = v_black_2,
      white_next_user = v_white_1,
      black_next_user = v_black_1,
      assignment_version = 1,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id
  returning * into v_board;

  return v_board;
end;
$$;

revoke execute on function public.ensure_chess_assignment(uuid) from public, anon;
grant execute on function public.ensure_chess_assignment(uuid) to authenticated;
