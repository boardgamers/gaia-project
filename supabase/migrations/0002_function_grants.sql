-- Tighten function execute grants flagged by the Supabase security advisor.
-- is_game_member must remain executable by `authenticated`: it is referenced in
-- RLS policies, which evaluate functions with the calling user's privileges.
-- The trigger function needs no caller grants at all (triggers don't check the
-- invoking user's EXECUTE privilege).

revoke execute on function public.is_game_member(uuid) from public, anon;
grant execute on function public.is_game_member(uuid) to authenticated;

revoke execute on function public.notify_game_event() from public, anon, authenticated;
