-- The Preference Split Auction's default budget goes from 10 to 20 points per player
-- (owner decision, 2026-08-06), matching `PREFERENCE_SPLIT_BUDGET_PER_PLAYER` in
-- engine/src/algorithms/preference-split-auction.ts.
--
-- This is only the server-side FALLBACK: create_game always stores an explicit `auctionBudget` in
-- the game's options, so an in-progress game keeps whatever it was created with and nothing about
-- an existing auction changes. The fallback still has to track the engine's default, because if the
-- two sides ever disagreed about a game's budget every submission in it would be rejected.

create or replace function public.preference_split_budget(p_options jsonb, p_player_count int)
returns int
language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(nullif(p_options ->> 'auctionBudget', '')::int, 20 * p_player_count);
$$;
