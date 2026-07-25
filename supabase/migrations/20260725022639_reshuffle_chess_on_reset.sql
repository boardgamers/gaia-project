-- A confirmed long-press reset starts a genuinely new chess game: restore the opening position
-- and run the same locked assignment routine again so the current participants receive freshly
-- randomized colours/relay teams. The caller must still belong to an existing chess team.
create or replace function public.reset_chess(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_board public.chess_board%rowtype;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  select *
  into v_board
  from public.chess_board
  where game_id = p_game_id
  for update;

  if not found
    or not (
      v_board.white_user = v_uid
      or v_board.white_user_2 = v_uid
      or v_board.black_user = v_uid
      or v_board.black_user_2 = v_uid
    )
  then
    raise exception 'only a chess team member can reset';
  end if;

  update public.chess_board
  set fen = public.chess_start_fen(),
      last_move_from = null,
      last_move_to = null,
      assignment_version = 0,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id;

  perform public.ensure_chess_assignment(p_game_id);
end;
$$;

revoke execute on function public.reset_chess(uuid) from public, anon;
grant execute on function public.reset_chess(uuid) to authenticated;
