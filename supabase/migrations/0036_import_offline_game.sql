-- "Move offline game to online lobby" (owner request, 2026-07-18): imports a fully local
-- (`?offline=1`) pass-and-play game's complete move history into a brand-new hosted game, so it can
-- continue as normal Supabase-backed multiplayer instead of being stuck in one device's
-- localStorage. Unlike create_game (which only ever seeds a single history row - the initial
-- sector-rotation setup move, `p_setup_move`), this bulk-inserts every already-played turn at once
-- and starts the new game already mid-play (or finished), with every seat assigned to a real
-- registered account up front - the same "direct invite" semantics create_game already uses for a
-- brand new game, just applied here to a game that already has history. There is no "open seat"
-- concept for an import: the importing player must already know which registered account (possibly
-- themselves, for every seat) continues each seat.
--
-- p_moves items: {seq, seat, move}, seq exactly 1..N in order - derived client-side (see
-- import-offline-game.ts's deriveImportedMoveRows) by replaying the offline save's engineData
-- through a fresh Engine one move at a time, since a move's acting seat is only known from the
-- engine's live state while it is being played (the same technique host.ts's applyAndCommit already
-- uses for a live commit).

create or replace function public.import_offline_game(
  p_name text,
  p_seed text,
  p_player_count int,
  p_options jsonb,
  p_invites jsonb,
  p_moves jsonb,
  p_current_seat int,
  p_finished boolean,
  p_current_round int default null,
  p_latest_move_summary text default null,
  p_player_updates jsonb default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_game       uuid;
  v_move_count int;
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
  if exists (select 1 from jsonb_array_elements(p_invites) i where coalesce(i ->> 'user_id', '') = '') then
    raise exception 'each seat needs an assigned player';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_invites) i
                 where (i ->> 'user_id')::uuid = v_uid) then
    raise exception 'the importing player must occupy one of the seats';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_invites) i
    where not exists (select 1 from auth.users u where u.id = (i ->> 'user_id')::uuid)
  ) then
    raise exception 'an assigned player no longer exists';
  end if;

  if jsonb_typeof(p_moves) is distinct from 'array' or jsonb_array_length(p_moves) = 0 then
    raise exception 'moves must be a non-empty array';
  end if;
  select count(*) into v_move_count from jsonb_array_elements(p_moves);
  if exists (
    select 1
    from jsonb_array_elements(p_moves) with ordinality as t(elem, idx)
    where (elem ->> 'seq')::int is distinct from idx::int
  ) then
    raise exception 'moves must be sequential starting at 1';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_moves) i
    where (i ->> 'seat')::int < 0 or (i ->> 'seat')::int >= p_player_count
       or coalesce(length(trim(i ->> 'move')), 0) = 0
  ) then
    raise exception 'each move needs a valid seat and non-empty text';
  end if;

  if not p_finished and (p_current_seat is null or p_current_seat < 0 or p_current_seat >= p_player_count) then
    raise exception 'current_seat must be a valid seat while the game is active';
  end if;

  insert into public.games (
    created_by, name, seed, player_count, options, status, current_seat,
    move_count, current_round, latest_move_summary, latest_move_committed_at
  )
  values (
    v_uid, coalesce(p_name, ''), p_seed, p_player_count, p_options,
    case when p_finished then 'finished' else 'active' end,
    case when p_finished then null else p_current_seat end,
    v_move_count, p_current_round, p_latest_move_summary, now()
  )
  returning id into v_game;

  insert into public.players (game_id, seat, invited_email, display_name, user_id)
  select
    v_game,
    (i ->> 'seat')::int,
    lower(u.email),
    coalesce(i ->> 'display_name', ''),
    u.id
  from jsonb_array_elements(p_invites) i
  join auth.users u on u.id = (i ->> 'user_id')::uuid;

  insert into public.moves (game_id, seq, seat, move, committed_by)
  select v_game, (m ->> 'seq')::int, (m ->> 'seat')::int, m ->> 'move', v_uid
  from jsonb_array_elements(p_moves) m;

  if p_player_updates is not null then
    update public.players pl
    set faction = coalesce(u.faction, pl.faction),
        score   = coalesce(u.score, pl.score)
    from jsonb_to_recordset(p_player_updates) as u(seat int, faction text, score int)
    where pl.game_id = v_game and pl.seat = u.seat;
  end if;

  return v_game;
end;
$$;

revoke execute on function public.import_offline_game(
  text, text, int, jsonb, jsonb, jsonb, int, boolean, int, text, jsonb
) from public, anon;
grant execute on function public.import_offline_game(
  text, text, int, jsonb, jsonb, jsonb, int, boolean, int, text, jsonb
) to authenticated;
