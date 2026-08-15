-- Premove cancel triggers (docs/lost-fleet/PROGRESS.md's premove design, extended 2026-08-15).
-- While it's not your turn you can queue premoves (existing feature). A cancel trigger watches for
-- something happening and, if it happens, clears your ENTIRE premove queue instead of letting it
-- fire - it never plays a move, it only cancels. Two kinds share one table and one resolution path
-- (viewer/src/logic/premove-cancel-trigger.ts):
--   - 'move'  - watches one named opponent seat for a move matching any of the stored atoms.
--   - 'leech' - a condition on the owner's own seat (a power charge offered to/taken by them);
--               watched_seat is the OWNER's own seat for this kind, atoms is always empty, and
--               `config` carries {mode: 'gained'|'offered', minPower: number} instead.
--
-- A trigger reveals your read of an opponent, so it must be exactly as private as a premove -
-- SELECT is scoped to the owning seat's own user via the same public.is_seat_owner() every other
-- premove RPC/policy uses. Like premoves/premove_failures, this table is never added to the
-- supabase_realtime publication (DELETE events + RLS on old rows are awkward) - the client already
-- refetches on load and on every incoming moves row.
--
-- Storing `atoms` (and, for leech, `config`) at arm time pins the semantics: a later change to the
-- matcher's normalizer can't silently reinterpret an already-armed trigger.

create table public.premove_cancel_triggers (
  game_id                uuid not null references public.games(id) on delete cascade,
  seat                   int  not null, -- owner (whose premoves get cancelled on a match)
  seq                    int  not null, -- per-seat ordinal
  kind                   text not null default 'move' check (kind in ('move', 'leech')),
  watched_seat           int  not null, -- kind='leech' stores the owner's OWN seat
  move                   text not null default '', -- composed line, display only; '' for 'leech'
  atoms                  text[] not null default '{}',
  config                 jsonb not null default '{}'::jsonb, -- kind='leech' only, see the .ts module
  match                  text not null default 'any' check (match in ('any', 'all')),
  armed_from_move_count  int  not null,
  created_at             timestamptz not null default now(),
  primary key (game_id, seat, seq)
);
alter table public.premove_cancel_triggers enable row level security;

create policy premove_cancel_triggers_select on public.premove_cancel_triggers
  for select to authenticated
  using (public.is_seat_owner(game_id, seat));

-- So a fired cancel's notice reads "cancelled" rather than "your premove couldn't be played".
alter table public.premove_failures
  add column if not exists kind text not null default 'failure'
    check (kind in ('failure', 'cancelled'));

-- ---------------------------------------------------------------------------
-- RPCs (mirror the existing "no direct writes, security-definer only" pattern)
-- ---------------------------------------------------------------------------

create or replace function public.arm_cancel_trigger(
  p_game_id uuid,
  p_seat int,
  p_watched_seat int,
  p_move text,
  p_atoms text[],
  p_kind text default 'move',
  p_config jsonb default '{}'::jsonb
) returns int
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := auth.uid();
  v_game  public.games%rowtype;
  v_seq   int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if p_kind not in ('move', 'leech') then
    raise exception 'invalid kind %', p_kind;
  end if;
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  select * into v_game from public.games where id = p_game_id;
  if not found then
    raise exception 'game not found';
  end if;
  if v_game.status <> 'active' then
    raise exception 'game is not active';
  end if;

  if p_kind = 'move' then
    if p_watched_seat = p_seat then
      raise exception 'a move trigger must watch an opponent seat, not your own';
    end if;
    if p_atoms is null or array_length(p_atoms, 1) is null or array_length(p_atoms, 1) < 1 then
      raise exception 'a move trigger needs at least one watched atom';
    end if;
  else
    if p_watched_seat <> p_seat then
      raise exception 'a leech trigger must watch your own seat';
    end if;
    if p_atoms is not null and coalesce(array_length(p_atoms, 1), 0) > 0 then
      raise exception 'a leech trigger does not take atoms';
    end if;
  end if;

  select coalesce(max(seq), 0) + 1 into v_seq
  from public.premove_cancel_triggers where game_id = p_game_id and seat = p_seat;

  insert into public.premove_cancel_triggers
    (game_id, seat, seq, kind, watched_seat, move, atoms, config, armed_from_move_count)
  values
    (p_game_id, p_seat, v_seq, p_kind, p_watched_seat, coalesce(p_move, ''), coalesce(p_atoms, '{}'),
     coalesce(p_config, '{}'::jsonb), v_game.move_count);

  return v_seq;
end;
$$;

revoke execute on function public.arm_cancel_trigger(uuid, int, int, text, text[], text, jsonb) from public, anon;
grant execute on function public.arm_cancel_trigger(uuid, int, int, text, text[], text, jsonb) to authenticated;

create or replace function public.disarm_cancel_trigger(p_game_id uuid, p_seat int, p_seq int)
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
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  delete from public.premove_cancel_triggers where game_id = p_game_id and seat = p_seat and seq = p_seq;
end;
$$;

revoke execute on function public.disarm_cancel_trigger(uuid, int, int) from public, anon;
grant execute on function public.disarm_cancel_trigger(uuid, int, int) to authenticated;

create or replace function public.disarm_all_cancel_triggers(p_game_id uuid, p_seat int)
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
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  delete from public.premove_cancel_triggers where game_id = p_game_id and seat = p_seat;
end;
$$;

revoke execute on function public.disarm_all_cancel_triggers(uuid, int) from public, anon;
grant execute on function public.disarm_all_cancel_triggers(uuid, int) to authenticated;

create or replace function public.edit_cancel_trigger(
  p_game_id uuid, p_seat int, p_seq int, p_move text, p_atoms text[], p_config jsonb
) returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid           uuid := auth.uid();
  v_game          public.games%rowtype;
  v_kind          text;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  select kind into v_kind
  from public.premove_cancel_triggers where game_id = p_game_id and seat = p_seat and seq = p_seq;
  if v_kind is null then
    raise exception 'no such armed trigger';
  end if;
  if v_kind = 'move' and (p_atoms is null or array_length(p_atoms, 1) is null or array_length(p_atoms, 1) < 1) then
    raise exception 'a move trigger needs at least one watched atom';
  end if;

  select * into v_game from public.games where id = p_game_id;

  -- Re-stamps armed_from_move_count (§ "an edited trigger is a new intent") - the same reasoning
  -- edit_premove applies to a premove's queued_move_count.
  update public.premove_cancel_triggers
  set move                  = coalesce(p_move, ''),
      atoms                 = coalesce(p_atoms, '{}'),
      config                = coalesce(p_config, '{}'::jsonb),
      armed_from_move_count = v_game.move_count
  where game_id = p_game_id and seat = p_seat and seq = p_seq;
end;
$$;

revoke execute on function public.edit_cancel_trigger(uuid, int, int, text, text[], jsonb) from public, anon;
grant execute on function public.edit_cancel_trigger(uuid, int, int, text, text[], jsonb) to authenticated;

-- resolve_cancel_trigger_match: the client fast-path's atomic "a match just fired" step. Not part
-- of the original RPC list, added to close a real race: both the client fast-path (this RPC) and
-- the offline resolve-automation edge function (its own direct service-role writes) can observe the
-- same match at roughly the same instant, and unlike a committed move there is no `seq` to
-- arbitrate the winner with. The DELETE below IS the arbiter: whichever caller's delete actually
-- removes the trigger rows (v_deleted > 0) is the one whose match "really happened" and goes on to
-- clear the queue and write the notice; the loser sees 0 rows deleted (the other caller already got
-- there) and returns false, doing nothing further - so the notice/push fires exactly once.
create or replace function public.resolve_cancel_trigger_match(p_game_id uuid, p_seat int, p_reason text)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_uid     uuid := auth.uid();
  v_deleted int;
begin
  if v_uid is null then
    raise exception 'not signed in';
  end if;
  if not public.is_seat_owner(p_game_id, p_seat) then
    raise exception 'seat % is not yours', p_seat;
  end if;

  delete from public.premove_cancel_triggers where game_id = p_game_id and seat = p_seat;
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then
    return false;
  end if;

  delete from public.premoves where game_id = p_game_id and seat = p_seat;
  insert into public.premove_failures (game_id, seat, move, reason, kind)
  values (p_game_id, p_seat, '', coalesce(p_reason, ''), 'cancelled');

  return true;
end;
$$;

revoke execute on function public.resolve_cancel_trigger_match(uuid, int, text) from public, anon;
grant execute on function public.resolve_cancel_trigger_match(uuid, int, text) to authenticated;
