-- Let every signed-in user see the full hosted lobby and open any hosted game.
-- This changes only read visibility through the shared helper used by the games/players/moves
-- select policies. Direct writes remain locked to the existing RPC paths and checks.

create or replace function public.is_game_member(p_game_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null;
$$;
