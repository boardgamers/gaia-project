-- Hosted persistence drift repair:
-- 1. Backfill any claimable seat rows whose user_id was never attached even
--    though invited_email already matches a registered auth user.
-- 2. Realign games.move_count with the actual append-only moves table for all
--    existing games, so setup-time rotation rows can no longer leave a game
--    stuck expecting seq=1 while the client correctly submits seq=2.
-- 3. Repair schema drift from the hosted lobby-summary rollout: some live
--    projects never received games.latest_move_summary and still carry the
--    stale 8-arg commit_turn overload, which makes every modern hosted turn
--    fail server-side before any move row is written.
-- 4. Expose a small self-heal RPC the hosted client can call on load/resync
--    if it ever detects the same move-count mismatch again.

update public.players p
set user_id = u.id
from auth.users u
where p.user_id is null
  and p.invited_email !~ '@lobby\.invalid$'
  and lower(u.email::text) = p.invited_email;

with move_totals as (
  select g.id as game_id, coalesce(count(m.seq), 0)::int as move_count
  from public.games g
  left join public.moves m on m.game_id = g.id
  group by g.id
)
update public.games g
set move_count = mt.move_count
from move_totals mt
where g.id = mt.game_id
  and g.move_count is distinct from mt.move_count;

alter table public.games add column if not exists latest_move_summary text;

drop function if exists public.commit_turn(uuid, int, int, text, int, boolean, int, jsonb);
drop function if exists public.create_game(text, text, int, jsonb, jsonb, int, text);

create or replace function public.repair_game_move_count(p_game_id uuid)
returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid        uuid := auth.uid();
  v_move_count int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not public.is_game_member(p_game_id) then
    raise exception 'game not found';
  end if;

  select coalesce(count(*), 0)::int
  into v_move_count
  from public.moves
  where game_id = p_game_id;

  update public.games
  set move_count = v_move_count
  where id = p_game_id;

  return v_move_count;
end;
$$;

revoke execute on function public.repair_game_move_count(uuid) from public, anon;
grant execute on function public.repair_game_move_count(uuid) to authenticated;
