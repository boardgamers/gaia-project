-- Owner request (Gaia 21): let a player immediately hard-delete their own test game (the existing
-- "Abandon game" flow - 0028_abandon_game.sql - is a 7-day delayed soft-delete meant for real
-- multiplayer games other players are relying on; a solo hot-seat test game has no such audience
-- and deserves an immediate delete instead). Deliberately conservative: only the game's creator can
-- call this, and only while every claimed seat still belongs to them - the moment any other real
-- user has joined a seat, this is a real game and must go through abandon_game/admin delete_game
-- instead, never an instant hard-delete.

create or replace function public.delete_my_test_game(p_game_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_game public.games%rowtype;
  v_other_seats int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.created_by <> v_uid then
    raise exception 'only the game''s creator can delete it';
  end if;

  select count(*) into v_other_seats
  from public.players
  where game_id = p_game_id and user_id is not null and user_id <> v_uid;

  if v_other_seats > 0 then
    raise exception 'this game has other players in it - abandon it instead of deleting';
  end if;

  delete from public.games where id = p_game_id;
end;
$$;

revoke execute on function public.delete_my_test_game(uuid) from public, anon;
grant execute on function public.delete_my_test_game(uuid) to authenticated;
