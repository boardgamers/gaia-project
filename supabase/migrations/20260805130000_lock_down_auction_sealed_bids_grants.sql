-- Follow-up to 20260805120000_preference_split_sealed_bids.sql.
--
-- That migration granted `select` to `authenticated` but did not first REVOKE, so Supabase's
-- default privileges (which grant ALL on new public tables to anon/authenticated/service_role)
-- were left in place underneath it: `has_table_privilege('authenticated', 'auction_sealed_bids',
-- 'insert')` came back true after applying it live.
--
-- Nothing was ever exposed by that: RLS is enabled on the table and its only policy is a SELECT
-- policy, so an insert/update/delete from a client is refused regardless of the table grant. But
-- every comparable table in this project (chess_board, renju_board, game_chat_reads, ...) revokes
-- first and then grants back exactly `select`, precisely so the grant and the policy are two
-- independent barriers rather than one - and 20260805120000's own comment claims that is what it
-- does. This makes it true.
--
-- Applied on top of the original rather than by editing it, because the original is already in the
-- live migration ledger.

revoke all on table public.auction_sealed_bids from public, anon, authenticated;
grant select on table public.auction_sealed_bids to authenticated;
grant all on table public.auction_sealed_bids to service_role;
