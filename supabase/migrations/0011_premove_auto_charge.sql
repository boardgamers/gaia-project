-- Premove Phase 2 (docs/lost-fleet/PREMOVE_PLAN.md): offline auto-leech. Without this, a pending
-- power-leech/charge decision (Phase.RoundLeech) interrupts before a player's queued premove is
-- ever reached, and if they're fully offline the game stalls there. Persists the client's existing
-- auto-charge preference (viewer/src/logic/auto-decide.ts's AutoCharge type) per seat so
-- resolve-automation can honor it while nobody's watching. 'ask' (default) = never auto-decide,
-- identical to today's online-only behavior.

alter table public.players add column if not exists auto_charge text not null default 'ask';

create or replace function public.set_auto_charge(p_game_id uuid, p_seat int, p_pref text)
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

  update public.players set auto_charge = coalesce(p_pref, 'ask')
  where game_id = p_game_id and seat = p_seat;
end;
$$;

revoke execute on function public.set_auto_charge(uuid, int, text) from public, anon;
grant execute on function public.set_auto_charge(uuid, int, text) to authenticated;

-- Widen the trigger gate (0010's version only checked for a queued premove): now also fires when
-- the seat now on turn has auto-leech enabled, so a pending Phase.RoundLeech decision gets a
-- chance to auto-resolve even when nothing is queued in `premoves` at all.
create or replace function public.notify_resolve_automation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cfg jsonb;
begin
  if new.current_seat is null then
    return null;
  end if;
  if not exists (select 1 from public.premoves where game_id = new.id and seat = new.current_seat)
     and not exists (select 1 from public.players
                     where game_id = new.id and seat = new.current_seat and auto_charge <> 'ask') then
    return null;
  end if;
  select value into v_cfg from public.app_config where key = 'resolve_automation';
  if v_cfg is null then
    return null;   -- unseeded = silent no-op, same as notify_game_event
  end if;
  perform net.http_post(
    url := v_cfg ->> 'url',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                   'Authorization', 'Bearer ' || (v_cfg ->> 'key')),
    body := jsonb_build_object('game_id', new.id, 'seat', new.current_seat)
  );
  return null;
end;
$$;
