-- Owner request (Gaia 21): auto-delete idle test games after a week, same opportunistic-pruning
-- pattern as prune_abandoned_games (0028) - no pg_cron dependency, nudged along by any lobby visit.
-- "Test game" here uses the same conservative bar as delete_my_test_game (0030): every claimed seat
-- belongs to a single user, i.e. true solo hot-seat play - a real multiplayer game (more than one
-- distinct user_id among its claimed seats) is never touched here regardless of how idle it is.
-- Games already abandoned are left to prune_abandoned_games instead of double-handling them here.

create or replace function public.prune_idle_test_games()
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.games g
  where g.abandoned_at is null
    and coalesce(g.latest_move_committed_at, g.created_at) < now() - interval '7 days'
    and exists (
      select 1 from public.players p where p.game_id = g.id and p.user_id is not null
    )
    and not exists (
      select 1
      from public.players p1
      join public.players p2 on p1.game_id = p2.game_id and p1.user_id <> p2.user_id
      where p1.game_id = g.id and p1.user_id is not null and p2.user_id is not null
    );
end;
$$;

revoke execute on function public.prune_idle_test_games() from public, anon;
grant execute on function public.prune_idle_test_games() to authenticated;
