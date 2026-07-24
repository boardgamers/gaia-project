-- FEN stores the position but not the origin and destination of the previous move. Persist those
-- two squares on the same per-game row so every viewer can render a reload-safe last-move marker.
alter table public.chess_board
  add column if not exists last_move_from text,
  add column if not exists last_move_to text;

alter table public.chess_board
  drop constraint if exists chess_board_last_move_squares_check;

alter table public.chess_board
  add constraint chess_board_last_move_squares_check
  check (
    (last_move_from is null and last_move_to is null)
    or (
      last_move_from ~ '^[a-h][1-8]$'
      and last_move_to ~ '^[a-h][1-8]$'
      and last_move_from <> last_move_to
    )
  );

-- Keep the existing three-argument RPC during rollout so already-open clients can still move.
create or replace function public.move_chess(
  p_game_id uuid,
  p_prev_fen text,
  p_next_fen text,
  p_move_from text,
  p_move_to text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_board  public.chess_board%rowtype;
  v_active text;
  v_mover  uuid;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  select *
  into v_board
  from public.chess_board
  where game_id = p_game_id
  for update;

  if not found then
    raise exception 'no chess board for game';
  end if;
  if v_board.fen is distinct from p_prev_fen then
    return v_board.fen;
  end if;

  v_active := split_part(v_board.fen, ' ', 2);
  v_mover := case
    when v_active = 'w' then coalesce(v_board.white_next_user, v_board.white_user, v_board.white_user_2)
    else coalesce(v_board.black_next_user, v_board.black_user, v_board.black_user_2)
  end;
  if v_mover is null or v_mover <> v_uid then
    raise exception 'not your chess move';
  end if;
  if p_next_fen is null
     or length(p_next_fen) not between 20 and 120
     or array_length(string_to_array(p_next_fen, ' '), 1) <> 6
     or split_part(p_next_fen, ' ', 2) <>
        (case when v_active = 'w' then 'b' else 'w' end)
     or p_move_from is null
     or p_move_to is null
     or p_move_from !~ '^[a-h][1-8]$'
     or p_move_to !~ '^[a-h][1-8]$'
     or p_move_from = p_move_to then
    raise exception 'invalid next chess position';
  end if;

  update public.chess_board
  set fen = p_next_fen,
      last_move_from = p_move_from,
      last_move_to = p_move_to,
      white_next_user = case
        when v_active <> 'w' then white_next_user
        when white_user is not null and white_user_2 is not null then
          case when v_mover = white_user then white_user_2 else white_user end
        else coalesce(white_user, white_user_2)
      end,
      black_next_user = case
        when v_active <> 'b' then black_next_user
        when black_user is not null and black_user_2 is not null then
          case when v_mover = black_user then black_user_2 else black_user end
        else coalesce(black_user, black_user_2)
      end,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id;
  return p_next_fen;
end;
$$;

create or replace function public.reset_chess(p_game_id uuid)
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

  update public.chess_board
  set fen = public.chess_start_fen(),
      last_move_from = null,
      last_move_to = null,
      white_next_user = coalesce(white_user, white_user_2),
      black_next_user = coalesce(black_user, black_user_2),
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id
    and (
      white_user = v_uid
      or white_user_2 = v_uid
      or black_user = v_uid
      or black_user_2 = v_uid
    );
  if not found then
    raise exception 'only a chess team member can reset';
  end if;
end;
$$;

revoke execute on function public.move_chess(uuid, text, text, text, text) from public, anon;
grant execute on function public.move_chess(uuid, text, text, text, text) to authenticated;
