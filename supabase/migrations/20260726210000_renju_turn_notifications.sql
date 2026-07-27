-- Push a "your move" notification through the same `notify` Edge Function pipeline used for Gaia
-- turns (0001_multiplayer.sql's `games_notify_update`) and for the sidebar chess face
-- (20260726181703_chess_turn_notifications.sql), whenever the shared renju board's position
-- actually changes - a real stone or a confirmed reset - not a colour assignment or a panel-mode
-- switch, which update the row without touching `board`.
--
-- The renju counterpart of `fen` is the 225-character board string: the active colour is derived
-- from its stone counts (black opens), so any change to it means the turn has passed to the other
-- team. `ensure_renju_assignment`'s own UPDATE leaves `board` alone, so a reset fires exactly one
-- notification (to black's mover on the fresh board), the same as a chess reset does.
create or replace function public.notify_renju_turn()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg jsonb;
begin
  select value into v_cfg from public.app_config where key = 'notify';
  if v_cfg is null then
    return null;
  end if;
  perform net.http_post(
    url := v_cfg ->> 'url',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (v_cfg ->> 'key')
    ),
    body := jsonb_build_object('type', 'renju_turn', 'game_id', NEW.game_id)
  );
  return null;
end;
$$;

drop trigger if exists renju_board_notify_update on public.renju_board;
create trigger renju_board_notify_update
  after update on public.renju_board
  for each row
  when (old.board is distinct from new.board)
  execute function public.notify_renju_turn();
