-- Lost Fleet multiplayer backend — initial schema.
-- Design: docs/lost-fleet/BACKEND.md. The engine is client-side and authoritative;
-- this schema stores seed + options + an append-only committed-turn log and fans it out.
-- All writes go through the security-definer RPCs below — there are NO direct
-- insert/update/delete policies, which is what makes the move log append-only.

create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.games (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  created_by        uuid not null references auth.users (id),
  name              text not null default '',
  seed              text not null,
  player_count      int  not null check (player_count between 2 and 5),
  options           jsonb not null,
  status            text not null default 'active' check (status in ('active', 'finished')),
  current_seat      int,
  move_count        int not null default 0,
  last_committed_by uuid,
  -- Phase 2 fast-boot cache (BACKEND.md §8); stays null in v1:
  cached_state       jsonb,
  cached_state_moves int
);

create table public.players (
  game_id       uuid not null references public.games (id) on delete cascade,
  seat          int  not null check (seat >= 0),
  invited_email text not null,
  user_id       uuid references auth.users (id),
  display_name  text not null default '',
  primary key (game_id, seat),
  unique (game_id, invited_email)
);

create index players_user_idx on public.players (user_id);
create index players_email_idx on public.players (invited_email);

create table public.moves (
  game_id      uuid not null references public.games (id) on delete cascade,
  -- 1-based; equals the line's index in engine.moveHistory ("init" is index 0, never stored)
  seq          int  not null check (seq >= 1),
  seat         int  not null,
  move         text not null,
  committed_at timestamptz not null default now(),
  committed_by uuid not null references auth.users (id),
  primary key (game_id, seq)
);

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- Service-role-only configuration (VAPID keypair, notify function URL/key).
-- RLS on with zero policies: invisible to anon/authenticated, readable by service role.
create table public.app_config (
  key   text primary key,
  value jsonb not null
);

