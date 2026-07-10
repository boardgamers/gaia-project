-- Direct-invite game creation (Gaia 18) needs a way for any approved, signed-in player to see
-- who else could be invited to a seat - by nickname, not raw user id/email. `public.profiles`
-- is locked down to select-own-row-only (0024), and the only existing "list every user" path is
-- the admin-only `admin-users` edge function (service-role key, gated to the single admin email).
-- This adds a narrow, security-definer RPC that returns just {user_id, nickname} for every
-- approved user, callable by any approved authenticated user - nothing else about other accounts
-- (email, games, etc.) is exposed.

create or replace function public.list_invitable_players()
returns table (user_id uuid, nickname text)
language sql stable security definer
set search_path = public, pg_temp
as $$
  select p.user_id, p.nickname
  from public.profiles p
  join public.user_approvals a on a.user_id = p.user_id and a.status = 'approved'
  where auth.uid() is not null
  order by p.nickname;
$$;

revoke execute on function public.list_invitable_players() from public, anon;
grant execute on function public.list_invitable_players() to authenticated;
