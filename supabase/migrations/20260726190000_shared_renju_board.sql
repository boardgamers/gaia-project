-- One small, fully independent renju (gomoku) position per hosted Gaia game, played on the second
-- face of the research board's swipe drawer - the exact counterpart of `chess_board`, which backs
-- the booster/federation sidebar's chess face. Renju never enters the Gaia engine move log, so
-- switching the research panel cannot disturb either game.
--
-- Rule set: standard gomoku on 15x15. Black opens; a line of exactly five wins and an overline of
-- six or more does not. The viewer owns win detection (logic/renju.ts); this table persists the
-- position, enforces who may play, and fans changes out over Realtime.

create or replace function public.renju_start_board()
returns text
language sql
immutable
set search_path = ''
as $$
  select repeat('.', 225)::text
$$;

create table if not exists public.renju_board (
  game_id            uuid primary key references public.games (id) on delete cascade,
  board              text not null default public.renju_start_board(),
  last_move          smallint,
  panel_mode         text not null default 'research',
  black_user         uuid references auth.users (id) on delete set null,
  black_user_2       uuid references auth.users (id) on delete set null,
  white_user         uuid references auth.users (id) on delete set null,
  white_user_2       uuid references auth.users (id) on delete set null,
  black_next_user    uuid references auth.users (id) on delete set null,
  white_next_user    uuid references auth.users (id) on delete set null,
  assignment_version smallint not null default 0,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null,
  constraint renju_board_board_check check (length(board) = 225 and board ~ '^[.bw]+$'),
  constraint renju_board_last_move_check check (last_move is null or (last_move >= 0 and last_move < 225)),
  constraint renju_board_panel_mode_check check (panel_mode in ('research', 'renju')),
  constraint renju_board_assignment_version_check check (assignment_version between 0 and 1)
);

-- Foreign-key columns that are filtered/joined on want their own indexes (same follow-up the chess
-- table needed once it was live).
create index if not exists renju_board_black_user_idx on public.renju_board (black_user);
create index if not exists renju_board_black_user_2_idx on public.renju_board (black_user_2);
create index if not exists renju_board_white_user_idx on public.renju_board (white_user);
create index if not exists renju_board_white_user_2_idx on public.renju_board (white_user_2);
create index if not exists renju_board_updated_by_idx on public.renju_board (updated_by);

alter table public.renju_board enable row level security;

-- Approved users may spectate any hosted game, matching the games/moves visibility model. Nobody
-- writes this table directly; the narrowly granted RPCs below are the only write paths.
drop policy if exists renju_board_select on public.renju_board;
create policy renju_board_select on public.renju_board
  for select
  to authenticated
  using ((select public.is_approved()));

revoke all on table public.renju_board from public, anon, authenticated;
grant select on table public.renju_board to authenticated;
grant all on table public.renju_board to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'renju_board'
  ) then
    alter publication supabase_realtime add table public.renju_board;
  end if;
end;
$$;

-- Assign colours and relay teams once per game, in the database and under the row lock, so two
-- clients opening the panel simultaneously always receive the same random teams. Distinct signed-in
-- people (not Gaia seats) define the player count, which keeps one-account owner test games usable.
create or replace function public.ensure_renju_assignment(p_game_id uuid)
returns public.renju_board
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_board      public.renju_board%rowtype;
  v_users      uuid[];
  v_user_count integer;
  v_black_1    uuid;
  v_black_2    uuid;
  v_white_1    uuid;
  v_white_2    uuid;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;
  if not exists (select 1 from public.games g where g.id = p_game_id) then
    raise exception 'game not found';
  end if;

  insert into public.renju_board (game_id, updated_by)
  values (p_game_id, v_uid)
  on conflict (game_id) do nothing;

  select *
  into v_board
  from public.renju_board
  where game_id = p_game_id
  for update;

  if v_board.assignment_version >= 1 then
    return v_board;
  end if;

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
    raise exception 'unsupported renju player count';
  end if;

  if v_user_count = 1 then
    -- A one-account test game behaves like hosted pass-and-play.
    v_black_1 := v_users[1];
    v_white_1 := v_users[1];
  elsif v_user_count = 2 then
    v_black_1 := v_users[1];
    v_white_1 := v_users[2];
  elsif v_user_count = 3 then
    -- Randomly choose which colour is the two-person relay as well as shuffling its members.
    if random() < 0.5 then
      v_black_1 := v_users[1];
      v_black_2 := v_users[2];
      v_white_1 := v_users[3];
    else
      v_black_1 := v_users[1];
      v_white_1 := v_users[2];
      v_white_2 := v_users[3];
    end if;
  else
    v_black_1 := v_users[1];
    v_black_2 := v_users[2];
    v_white_1 := v_users[3];
    v_white_2 := v_users[4];
  end if;

  update public.renju_board
  set black_user = v_black_1,
      black_user_2 = v_black_2,
      white_user = v_white_1,
      white_user_2 = v_white_2,
      black_next_user = v_black_1,
      white_next_user = v_white_1,
      assignment_version = 1,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id
  returning * into v_board;

  return v_board;
