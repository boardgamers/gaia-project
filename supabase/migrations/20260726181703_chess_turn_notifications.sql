-- Push a "your move" notification through the same `notify` Edge Function pipeline used for Gaia
-- turns (0001_multiplayer.sql's `games_notify_update`), whenever the shared chess board's active
-- color actually changes - a real move or a confirmed reset - not a colour claim or panel-mode
-- switch, which update the row without touching `fen`.
create or replace function public.notify_chess_turn()
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
    body := jsonb_build_object('type', 'chess_turn', 'game_id', NEW.game_id)
  );
  return null;
end;
$$;

create trigger chess_board_notify_update
  after update on public.chess_board
  for each row
  when (old.fen is distinct from new.fen)
  execute function public.notify_chess_turn();
