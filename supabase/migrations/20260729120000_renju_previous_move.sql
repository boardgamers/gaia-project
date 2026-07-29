-- Both sides' latest stones are marked on the renju board (owner request: "mark my own last move as
-- well and not just opponents last move"), so the position has to remember one move further back
-- than `last_move` - otherwise a reload leaves the player who is to move with only the opponent's
-- marker, which is exactly what it did before.
--
-- The same shape chess already uses: 20260724185341_persist_chess_last_move added `last_from`/
-- `last_to` to `chess_board` so its highlight survived a reload. Nothing reads `prev_move` except
-- the viewer's marker, and it is nullable, so a client that predates this column is unaffected.

alter table public.renju_board
  add column if not exists prev_move smallint;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.renju_board'::regclass
      and conname = 'renju_board_prev_move_check'
  ) then
    alter table public.renju_board
      add constraint renju_board_prev_move_check
      check (prev_move is null or (prev_move >= 0 and prev_move < 225));
  end if;
end;
$$;

-- Unchanged from 20260726190000_shared_renju_board.sql apart from carrying the outgoing `last_move`
-- into `prev_move`, which is what makes the two markers the two colours' latest stones: play always
-- alternates, so the move before the last one is by definition the other colour's.
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

-- A reset clears both markers along with the position.
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
      prev_move = null,
      assignment_version = 0,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id;

  perform public.ensure_renju_assignment(p_game_id);
end;
$$;

revoke execute on function public.move_renju(uuid, text, text, integer) from public, anon;
revoke execute on function public.reset_renju(uuid) from public, anon;
grant execute on function public.move_renju(uuid, text, text, integer) to authenticated;
grant execute on function public.reset_renju(uuid) to authenticated;
