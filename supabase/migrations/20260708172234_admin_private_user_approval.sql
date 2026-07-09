-- Private access control: every new signed-in user starts "pending" and sees no game data
-- until the admin approves them. Sign-in (Google OAuth / magic link) itself is left alone -
-- Supabase auto-creates an auth.users row on first login either way - but that row is now
-- worthless on its own: every read policy and every write path that touches shared game data
-- is gated on approval, enforced in Postgres so it can't be bypassed by calling Supabase
-- directly with a valid session token.
--
-- Design:
--   - public.user_approvals: one row per auth user, 'pending' by default, flipped to
--     'approved' by the admin (a checkbox click - see AdminUsers.vue). Populated automatically
--     by a trigger on auth.users so there's nothing extra to wire into the sign-in flow.
--   - public.is_admin() / public.is_approved(): security-definer helpers. is_approved()
--     returns true when auth.uid() is null (service-role/backend context - e.g.
--     commit_automated_turn's premove auto-resolution has no user JWT at all) so this never
--     blocks the trusted server-side automation path; real anonymous client calls are already
--     rejected earlier by each RPC's own "not signed in" check.
--   - Existing users are backfilled as already-approved so nobody who already had access today
--     gets locked out by this migration.
--   - Read policies (games/players/moves/premoves/premove_failures) now require is_approved()
--     in addition to their existing visibility rules.
--   - A single BEFORE INSERT OR UPDATE trigger (public.require_approved) on games/players/moves/
--     premoves/premove_failures blocks every write path uniformly, so this doesn't need to be
--     threaded through every existing and future RPC body individually.

create table public.user_approvals (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  email        text not null default '',
  display_name text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'approved')),
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  approved_by  uuid references auth.users (id)
);

create index user_approvals_status_idx on public.user_approvals (status);

alter table public.user_approvals enable row level security;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'kim.pham.nguyen2@gmail.com';
$$;

create or replace function public.is_approved()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is null
      or public.is_admin()
      or exists (
        select 1 from public.user_approvals
        where user_id = auth.uid() and status = 'approved'
      );
$$;

create policy user_approvals_select on public.user_approvals
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- Auto-create a pending row for every new signup; auto-approve the admin's own account.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user_approval()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
  v_is_admin boolean := v_email = 'kim.pham.nguyen2@gmail.com';
begin
  insert into public.user_approvals (user_id, email, display_name, status, approved_at)
  values (
    new.id,
    v_email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    case when v_is_admin then 'approved' else 'pending' end,
    case when v_is_admin then now() else null end
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created_approval
  after insert on auth.users
  for each row execute function public.handle_new_user_approval();

-- Backfill: everyone who could already sign in before this migration keeps their access.
insert into public.user_approvals (user_id, email, display_name, status, approved_at)
select
  u.id,
  lower(coalesce(u.email, '')),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', ''),
  'approved',
  now()
from auth.users u
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Admin approve/revoke RPC (the "checkmark" action in AdminUsers.vue)
-- ---------------------------------------------------------------------------

create or replace function public.set_user_approval(p_user_id uuid, p_approved boolean)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.user_approvals
  set status      = case when p_approved then 'approved' else 'pending' end,
      approved_at = case when p_approved then now() else null end,
      approved_by = case when p_approved then auth.uid() else null end
  where user_id = p_user_id;
end;
$$;

revoke execute on function public.set_user_approval(uuid, boolean) from public, anon;
grant execute on function public.set_user_approval(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Gate reads: approval required in addition to the existing visibility rules.
-- ---------------------------------------------------------------------------

drop policy if exists games_select on public.games;
create policy games_select on public.games
  for select to authenticated using (public.is_approved());

drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select to authenticated using (public.is_approved());

drop policy if exists moves_select on public.moves;
create policy moves_select on public.moves
  for select to authenticated using (public.is_approved());

drop policy if exists premoves_select on public.premoves;
create policy premoves_select on public.premoves
  for select to authenticated
  using (
    public.is_approved()
    and exists (select 1 from public.players
                where game_id = premoves.game_id and seat = premoves.seat and user_id = auth.uid())
  );

drop policy if exists premove_failures_select on public.premove_failures;
create policy premove_failures_select on public.premove_failures
  for select to authenticated
  using (
    public.is_approved()
    and exists (select 1 from public.players
                where game_id = premove_failures.game_id and seat = premove_failures.seat
                  and user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Gate writes: one trigger, attached everywhere shared game data is written, instead of
-- threading an approval check through every existing/future RPC body.
-- ---------------------------------------------------------------------------

create or replace function public.require_approved()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_approved() then
    raise exception 'account pending approval';
  end if;
  return new;
end;
$$;

create trigger games_require_approved
  before insert or update on public.games
  for each row execute function public.require_approved();

create trigger players_require_approved
  before insert or update on public.players
  for each row execute function public.require_approved();

create trigger moves_require_approved
  before insert on public.moves
  for each row execute function public.require_approved();

create trigger premoves_require_approved
  before insert or update on public.premoves
  for each row execute function public.require_approved();

create trigger premove_failures_require_approved
  before insert or update on public.premove_failures
  for each row execute function public.require_approved();