-- ---------------------------------------------------------------------------
-- Membership helper (security definer so the players<->games policies don't recurse)
-- ---------------------------------------------------------------------------

create or replace function public.is_game_member(p_game_id uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.players p
    where p.game_id = p_game_id
      and (p.user_id = auth.uid()
           or p.invited_email = lower(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

-- ---------------------------------------------------------------------------
-- Row-level security: members read; nobody writes directly
-- ---------------------------------------------------------------------------

alter table public.games              enable row level security;
alter table public.players            enable row level security;
alter table public.moves              enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.app_config         enable row level security;

create policy games_select on public.games
  for select to authenticated using (public.is_game_member(id));

create policy players_select on public.players
  for select to authenticated using (public.is_game_member(game_id));

create policy moves_select on public.moves
  for select to authenticated using (public.is_game_member(game_id));

create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- RPCs (the only write paths)
-- ---------------------------------------------------------------------------

-- invites: jsonb array of {email, seat, display_name}; seats must be exactly 0..player_count-1
-- and the caller's own email must be among them (the host always plays).
-- current_seat is engine.playerToMove computed client-side from the freshly-initted engine.
create or replace function public.create_game(
  p_name text,
  p_seed text,
  p_player_count int,
  p_options jsonb,
  p_invites jsonb,
  p_current_seat int
) returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_game  uuid;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_seed is null or length(trim(p_seed)) = 0 then
    raise exception 'seed required';
  end if;
  if p_player_count is null or p_player_count < 2 or p_player_count > 5 then
    raise exception 'player_count must be 2-5';
  end if;
  if jsonb_typeof(p_options) is distinct from 'object' then
    raise exception 'options must be a json object';
  end if;
  if jsonb_typeof(p_invites) is distinct from 'array'
     or jsonb_array_length(p_invites) <> p_player_count then
    raise exception 'invites must list exactly % players', p_player_count;
  end if;
  if (select count(distinct (i ->> 'seat')::int) from jsonb_array_elements(p_invites) i
        where (i ->> 'seat')::int between 0 and p_player_count - 1) <> p_player_count then
    raise exception 'invite seats must be exactly 0..%', p_player_count - 1;
  end if;
  if (select count(distinct lower(i ->> 'email')) from jsonb_array_elements(p_invites) i
        where coalesce(lower(i ->> 'email'), '') <> '') <> p_player_count then
    raise exception 'each seat needs a distinct non-empty email';
  end if;
  if not exists (select 1 from jsonb_array_elements(p_invites) i
                 where lower(i ->> 'email') = v_email) then
    raise exception 'the game creator must occupy one of the seats';
  end if;
  if p_current_seat is null or p_current_seat < 0 or p_current_seat >= p_player_count then
    raise exception 'current_seat must be a valid seat';
  end if;

  insert into public.games (created_by, name, seed, player_count, options, current_seat)
  values (v_uid, coalesce(p_name, ''), p_seed, p_player_count, p_options, p_current_seat)
  returning id into v_game;

  insert into public.players (game_id, seat, invited_email, display_name, user_id)
  select v_game,
         (i ->> 'seat')::int,
         lower(i ->> 'email'),
         coalesce(i ->> 'display_name', ''),
         u.id
  from jsonb_array_elements(p_invites) i
  left join auth.users u on lower(u.email) = lower(i ->> 'email');

  return v_game;
end;
$$;

-- Called after every sign-in: matches the signed-in email to any unclaimed seats.
create or replace function public.claim_my_seats()
returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_count int;
begin
  if v_uid is null or v_email = '' then
    return 0;
  end if;
  update public.players
  set user_id = v_uid
  where user_id is null and invited_email = v_email;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- The only way a move row is born. Atomic append + turn-pointer update.
-- A stale client fails the seq check ('seq_conflict') and must resync.
create or replace function public.commit_turn(
  p_game_id uuid,
  p_seq int,
  p_seat int,
  p_move text,
  p_next_seat int,
  p_finished boolean
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_game public.games%rowtype;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_move is null or length(trim(p_move)) = 0 then
    raise exception 'empty move';
  end if;

  select * into v_game from public.games where id = p_game_id for update;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;
  if p_seq is distinct from v_game.move_count + 1 then
    raise exception 'seq_conflict: expected %, got %', v_game.move_count + 1, p_seq;
  end if;
  if not p_finished and (p_next_seat is null or p_next_seat < 0
                         or p_next_seat >= v_game.player_count) then
    raise exception 'next_seat must be a valid seat while the game is active';
  end if;

  insert into public.moves (game_id, seq, seat, move, committed_by)
  values (p_game_id, p_seq, p_seat, p_move, v_uid);

  update public.games
  set move_count        = p_seq,
      current_seat      = case when p_finished then null else p_next_seat end,
      status            = case when p_finished then 'finished' else status end,
      last_committed_by = v_uid
  where id = p_game_id;
end;
$$;

revoke execute on function public.create_game(text, text, int, jsonb, jsonb, int) from public, anon;
revoke execute on function public.claim_my_seats() from public, anon;
revoke execute on function public.commit_turn(uuid, int, int, text, int, boolean) from public, anon;
grant execute on function public.create_game(text, text, int, jsonb, jsonb, int) to authenticated;
grant execute on function public.claim_my_seats() to authenticated;
grant execute on function public.commit_turn(uuid, int, int, text, int, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: committed moves fan out to seated players (RLS applies)
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.moves;

-- ---------------------------------------------------------------------------
-- Notifications: trigger -> pg_net -> `notify` Edge Function (BACKEND.md §6).
-- URL + key come from app_config ('notify': {"url": ..., "key": ...}), seeded
-- out-of-band so the migration stays free of project-specific values.
-- If unseeded, the trigger is a silent no-op.
-- ---------------------------------------------------------------------------

create or replace function public.notify_game_event()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_cfg jsonb;
begin
  select value into v_cfg from public.app_config where key = 'notify';
  if v_cfg is null then
    return null;
  end if;
  perform net.http_post(
    url := v_cfg ->> 'url',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (v_cfg ->> 'key')
    ),
    body := jsonb_build_object('type', lower(TG_OP), 'game_id', NEW.id)
  );
  return null;
end;
$$;

create trigger games_notify_insert
  after insert on public.games
  for each row execute function public.notify_game_event();

create trigger games_notify_update
  after update on public.games
  for each row
  when (old.current_seat is distinct from new.current_seat
        or old.status is distinct from new.status)
  execute function public.notify_game_event();
