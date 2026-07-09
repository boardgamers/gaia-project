-- Fix: "time since last move" on the lobby game bar relied entirely on an unbounded, cross-game
-- client query (`.from("moves").select(...).in("game_id", <every game id>).order("seq", desc)`,
-- no cache) - unlike `latest_move_summary`, which was cached on `games` back in migration 0019.
-- With 1500+ total rows in `moves`, that query silently hits PostgREST's default row cap; whichever
-- games' rows don't survive the cap lose their computed age entirely, while latest_move_summary
-- (cached separately at commit time) keeps working fine - exactly the live-reported "the summary
-- text shows but the age next to it doesn't, for this one game" symptom.
--
-- Fix, mirroring latest_move_summary's own pattern exactly: cache the latest move's timestamp
-- directly on `games`, updated by commit_turn at write time so it's always current without a
-- separate query.

alter table public.games add column if not exists latest_move_committed_at timestamptz;

-- One-time backfill for every existing game - a small, per-game correlated MAX(), not the
-- unbounded cross-game query that caused the bug in the first place.
update public.games g
set latest_move_committed_at = (
  select max(m.committed_at) from public.moves m where m.game_id = g.id
)
where latest_move_committed_at is null;

create or replace function public.commit_turn(
  p_game_id uuid,
  p_seq int,
  p_seat int,
  p_move text,
  p_next_seat int,
  p_finished boolean,
  p_current_round int default null,
  p_latest_move_summary text default null,
  p_player_updates jsonb default null
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_game public.games%rowtype;
  v_committed_at timestamptz;
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
  if not public.is_seat_owner(p_game_id, p_seat) then
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
  values (p_game_id, p_seq, p_seat, p_move, v_uid)
  returning committed_at into v_committed_at;

  update public.games
  set move_count               = p_seq,
      current_seat             = case when p_finished then null else p_next_seat end,
      status                   = case when p_finished then 'finished' else status end,
      last_committed_by        = v_uid,
      current_round            = coalesce(p_current_round, current_round),
      latest_move_summary      = coalesce(p_latest_move_summary, latest_move_summary),
      latest_move_committed_at = v_committed_at
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
