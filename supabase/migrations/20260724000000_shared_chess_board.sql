-- One small, fully independent chess position per hosted Gaia game. The viewer renders and
-- validates real chess with chess.js; this table persists the resulting FEN and fans moves out over
-- Realtime. Chess never enters the Gaia engine move log, so switching the sidebar panel cannot
-- disturb either game.

create or replace function public.chess_start_fen()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'::text
$$;

create table public.chess_board (
  game_id    uuid primary key references public.games (id) on delete cascade,
  fen        text not null default public.chess_start_fen()
             check (length(fen) between 20 and 120 and split_part(fen, ' ', 2) in ('w', 'b')),
  panel_mode text not null default 'pool'
             check (panel_mode in ('pool', 'chess')),
  white_user uuid references auth.users (id) on delete set null,
  black_user uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.chess_board enable row level security;

-- Approved users may spectate any hosted game, matching the existing games/moves visibility model.
-- Nobody writes the table directly; the narrowly granted RPCs below are the only write paths.
create policy chess_board_select on public.chess_board
  for select
  to authenticated
  using ((select public.is_approved()));

revoke all on table public.chess_board from public, anon, authenticated;
grant select on table public.chess_board to authenticated;
grant all on table public.chess_board to service_role;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chess_board'
  ) then
    alter publication supabase_realtime add table public.chess_board;
  end if;
end;
$$;

-- Claim one free colour. Only an actual player seated in this Gaia game may claim, and one account
-- cannot occupy both chess colours. Any two participants may play in 3-4 player Gaia games; the
-- others remain spectators.
create or replace function public.claim_chess_color(p_game_id uuid, p_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_claimed boolean;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;
  if not exists (
    select 1
    from public.players p
    where p.game_id = p_game_id
      and public.is_seat_owner(p.game_id, p.seat)
  ) then
    raise exception 'only a player in this game can take a chess colour';
  end if;

  if p_color = 'w' then
    insert into public.chess_board as board (game_id, white_user, updated_by)
    values (p_game_id, v_uid, v_uid)
    on conflict (game_id) do update
      set white_user = v_uid, updated_at = now(), updated_by = v_uid
      where (board.white_user is null or board.white_user = v_uid)
        and board.black_user is distinct from v_uid
    returning true into v_claimed;
  elsif p_color = 'b' then
    insert into public.chess_board as board (game_id, black_user, updated_by)
    values (p_game_id, v_uid, v_uid)
    on conflict (game_id) do update
      set black_user = v_uid, updated_at = now(), updated_by = v_uid
      where (board.black_user is null or board.black_user = v_uid)
        and board.white_user is distinct from v_uid
    returning true into v_claimed;
  else
    raise exception 'bad chess colour %', p_color;
  end if;

  if v_claimed is not true then
    raise exception 'that chess colour is unavailable';
  end if;
end;
$$;

create or replace function public.leave_chess_seat(p_game_id uuid)
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
  update public.chess_board
  set white_user = case when white_user = v_uid then null else white_user end,
      black_user = case when black_user = v_uid then null else black_user end,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id
    and (white_user = v_uid or black_user = v_uid);
end;
$$;

-- Optimistic concurrency is enforced under a row lock. Chess legality is validated by the bundled
-- chess.js client; the database additionally rejects malformed state and a move that does not hand
-- the turn to the opposite colour.
create or replace function public.move_chess(p_game_id uuid, p_prev_fen text, p_next_fen text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_board  public.chess_board%rowtype;
  v_active text;
  v_mover  uuid;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  select *
  into v_board
  from public.chess_board
  where game_id = p_game_id
  for update;

  if not found then
    raise exception 'no chess board for game';
  end if;
  if v_board.fen is distinct from p_prev_fen then
    return v_board.fen;
  end if;

  v_active := split_part(v_board.fen, ' ', 2);
  v_mover := case when v_active = 'w' then v_board.white_user else v_board.black_user end;
  if v_mover is null or v_mover <> v_uid then
    raise exception 'not your chess move';
  end if;
  if p_next_fen is null
     or length(p_next_fen) not between 20 and 120
     or array_length(string_to_array(p_next_fen, ' '), 1) <> 6
     or split_part(p_next_fen, ' ', 2) <>
        (case when v_active = 'w' then 'b' else 'w' end) then
    raise exception 'invalid next chess position';
  end if;

  update public.chess_board
  set fen = p_next_fen,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id;
  return p_next_fen;
end;
$$;

-- Long-press reset keeps the two chess seats but restores the opening position. Only a seated chess
-- player may confirm it.
create or replace function public.reset_chess(p_game_id uuid)
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

  update public.chess_board
  set fen = public.chess_start_fen(),
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id
    and (white_user = v_uid or black_user = v_uid);
  if not found then
    raise exception 'only a seated chess player can reset';
  end if;
end;
$$;

-- The compact sidebar has two shared faces: the normal booster/federation pool and chess. Any
-- participant in the Gaia game may switch the face; approved spectators receive the same value via
-- Realtime but cannot change it.
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

revoke execute on function public.chess_start_fen() from public, anon, authenticated;
revoke execute on function public.claim_chess_color(uuid, text) from public, anon;
revoke execute on function public.leave_chess_seat(uuid) from public, anon;
revoke execute on function public.move_chess(uuid, text, text) from public, anon;
revoke execute on function public.reset_chess(uuid) from public, anon;
revoke execute on function public.set_chess_panel_mode(uuid, text) from public, anon;
grant execute on function public.claim_chess_color(uuid, text) to authenticated;
grant execute on function public.leave_chess_seat(uuid) to authenticated;
grant execute on function public.move_chess(uuid, text, text) to authenticated;
grant execute on function public.reset_chess(uuid) to authenticated;
grant execute on function public.set_chess_panel_mode(uuid, text) to authenticated;
