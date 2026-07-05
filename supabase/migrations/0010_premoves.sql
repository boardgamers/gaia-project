-- Premove, Phase 1 MVP (docs/lost-fleet/PREMOVE_PLAN.md). Queue a move while it's not your turn;
-- it plays automatically server-side (the resolve-automation Edge Function) once your turn
-- genuinely arrives, even if you're offline. Phase 1 only handles Phase.RoundMove - a pending
-- leech/charge decision (Phase.RoundLeech) blocks automation until Phase 2 adds auto-charge
-- support; a queued premove is never lost when that happens, it just waits behind the leech.
--
-- One queued premove line per (seat, seq). seq = that seat's own queue order (1 = next to
-- attempt). Phase 1's client only ever surfaces one at a time per seat (no queue depth yet - that's
-- Phase 3), but the schema is queue-shaped from day one so Phase 3 doesn't need a migration.
create table public.premoves (
  game_id           uuid not null references public.games(id) on delete cascade,
  seat              int  not null,
  seq               int  not null,
  move              text not null,          -- exact complete turn line, e.g. "terrans build m -1x2"
  queued_move_count int  not null,          -- games.move_count when queued (staleness display)
  created_at        timestamptz not null default now(),
  primary key (game_id, seat, seq)
);
alter table public.premoves enable row level security;

-- Deliberately NARROWER than moves_select (0001): a queued premove is private strategic intent,
-- not public game history. Only the owning seat's own user sees their own queue.
create policy premoves_select on public.premoves
  for select to authenticated
  using (exists (select 1 from public.players
                 where game_id = premoves.game_id and seat = premoves.seat and user_id = auth.uid()));

-- Durable failure inbox (NOT a one-shot broadcast - a broadcast only reaches a client connected at
-- the instant it fires, i.e. the one moment the premove-setter is least likely to be watching).
create table public.premove_failures (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.games(id) on delete cascade,
  seat       int  not null,
  move       text not null,
  reason     text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
alter table public.premove_failures enable row level security;

create policy premove_failures_select on public.premove_failures
  for select to authenticated
  using (exists (select 1 from public.players
                 where game_id = premove_failures.game_id and seat = premove_failures.seat
                   and user_id = auth.uid()));

-- Neither table is added to the supabase_realtime publication (DELETE events + RLS on old rows are
-- awkward). The client already has a natural refresh point: refetch the caller's own premoves +
-- unread premove_failures whenever a moves row arrives, and on load.

-- ---------------------------------------------------------------------------
-- RPCs (mirror the existing "no direct writes, security-definer only" pattern, 0001 §1)
-- ---------------------------------------------------------------------------

create or replace function public.queue_premove(p_game_id uuid, p_seat int, p_move text)
returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := auth.uid();
  v_game public.games%rowtype;
  v_seq  int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_move is null or length(trim(p_move)) = 0 then
    raise exception 'empty move';
  end if;
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  select * into v_game from public.games where id = p_game_id;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq
  from public.premoves where game_id = p_game_id and seat = p_seat;

  insert into public.premoves (game_id, seat, seq, move, queued_move_count)
  values (p_game_id, p_seat, v_seq, p_move, v_game.move_count);

  return v_seq;
end;
$$;

revoke execute on function public.queue_premove(uuid, int, text) from public, anon;
grant execute on function public.queue_premove(uuid, int, text) to authenticated;

create or replace function public.cancel_premove(p_game_id uuid, p_seat int, p_seq int)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not exists (select 1 from public.players
                 where game_id = p_game_id and seat = p_seat and user_id = v_uid) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  delete from public.premoves where game_id = p_game_id and seat = p_seat and seq = p_seq;
end;
$$;

revoke execute on function public.cancel_premove(uuid, int, int) from public, anon;
grant execute on function public.cancel_premove(uuid, int, int) to authenticated;

create or replace function public.mark_premove_failure_read(p_id uuid)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;

  update public.premove_failures pf
  set read_at = now()
  where pf.id = p_id
    and exists (select 1 from public.players
                where game_id = pf.game_id and seat = pf.seat and user_id = v_uid);
end;
$$;

revoke execute on function public.mark_premove_failure_read(uuid) from public, anon;
grant execute on function public.mark_premove_failure_read(uuid) to authenticated;

-- The offline commit path - service-role only, since there is no authenticated user inside the edge
-- function. Identical shape to commit_turn (0009's 8-arg version) minus the seat-ownership check
-- (nothing to check against), plus committed_by/last_committed_by resolved from the seat owner's
-- own user_id so notify's "skip the last committer" logic stays correct: the *next* seat gets the
-- turn-change push, not the automated seat's own owner.
create or replace function public.commit_automated_turn(
  p_game_id uuid,
  p_seq int,
  p_seat int,
  p_move text,
  p_next_seat int,
  p_finished boolean,
  p_current_round int default null,
  p_player_updates jsonb default null -- array of {"seat": int, "faction": text, "score": int}
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_game      public.games%rowtype;
  v_committer uuid;
begin
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
  if p_seq is distinct from v_game.move_count + 1 then
    raise exception 'seq_conflict: expected %, got %', v_game.move_count + 1, p_seq;
  end if;
  if not p_finished and (p_next_seat is null or p_next_seat < 0 or p_next_seat >= v_game.player_count) then
    raise exception 'next_seat must be a valid seat while the game is active';
  end if;

  select user_id into v_committer from public.players where game_id = p_game_id and seat = p_seat;
  if v_committer is null then
    v_committer := v_game.created_by;
  end if;

  insert into public.moves (game_id, seq, seat, move, committed_by)
  values (p_game_id, p_seq, p_seat, p_move, v_committer);

  update public.games
  set move_count        = p_seq,
      current_seat      = case when p_finished then null else p_next_seat end,
      status            = case when p_finished then 'finished' else status end,
      last_committed_by = v_committer,
      current_round     = coalesce(p_current_round, current_round)
  where id = p_game_id;

  if p_player_updates is not null then
    update public.players pl
    set faction = coalesce(u.faction, pl.faction),
        score   = coalesce(u.score, pl.score)
    from jsonb_to_recordset(p_player_updates) as u(seat int, faction text, score int)
    where pl.game_id = p_game_id and pl.seat = u.seat;
  end if;
end;
$$;

revoke execute on function public.commit_automated_turn(uuid, int, int, text, int, boolean, int, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_automated_turn(uuid, int, int, text, int, boolean, int, jsonb)
  to service_role;

-- ---------------------------------------------------------------------------
-- Trigger: fire resolve-automation only when there's actually work for the seat now on turn
-- (cheap gate - Phase 2 widens this to "premove exists OR that seat's auto_charge <> 'ask'").
-- ---------------------------------------------------------------------------

create or replace function public.notify_resolve_automation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_cfg jsonb;
begin
  if new.current_seat is null then
    return null;
  end if;
  if not exists (select 1 from public.premoves
                 where game_id = new.id and seat = new.current_seat) then
    return null;
  end if;
  select value into v_cfg from public.app_config where key = 'resolve_automation';
  if v_cfg is null then
    return null;   -- unseeded = silent no-op, same as notify_game_event
  end if;
  perform net.http_post(
    url := v_cfg ->> 'url',
    headers := jsonb_build_object('Content-Type', 'application/json',
                                   'Authorization', 'Bearer ' || (v_cfg ->> 'key')),
    body := jsonb_build_object('game_id', new.id, 'seat', new.current_seat)
  );
  return null;
end;
$$;

create trigger games_resolve_automation
  after update on public.games
  for each row when (old.current_seat is distinct from new.current_seat)
  execute function public.notify_resolve_automation();
