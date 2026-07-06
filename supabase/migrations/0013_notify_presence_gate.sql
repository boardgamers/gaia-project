-- Gaia 9 (docs/lost-fleet/PROGRESS.md): turn-notification pushes should only fire when it's a
-- player's turn AND they don't already have the game open AND no premove is queued to play the
-- move for them automatically. The premove half is a straight readback of the same existence
-- check `notify_resolve_automation` already does (0010_premoves.sql) - see notify/index.ts. The
-- "game already open" half needs a fresh signal: a lightweight per-seat heartbeat the client
-- writes while its tab is open and visible (viewer/src/hosted.ts), separate from Realtime
-- Presence (which lives in the Realtime server, not Postgres, and isn't queryable from the
-- `notify` edge function).

alter table public.players add column if not exists last_active_at timestamptz;

create or replace function public.mark_seat_active(p_game_id uuid, p_seat int)
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
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  update public.players set last_active_at = now()
  where game_id = p_game_id and seat = p_seat;
end;
$$;

revoke execute on function public.mark_seat_active(uuid, int) from public, anon;
grant execute on function public.mark_seat_active(uuid, int) to authenticated;
