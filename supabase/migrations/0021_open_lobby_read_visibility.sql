-- Defensive open-lobby visibility rule: open tables and their seat rows must be readable by any
-- signed-in user so the Lobby tab can always show them, even if an environment's older broad
-- read-visibility migration was missed. Membership-only visibility remains unchanged for
-- non-open games.

drop policy if exists games_select on public.games;
create policy games_select on public.games
  for select to authenticated
  using (status = 'open' or public.is_game_member(id));

drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select to authenticated
  using (
    exists (
      select 1
      from public.games g
      where g.id = game_id
        and (g.status = 'open' or public.is_game_member(g.id))
    )
  );
