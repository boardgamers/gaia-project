-- Follow-up to 20260805120000_preference_split_sealed_bids.sql.
--
-- `preference_split_budget` was the one function in that migration without a pinned search_path
-- (Supabase's `function_search_path_mutable` advisor flags it). It was omitted deliberately - the
-- function is SECURITY INVOKER and does nothing but arithmetic on its own arguments, so there is no
-- privilege boundary to cross - but every other function in that migration pins it, and an advisor
-- warning nobody can explain at a glance is worse than a one-line fix.

create or replace function public.preference_split_budget(p_options jsonb, p_player_count int)
returns int
language sql immutable
set search_path = pg_catalog, pg_temp
as $$
  select coalesce(nullif(p_options ->> 'auctionBudget', '')::int, 10 * p_player_count);
$$;
