-- Let the single app admin see every hosted game in the lobby and open any game, even without a
-- seat in it. This widens only the existing read-membership helper used by the games/players/moves
-- RLS policies; write paths stay unchanged and still go through their own RPC checks.

create or replace function public.is_game_member(p_game_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'kim.pham.nguyen2@gmail.com'
    or exists (
      select 1 from public.players p
      where p.game_id = p_game_id
        and (p.user_id = auth.uid()
             or p.invited_email = lower(coalesce(auth.jwt() ->> 'email', '')))
    );
$$;
