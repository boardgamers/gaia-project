-- Per-device push presence: "is this PHONE looking at the game", not "is this PLAYER looking at it".
--
-- 0013_notify_presence_gate.sql added `players.last_active_at`, a heartbeat the viewer writes every
-- ~20s while its tab is open and visible, so the `notify` Edge Function could skip a push that
-- would only duplicate what the player is already staring at. The flaw is that `players` has ONE
-- row per seat, shared by every device that user is signed in on: leaving the game open in a
-- desktop tab kept that timestamp fresh forever, and notify/logic.ts's
-- `shouldSkipTurnPushForSubscription` then suppressed the push on their PHONE - a device that was
-- in a pocket, screen off, and had no idea a turn had come round. Owner-reported.
--
-- The fix is to record presence on the subscription (= the device) instead. `active_game_id` is the
-- game this device has open right now (null = none), `active_at` is when it last reported either
-- way, so the two together distinguish "this device says it is not looking" (report with a null
-- game) from "this device has never reported at all" (a client older than this migration), which
-- must keep falling back to the old per-player signal rather than suddenly alerting a phone that
-- really is the device in use.
--
-- Desktop subscriptions are unaffected: they are already never suppressed (see logic.ts).

alter table public.push_subscriptions
  add column if not exists active_game_id uuid references public.games (id) on delete set null,
  add column if not exists active_at timestamptz;

-- Called from the same heartbeat tick as `mark_seat_active` (viewer/src/hosted.ts), but once per
-- device rather than once per seat, and - unlike the seat heartbeat - also while the tab is hidden,
-- which is exactly the report that re-enables pushes here.
--
-- Deliberately NOT seat-scoped: a spectator's device is looking at the game just as much as a
-- player's, and the row is keyed by an endpoint this user must already own. A caller naming an
-- endpoint that isn't theirs simply updates nothing.
create or replace function public.mark_device_viewing(p_endpoint text, p_game_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_game_id is not null and not public.is_game_member(p_game_id) then
    raise exception 'not a member of this game';
  end if;

  update public.push_subscriptions
  set active_game_id = p_game_id,
      -- Always now(), even when clearing the game: a device that says "I am not looking at
      -- anything" has still reported, and must not be mistaken for one that never reports.
      active_at      = now()
  where endpoint = p_endpoint and user_id = v_uid;
end;
$$;

revoke execute on function public.mark_device_viewing(text, uuid) from public, anon;
grant execute on function public.mark_device_viewing(text, uuid) to authenticated;
