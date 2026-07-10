-- In-game "Abandon game" action (Gaia 18): any seated player can mark a game abandoned instead of
-- deleting it outright, so the other players still see it (and know why it stopped) rather than
-- having it silently vanish out from under them. Abandoned games are unplayable (writes blocked by
-- the same require_approved-style guard pattern below) but stay visible until pruned a week later.

alter table public.games
  add column if not exists abandoned_at timestamptz;

create or replace function public.abandon_game(p_game_id uuid)
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
  if not exists (
    select 1 from public.games g
    where g.id = p_game_id
      and (g.created_by = v_uid or exists (
        select 1 from public.players p where p.game_id = g.id and p.user_id = v_uid
      ))
  ) then
    raise exception 'only a player in this game can abandon it';
  end if;
  update public.games set abandoned_at = now() where id = p_game_id and abandoned_at is null;
end;
$$;

revoke execute on function public.abandon_game(uuid) from public, anon;
grant execute on function public.abandon_game(uuid) to authenticated;

-- Block further writes to an abandoned game's moves/premoves (games/players rows themselves stay
-- writable so the abandon flag/prune below still work).
create or replace function public.require_not_abandoned()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if exists (select 1 from public.games where id = new.game_id and abandoned_at is not null) then
    raise exception 'this game has been abandoned';
  end if;
  return new;
end;
$$;

create trigger moves_require_not_abandoned
  before insert on public.moves
  for each row execute function public.require_not_abandoned();

-- Opportunistic pruning: no pg_cron dependency - any authenticated client's lobby visit can
-- trigger this, and it only ever deletes games that have been sitting abandoned for a week.
create or replace function public.prune_abandoned_games()
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  delete from public.games where abandoned_at is not null and abandoned_at < now() - interval '7 days';
end;
$$;

revoke execute on function public.prune_abandoned_games() from public, anon;
grant execute on function public.prune_abandoned_games() to authenticated;
