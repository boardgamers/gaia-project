-- One Ultimate tic-tac-toe position per hosted Gaia game. The viewer renders it as the second face
-- of the Lost Fleet ship-board drawer; it never enters the Gaia engine move log. X opens. A move's
-- cell within its 3x3 mini board routes the opponent to the corresponding next mini board, unless
-- that destination is already won/full, in which case placement is free.

create or replace function public.ultimate_ttt_start_board()
returns text
language sql
immutable
set search_path = ''
as $$
  select repeat('.', 81)::text
$$;

create or replace function public.ultimate_ttt_small_winner(p_board text, p_mini integer)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_base integer;
  v_line integer[];
  v_mark text;
  v_lines constant integer[][] := array[
    array[0, 1, 2], array[3, 4, 5], array[6, 7, 8],
    array[0, 3, 6], array[1, 4, 7], array[2, 5, 8],
    array[0, 4, 8], array[2, 4, 6]
  ];
begin
  if p_board is null or length(p_board) <> 81 or p_mini < 0 or p_mini > 8 then
    return null;
  end if;
  v_base := p_mini * 9;
  foreach v_line slice 1 in array v_lines loop
    v_mark := substr(p_board, v_base + v_line[1] + 1, 1);
    if v_mark in ('x', 'o')
       and substr(p_board, v_base + v_line[2] + 1, 1) = v_mark
       and substr(p_board, v_base + v_line[3] + 1, 1) = v_mark then
      return v_mark;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.ultimate_ttt_small_decided(p_board text, p_mini integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select public.ultimate_ttt_small_winner(p_board, p_mini) is not null
    or strpos(substr(p_board, p_mini * 9 + 1, 9), '.') = 0
$$;

create or replace function public.ultimate_ttt_meta_winner(p_board text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_line integer[];
  v_mark text;
  v_lines constant integer[][] := array[
    array[0, 1, 2], array[3, 4, 5], array[6, 7, 8],
    array[0, 3, 6], array[1, 4, 7], array[2, 5, 8],
    array[0, 4, 8], array[2, 4, 6]
  ];
begin
  foreach v_line slice 1 in array v_lines loop
    v_mark := public.ultimate_ttt_small_winner(p_board, v_line[1]);
    if v_mark is not null
       and public.ultimate_ttt_small_winner(p_board, v_line[2]) = v_mark
       and public.ultimate_ttt_small_winner(p_board, v_line[3]) = v_mark then
      return v_mark;
    end if;
  end loop;
  return null;
end;
$$;

create or replace function public.ultimate_ttt_is_draw(p_board text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_mini integer;
begin
  if public.ultimate_ttt_meta_winner(p_board) is not null then
    return false;
  end if;
  for v_mini in 0..8 loop
    if not public.ultimate_ttt_small_decided(p_board, v_mini) then
      return false;
    end if;
  end loop;
  return true;
end;
$$;

create table public.ultimate_ttt_board (
  game_id            uuid primary key references public.games (id) on delete cascade,
  board              text not null default public.ultimate_ttt_start_board(),
  last_move          smallint,
  x_user              uuid references auth.users (id) on delete set null,
  x_user_2            uuid references auth.users (id) on delete set null,
  o_user              uuid references auth.users (id) on delete set null,
  o_user_2            uuid references auth.users (id) on delete set null,
  x_next_user         uuid references auth.users (id) on delete set null,
  o_next_user         uuid references auth.users (id) on delete set null,
  assignment_version smallint not null default 0,
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null,
  constraint ultimate_ttt_board_shape_check check (length(board) = 81 and board ~ '^[.xo]+$'),
  constraint ultimate_ttt_last_move_check check (last_move is null or (last_move >= 0 and last_move < 81)),
  constraint ultimate_ttt_assignment_version_check check (assignment_version between 0 and 1)
);

create index ultimate_ttt_board_x_user_idx on public.ultimate_ttt_board (x_user);
create index ultimate_ttt_board_x_user_2_idx on public.ultimate_ttt_board (x_user_2);
create index ultimate_ttt_board_o_user_idx on public.ultimate_ttt_board (o_user);
create index ultimate_ttt_board_o_user_2_idx on public.ultimate_ttt_board (o_user_2);
create index ultimate_ttt_board_x_next_user_idx on public.ultimate_ttt_board (x_next_user);
create index ultimate_ttt_board_o_next_user_idx on public.ultimate_ttt_board (o_next_user);
create index ultimate_ttt_board_updated_by_idx on public.ultimate_ttt_board (updated_by);

alter table public.ultimate_ttt_board enable row level security;

create policy ultimate_ttt_board_select on public.ultimate_ttt_board
  for select
  to authenticated
  using ((select public.is_approved()));

revoke all on table public.ultimate_ttt_board from public, anon, authenticated;
grant select on table public.ultimate_ttt_board to authenticated;
grant all on table public.ultimate_ttt_board to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ultimate_ttt_board'
  ) then
    alter publication supabase_realtime add table public.ultimate_ttt_board;
  end if;
end;
$$;

-- Randomize the two sides once under a row lock. Three- and four-account games use the same
-- alternating relay arrangement as chess and renju; one-account owner games remain pass-and-play.
create or replace function public.ensure_ultimate_ttt_assignment(p_game_id uuid)
returns public.ultimate_ttt_board
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_board      public.ultimate_ttt_board%rowtype;
  v_users      uuid[];
  v_user_count integer;
  v_x_1        uuid;
  v_x_2        uuid;
  v_o_1        uuid;
  v_o_2        uuid;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;
  if not exists (select 1 from public.games g where g.id = p_game_id) then
    raise exception 'game not found';
  end if;

  insert into public.ultimate_ttt_board (game_id, updated_by)
  values (p_game_id, v_uid)
  on conflict (game_id) do nothing;

  select *
  into v_board
  from public.ultimate_ttt_board
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
    raise exception 'unsupported Ultimate tic-tac-toe player count';
  end if;

  if v_user_count = 1 then
    v_x_1 := v_users[1];
    v_o_1 := v_users[1];
  elsif v_user_count = 2 then
    v_x_1 := v_users[1];
    v_o_1 := v_users[2];
  elsif v_user_count = 3 then
    if random() < 0.5 then
      v_x_1 := v_users[1];
      v_x_2 := v_users[2];
      v_o_1 := v_users[3];
    else
      v_x_1 := v_users[1];
      v_o_1 := v_users[2];
      v_o_2 := v_users[3];
    end if;
  else
    v_x_1 := v_users[1];
    v_x_2 := v_users[2];
    v_o_1 := v_users[3];
    v_o_2 := v_users[4];
  end if;

  update public.ultimate_ttt_board
  set x_user = v_x_1,
      x_user_2 = v_x_2,
      o_user = v_o_1,
      o_user_2 = v_o_2,
      x_next_user = v_x_1,
      o_next_user = v_o_1,
      assignment_version = 1,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id
  returning * into v_board;

  return v_board;
end;
$$;

-- Optimistic concurrency plus complete server-side move validation. The client sends the expected
-- one-character overlay, while this function independently enforces turn, route, mini-board state,
-- whole-game state, and designated relay mover under the row lock.
create or replace function public.move_ultimate_ttt(
  p_game_id uuid,
  p_prev_board text,
  p_next_board text,
  p_index integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_board        public.ultimate_ttt_board%rowtype;
  v_x_count      integer;
  v_o_count      integer;
  v_active       text;
  v_mover        uuid;
  v_mini         integer;
  v_forced_mini  integer;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  select *
  into v_board
  from public.ultimate_ttt_board
  where game_id = p_game_id
  for update;

  if not found then
    raise exception 'no Ultimate tic-tac-toe board for game';
  end if;
  if v_board.board is distinct from p_prev_board then
    return v_board.board;
  end if;
  if public.ultimate_ttt_meta_winner(v_board.board) is not null
     or public.ultimate_ttt_is_draw(v_board.board) then
    raise exception 'Ultimate tic-tac-toe game is over';
  end if;

  v_x_count := length(v_board.board) - length(replace(v_board.board, 'x', ''));
  v_o_count := length(v_board.board) - length(replace(v_board.board, 'o', ''));
  if not (v_x_count = v_o_count or v_x_count = v_o_count + 1) then
    raise exception 'invalid Ultimate tic-tac-toe position';
  end if;
  v_active := case when v_x_count = v_o_count then 'x' else 'o' end;

  v_mover := case
    when v_active = 'x' then coalesce(v_board.x_next_user, v_board.x_user, v_board.x_user_2)
    else coalesce(v_board.o_next_user, v_board.o_user, v_board.o_user_2)
  end;
  if v_mover is null or v_mover <> v_uid then
    raise exception 'not your Ultimate tic-tac-toe move';
  end if;

  if p_index is null
     or p_index < 0
     or p_index > 80
     or substr(v_board.board, p_index + 1, 1) <> '.'
     or p_next_board is distinct from overlay(v_board.board placing v_active from p_index + 1 for 1) then
    raise exception 'invalid Ultimate tic-tac-toe move';
  end if;

  v_mini := p_index / 9;
  if public.ultimate_ttt_small_decided(v_board.board, v_mini) then
    raise exception 'small board is already decided';
  end if;
  if v_board.last_move is not null then
    v_forced_mini := mod(v_board.last_move, 9);
    if not public.ultimate_ttt_small_decided(v_board.board, v_forced_mini)
       and v_mini <> v_forced_mini then
      raise exception 'move is outside the forced small board';
    end if;
  end if;

  update public.ultimate_ttt_board
  set board = p_next_board,
      last_move = p_index,
      x_next_user = case
        when v_active <> 'x' then x_next_user
        when x_user is not null and x_user_2 is not null then
          case when v_mover = x_user then x_user_2 else x_user end
        else coalesce(x_user, x_user_2)
      end,
      o_next_user = case
        when v_active <> 'o' then o_next_user
        when o_user is not null and o_user_2 is not null then
          case when v_mover = o_user then o_user_2 else o_user end
        else coalesce(o_user, o_user_2)
      end,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id;

  return p_next_board;
end;
$$;

create or replace function public.reset_ultimate_ttt(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_board public.ultimate_ttt_board%rowtype;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  select *
  into v_board
  from public.ultimate_ttt_board
  where game_id = p_game_id
  for update;

  if not found
    or not (
      v_board.x_user = v_uid
      or v_board.x_user_2 = v_uid
      or v_board.o_user = v_uid
      or v_board.o_user_2 = v_uid
    )
  then
    raise exception 'only an Ultimate tic-tac-toe player can reset';
  end if;

  update public.ultimate_ttt_board
  set board = public.ultimate_ttt_start_board(),
      last_move = null,
      x_user = null,
      x_user_2 = null,
      o_user = null,
      o_user_2 = null,
      x_next_user = null,
      o_next_user = null,
      assignment_version = 0,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id;

  perform public.ensure_ultimate_ttt_assignment(p_game_id);
end;
$$;

revoke execute on function public.ultimate_ttt_start_board() from public, anon, authenticated;
revoke execute on function public.ultimate_ttt_small_winner(text, integer) from public, anon, authenticated;
revoke execute on function public.ultimate_ttt_small_decided(text, integer) from public, anon, authenticated;
revoke execute on function public.ultimate_ttt_meta_winner(text) from public, anon, authenticated;
revoke execute on function public.ultimate_ttt_is_draw(text) from public, anon, authenticated;
revoke execute on function public.ensure_ultimate_ttt_assignment(uuid) from public, anon;
revoke execute on function public.move_ultimate_ttt(uuid, text, text, integer) from public, anon;
revoke execute on function public.reset_ultimate_ttt(uuid) from public, anon;
grant execute on function public.ensure_ultimate_ttt_assignment(uuid) to authenticated;
grant execute on function public.move_ultimate_ttt(uuid, text, text, integer) to authenticated;
grant execute on function public.reset_ultimate_ttt(uuid) to authenticated;
