-- Lets the app admin (only) delete a game from the lobby - not any game
-- creator, just the one owner account. There are no direct delete policies
-- on any table (see 0001's comment on the append-only move log), so this
-- goes through a new security-definer RPC like every other write path.
-- players/moves rows cascade-delete via their existing FKs.
create or replace function public.delete_game(p_game_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_admin_email constant text := 'kim.pham.nguyen2@gmail.com';
begin
  if lower(coalesce(auth.jwt() ->> 'email', '')) <> v_admin_email then
    raise exception 'only the admin can delete games';
  end if;
  if not exists (select 1 from public.games where id = p_game_id) then
    raise exception 'game not found';
  end if;

  delete from public.games where id = p_game_id;
end;
$$;

revoke execute on function public.delete_game(uuid) from public, anon;
grant execute on function public.delete_game(uuid) to authenticated;
