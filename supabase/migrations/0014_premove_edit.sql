-- Premove UI redesign (docs/lost-fleet/PROGRESS.md Gaia 9): editing a queued premove needs a true
-- update-in-place, not a client-side cancel+re-queue - `queue_premove` always appends at
-- `seq = max(seq)+1`, which would silently reorder a Priority edit to the back of the list (ranks
-- aren't necessarily contiguous once a middle rank has been cancelled) and, for Sequential, would
-- only accidentally land back in the right slot if the resolver's own cascade-delete already
-- cleared everything downstream first. This also gives "stage until confirmed" for free: nothing
-- touches the row until this RPC is actually called (i.e. the user hits confirm on the edit), so
-- backing out of an edit mid-compose leaves the original completely untouched.

create or replace function public.edit_premove(p_game_id uuid, p_seat int, p_seq int, p_move text)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_mode text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  select mode into v_mode from public.premoves where game_id = p_game_id and seat = p_seat and seq = p_seq;
  if v_mode is null then
    raise exception 'no premove queued at that position';
  end if;

  update public.premoves set move = p_move
  where game_id = p_game_id and seat = p_seat and seq = p_seq;

  -- Sequential only (§10.5/§10.6): entries after this one were previewed assuming the pre-edit
  -- move landed here, so they're no longer valid plans and are discarded along with it. Priority
  -- ranks are independent alternatives for the same single turn - editing one never touches the
  -- others.
  if v_mode = 'sequential' then
    delete from public.premoves
    where game_id = p_game_id and seat = p_seat and seq > p_seq;
  end if;
end;
$$;

revoke execute on function public.edit_premove(uuid, int, int, text) from public, anon;
grant execute on function public.edit_premove(uuid, int, int, text) to authenticated;
