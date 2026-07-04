-- Lobby game-bar redesign (boardgamers.space parity): each game row should show the current
-- round, and each seated player's faction + score, without replaying every game's full move log
-- through the client-side engine just to render the lobby list.
--
-- The engine is client-side and authoritative (see BACKEND.md) - there is no server-side game
-- logic to derive these from the move log directly, so instead the already-loaded client engine
-- (which just computed the new turn to commit it) passes its own freshly-computed round/faction/
-- score numbers into commit_turn alongside the move itself. These are purely a cached display
-- convenience for the lobby list - never read by the engine itself, so a stale/missing value
-- (e.g. games committed before this migration) cannot desync gameplay, only the lobby row's own
-- display until that game's next move commits.

alter table public.games add column if not exists current_round int;
alter table public.players add column if not exists faction text;
alter table public.players add column if not exists score int;

-- Widening commit_turn's parameter list via CREATE OR REPLACE does NOT reuse the existing
-- function's identity when the argument count changes (see 0005's postmortem) - it creates a
-- second, distinct overload instead, and calls with the original 6 args become ambiguous between
-- the two. Drop the stale signature outright first, same fix as 0005.
drop function if exists public.commit_turn(uuid, int, int, text, int, boolean);

create or replace function public.commit_turn(
  p_game_id uuid,
  p_seq int,
  p_seat int,
  p_move text,
  p_next_seat int,
  p_finished boolean,
  p_current_round int default null,
  p_player_updates jsonb default null -- array of {"seat": int, "faction": text, "score": int}
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_move is null or length(trim(p_move)) = 0 then
    raise exception 'empty move';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;
  if p_seq is distinct from v_game.move_count + 1 then
    raise exception 'seq_conflict: expected %, got %', v_game.move_count + 1, p_seq;
  end if;
  if not p_finished and (p_next_seat is null or p_next_seat < 0
                         or p_next_seat >= v_game.player_count) then
    raise exception 'next_seat must be a valid seat while the game is active';
  end if;

  insert into public.moves (game_id, seq, seat, move, committed_by)
  values (p_game_id, p_seq, p_seat, p_move, v_uid);

  update public.games
  set move_count        = p_seq,
      current_seat      = case when p_finished then null else p_next_seat end,
      status            = case when p_finished then 'finished' else status end,
      last_committed_by = v_uid,
      current_round     = coalesce(p_current_round, current_round)
  where id = p_game_id;

  if p_player_updates is not null then
    update public.players pl
    set faction = coalesce(u.faction, pl.faction),
        score   = coalesce(u.score, pl.score)
    from jsonb_to_recordset(p_player_updates) as u(seat int, faction text, score int)
    where pl.game_id = p_game_id and pl.seat = u.seat;
  end if;
end;
$$;

revoke execute on function public.commit_turn(uuid, int, int, text, int, boolean, int, jsonb) from public, anon;
grant execute on function public.commit_turn(uuid, int, int, text, int, boolean, int, jsonb) to authenticated;
