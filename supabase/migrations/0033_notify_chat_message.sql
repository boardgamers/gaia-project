-- Owner request (Gaia 21 follow-up): push notifications for new game chat messages, the same
-- pg_net -> `notify` edge function pattern as games_notify_insert/update (0001_multiplayer.sql).
-- Fires on every game_chat_messages insert; the edge function fetches the game/players itself, so
-- only the chat-specific bits (sender, author name, a truncated preview) need to travel in the
-- payload here.

create or replace function public.notify_chat_message()
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
    body := jsonb_build_object(
      'type', 'chat',
      'game_id', new.game_id,
      'sender_id', new.user_id,
      'author_name', new.author_name,
      'body', left(new.body, 200)
    )
  );
  return null;
end;
$$;

revoke execute on function public.notify_chat_message() from public, anon, authenticated;

create trigger game_chat_messages_notify_insert
  after insert on public.game_chat_messages
  for each row execute function public.notify_chat_message();