end;
$$;

-- Optimistic concurrency under a row lock, exactly like move_chess: a stale previous board simply
-- hands the caller the current position back instead of raising. The single `overlay` comparison
-- below is the whole legality check the database needs - it proves the new board adds exactly one
-- stone, of the colour whose turn it is, on the claimed empty intersection, and changes nothing
-- else. (Five-in-a-row itself is detected in the viewer; a finished game is simply reset.)
create or replace function public.move_renju(p_game_id uuid, p_prev_board text, p_next_board text, p_index integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_board  public.renju_board%rowtype;
  v_black  integer;
  v_white  integer;
  v_active text;
  v_mover  uuid;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  select *
  into v_board
  from public.renju_board
  where game_id = p_game_id
  for update;

  if not found then
    raise exception 'no renju board for game';
  end if;
  if v_board.board is distinct from p_prev_board then
    return v_board.board;
  end if;

  v_black := length(v_board.board) - length(replace(v_board.board, 'b', ''));
  v_white := length(v_board.board) - length(replace(v_board.board, 'w', ''));
  v_active := case when v_black = v_white then 'b' else 'w' end;

  v_mover := case
    when v_active = 'b' then coalesce(v_board.black_next_user, v_board.black_user, v_board.black_user_2)
    else coalesce(v_board.white_next_user, v_board.white_user, v_board.white_user_2)
  end;
  if v_mover is null or v_mover <> v_uid then
    raise exception 'not your renju move';
  end if;

  if p_index is null
     or p_index < 0
     or p_index > 224
     or substr(v_board.board, p_index + 1, 1) <> '.'
     or p_next_board is distinct from overlay(v_board.board placing v_active from p_index + 1 for 1) then
    raise exception 'invalid renju move';
  end if;

  update public.renju_board
  set board = p_next_board,
      last_move = p_index,
      black_next_user = case
        when v_active <> 'b' then black_next_user
        when black_user is not null and black_user_2 is not null then
          case when v_mover = black_user then black_user_2 else black_user end
        else coalesce(black_user, black_user_2)
      end,
      white_next_user = case
        when v_active <> 'w' then white_next_user
        when white_user is not null and white_user_2 is not null then
          case when v_mover = white_user then white_user_2 else white_user end
        else coalesce(white_user, white_user_2)
      end,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id;
  return p_next_board;
end;
$$;

-- A confirmed long-press reset starts a genuinely new game: empty board plus freshly randomized
-- colours/relay teams from the current participants. The caller must belong to an existing team.
create or replace function public.reset_renju(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_board public.renju_board%rowtype;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  select *
  into v_board
  from public.renju_board
  where game_id = p_game_id
  for update;

  if not found
    or not (
      v_board.black_user = v_uid
      or v_board.black_user_2 = v_uid
      or v_board.white_user = v_uid
      or v_board.white_user_2 = v_uid
    )
  then
    raise exception 'only a renju team member can reset';
  end if;

  update public.renju_board
  set board = public.renju_start_board(),
      last_move = null,
      assignment_version = 0,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id;

  perform public.ensure_renju_assignment(p_game_id);
end;
$$;

-- The research panel has two shared faces: the research board itself and renju. Any participant in
-- the Gaia game may switch the face; approved spectators receive the same value over Realtime but
-- cannot change it (the viewer keeps their own local face instead).
create or replace function public.set_renju_panel_mode(p_game_id uuid, p_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;
  if p_mode is null or p_mode not in ('research', 'renju') then
    raise exception 'bad renju panel mode %', p_mode;
  end if;
  if not exists (
    select 1
    from public.players p
    where p.game_id = p_game_id
      and public.is_seat_owner(p.game_id, p.seat)
  ) then
    raise exception 'only a player in this game can switch the renju panel';
  end if;

  insert into public.renju_board as board (game_id, panel_mode, updated_by)
  values (p_game_id, p_mode, v_uid)
  on conflict (game_id) do update
    set panel_mode = excluded.panel_mode,
        updated_at = now(),
        updated_by = v_uid;
end;
$$;

revoke execute on function public.renju_start_board() from public, anon, authenticated;
revoke execute on function public.ensure_renju_assignment(uuid) from public, anon;
revoke execute on function public.move_renju(uuid, text, text, integer) from public, anon;
revoke execute on function public.reset_renju(uuid) from public, anon;
revoke execute on function public.set_renju_panel_mode(uuid, text) from public, anon;
grant execute on function public.ensure_renju_assignment(uuid) to authenticated;
grant execute on function public.move_renju(uuid, text, text, integer) to authenticated;
grant execute on function public.reset_renju(uuid) to authenticated;
grant execute on function public.set_renju_panel_mode(uuid, text) to authenticated;
