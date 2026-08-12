-- The shared renju board grows from the 15x15 gomoku tournament grid to a full 19x19 Go board
-- (owner request, 2026-08-12). The rules are untouched - black opens, a line of EXACTLY five wins,
-- an overline of six or more does not - only the grid is bigger, so the position string goes from
-- 225 to 361 characters and every stored index with it.
--
-- The viewer's own half of this is a single constant (`RENJU_SIZE` in viewer/src/logic/renju.ts);
-- everything there - the SVG, win detection, the analysis engine - is written against it. Which
-- also means the two halves must land together: a client sized for one grid treats the other's
-- board string as invalid and simply ignores it (RenjuBoard.vue::applyRow), so apply this migration
-- when the matching viewer build goes live, not before.
--
-- Positions already in progress are CONVERTED rather than wiped: a 15x15 board is re-centred inside
-- the 19x19 one (offset 2 rows and 2 columns, so the old tengen at (7, 7) lands on the new one at
-- (9, 9)), which preserves every stone's relationship to every other - runs, threats and the two
-- last-move markers all survive, because a pure translation cannot create or break a line.

-- The turn-push trigger fires on any change to `board` (20260726210000_renju_turn_notifications.sql).
-- Re-centring is not a move, so it must not push "your renju move" to a table full of people.
alter table public.renju_board disable trigger renju_board_notify_update;

-- Both checks pin the old size, so they have to come off before the conversion and go back on after.
alter table public.renju_board drop constraint if exists renju_board_board_check;
alter table public.renju_board drop constraint if exists renju_board_last_move_check;
alter table public.renju_board drop constraint if exists renju_board_prev_move_check;

-- Index arithmetic, in both directions: a stored index is row * width + column, so the conversion is
-- "read the old row/column, write it 2 further in on each axis". `where length(board) = 225` makes
-- the whole statement a no-op on a board that is already 19x19 (a re-run, or a row created after
-- `renju_start_board()` below has been replaced).
update public.renju_board b
set board = (
      select string_agg(
               case
                 when i / 19 between 2 and 16 and i % 19 between 2 and 16
                   then substr(b.board, (i / 19 - 2) * 15 + (i % 19 - 2) + 1, 1)
                 else '.'
               end,
               ''
               order by i
             )
      from generate_series(0, 360) as i
    ),
    last_move = case when b.last_move is null then null else (b.last_move / 15 + 2) * 19 + (b.last_move % 15 + 2) end,
    prev_move = case when b.prev_move is null then null else (b.prev_move / 15 + 2) * 19 + (b.prev_move % 15 + 2) end
where length(b.board) = 225;

alter table public.renju_board
  add constraint renju_board_board_check check (length(board) = 361 and board ~ '^[.bw]+$');
alter table public.renju_board
  add constraint renju_board_last_move_check check (last_move is null or (last_move >= 0 and last_move < 361));
alter table public.renju_board
  add constraint renju_board_prev_move_check check (prev_move is null or (prev_move >= 0 and prev_move < 361));

alter table public.renju_board enable trigger renju_board_notify_update;

-- New boards (a new game, or a confirmed reset) start empty at the new size.
create or replace function public.renju_start_board()
returns text
language sql
immutable
set search_path = ''
as $$
  select repeat('.', 361)::text
$$;

-- Unchanged from 20260729120000_renju_previous_move.sql except for the index bound, which is now
-- derived from the stored position's own length instead of being written out as 224. That is the
-- same fact the board check already enforces, so a future size change is one constraint and one
-- `renju_start_board()`, with no third place to forget.
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
     or p_index >= length(v_board.board)
     or substr(v_board.board, p_index + 1, 1) <> '.'
     or p_next_board is distinct from overlay(v_board.board placing v_active from p_index + 1 for 1) then
    raise exception 'invalid renju move';
  end if;

  update public.renju_board
  set board = p_next_board,
      last_move = p_index,
      prev_move = v_board.last_move,
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

revoke execute on function public.renju_start_board() from public, anon, authenticated;
revoke execute on function public.move_renju(uuid, text, text, integer) from public, anon;
grant execute on function public.move_renju(uuid, text, text, integer) to authenticated;
