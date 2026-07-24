-- Keep the compact Lost Fleet sidebar face synchronized for every viewer of one hosted game.
-- Existing rows start on their current pool face; Realtime already publishes the whole table.

alter table public.chess_board
  add column if not exists panel_mode text;

update public.chess_board
set panel_mode = 'pool'
where panel_mode is null;

alter table public.chess_board
  alter column panel_mode set default 'pool',
  alter column panel_mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chess_board_panel_mode_check'
      and conrelid = 'public.chess_board'::regclass
  ) then
    alter table public.chess_board
      add constraint chess_board_panel_mode_check
      check (panel_mode in ('pool', 'chess'));
  end if;
end;
$$;

create or replace function public.set_chess_panel_mode(p_game_id uuid, p_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;
  if p_mode is null or p_mode not in ('pool', 'chess') then
    raise exception 'bad chess panel mode %', p_mode;
  end if;
  if not exists (
    select 1
    from public.players p
    where p.game_id = p_game_id
      and public.is_seat_owner(p.game_id, p.seat)
  ) then
    raise exception 'only a player in this game can switch the chess panel';
  end if;

  insert into public.chess_board as board (game_id, panel_mode, updated_by)
  values (p_game_id, p_mode, v_uid)
  on conflict (game_id) do update
    set panel_mode = excluded.panel_mode,
        updated_at = now(),
        updated_by = v_uid;
end;
$$;

revoke execute on function public.set_chess_panel_mode(uuid, text) from public, anon;
grant execute on function public.set_chess_panel_mode(uuid, text) to authenticated;
