-- "Generate & preview setup" (viewer/src/hosted/SetupPreview.vue): the host
-- now locks in a seed AND a pre-game sector rotation before creating a game,
-- rather than only a seed. See docs/lost-fleet/BACKEND.md §J3 (seed fixed at
-- creation) — this extends the same "fixed at creation" idea to rotation.
--
-- Rotation only takes effect if the engine actually enters Phase.SetupBoard,
-- which requires engine.options.advancedRules = true (engine/src/move/
-- phase.ts's beginSetupBoardPhase). Lobby.vue now always sets advancedRules,
-- so every new hosted game's very first committed move (moves.seq = 1) must
-- be a Command.RotateSectors line submitted by the last seat
-- (player_count - 1, matching beginSetupBoardPhase's engine.currentPlayer),
-- even a no-op "pN rotate" with zero pairs if the host didn't rotate
-- anything. Without this row, HostedGameHost's generic replay (host.ts:
-- initMoveLine + moves in seq order, no special-casing per move type) would
-- get stuck: the engine expects a rotate move that never arrives.
--
-- create_game gains a trailing p_setup_move parameter (default null, so the
-- existing 6-argument call shape some rows/tests may still reference keeps
-- working): when non-null/non-empty, it's inserted as the moves row for
-- seq = 1, seat = p_player_count - 1, committed_by = the creator. games.
-- move_count is bumped to 1 in the same transaction so the *next* real
-- commit_turn call (the first faction pick) correctly expects seq = 2 rather
-- than colliding with the seq-1 row already written here.

create or replace function public.create_game(
  p_name text,
  p_seed text,
  p_player_count int,
  p_options jsonb,
  p_invites jsonb,
  p_current_seat int,
  p_setup_move text default null
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_email   text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_game    uuid;
  v_missing text;
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
  if exists (select 1 from jsonb_array_elements(p_invites) i
             where coalesce(lower(i ->> 'email'), '') = '') then
    raise exception 'each seat needs an email';
  end if;
  -- Every invited email must already belong to an account, so no seat can be
  -- orphaned by a typo. (Duplicates are fine: that is a test game / one
  -- person playing several seats.)
  select string_agg(e.email, ', ') into v_missing
  from (select distinct lower(i ->> 'email') as email
        from jsonb_array_elements(p_invites) i) e
  where not exists (select 1 from auth.users u where lower(u.email) = e.email);
  if v_missing is not null then
    raise exception 'not registered yet: % — they need to sign in to the site once before you can invite them', v_missing;
  end if;
  if not exists (select 1 from jsonb_array_elements(p_invites) i
                 where lower(i ->> 'email') = v_email) then
    raise exception 'the game creator must occupy one of the seats';
  end if;
  if p_current_seat is null or p_current_seat < 0 or p_current_seat >= p_player_count then
    raise exception 'current_seat must be a valid seat';
  end if;

  insert into public.games (created_by, name, seed, player_count, options, current_seat)
  values (v_uid, coalesce(p_name, ''), p_seed, p_player_count, p_options, p_current_seat)
  returning id into v_game;

  insert into public.players (game_id, seat, invited_email, display_name, user_id)
  select v_game,
         (i ->> 'seat')::int,
         lower(i ->> 'email'),
         coalesce(i ->> 'display_name', ''),
         u.id
  from jsonb_array_elements(p_invites) i
  left join auth.users u on lower(u.email) = lower(i ->> 'email');

  if p_setup_move is not null and length(trim(p_setup_move)) > 0 then
    insert into public.moves (game_id, seq, seat, move, committed_by)
    values (v_game, 1, p_player_count - 1, p_setup_move, v_uid);

    update public.games set move_count = 1 where id = v_game;
  end if;

  return v_game;
end;
$$;

-- Adding a trailing defaulted parameter via CREATE OR REPLACE keeps the same
-- function identity/oid, so the pre-existing 6-argument grant below still
-- applies to calls that omit p_setup_move; the explicit 7-argument grant is
-- added defensively (harmless if redundant) so the widened signature is
-- unambiguously covered too.
revoke execute on function public.create_game(text, text, int, jsonb, jsonb, int, text) from public, anon;
grant execute on function public.create_game(text, text, int, jsonb, jsonb, int, text) to authenticated;
