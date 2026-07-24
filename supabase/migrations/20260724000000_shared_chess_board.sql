-- A single global, shared chess game (owner request) that lives inside the Lost Fleet
-- booster/federation sidebar container: clicking that container flips it to a real, fully
-- functional chess board. One row, id = 'global', holds the game as a FEN string plus the two
-- seats (white_user / black_user).
--
-- Ownership rules (owner request: "don't let every player make all moves - in 2 player each
-- player can only move their own pieces"): each colour is claimed by one user, and moves are
-- funnelled through SECURITY DEFINER RPCs that enforce "the side to move must belong to the
-- caller" server-side. Clients therefore CANNOT update the row directly (no update RLS policy) -
-- they must go through move_chess / reset_chess / claim_chess_color / leave_chess_seat. Chess
-- legality itself (legal moves, castling, en passant, promotion, check/mate) is enforced
-- client-side by chess.js; the RPCs only guard seat ownership, turn order and concurrency.
-- Visibility mirrors the existing games/chat model (is_approved(), see 0032_game_chat_and_notes.sql).

create table public.chess_board (
  id         text primary key default 'global',
  fen        text not null,
  white_user uuid references auth.users (id),
  black_user uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table public.chess_board enable row level security;

-- Any approved user can watch the board.
create policy chess_board_select on public.chess_board
  for select to authenticated using (public.is_approved());

-- Deliberately NO insert/update/delete policy: all writes go through the RPCs below, which run as
-- SECURITY DEFINER (bypassing RLS) after checking seat ownership. This is what stops a spectator -
-- or the wrong player - from moving a piece.

-- Live fan-out of every move to all viewers (same mechanism as moves/chat).
alter publication supabase_realtime add table public.chess_board;

-- The standard starting position.
insert into public.chess_board (id, fen)
values ('global', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
on conflict (id) do nothing;

-- Claim a free colour ('w' or 'b'). No-op (row untouched) if the seat is already taken; the client
-- re-reads the row afterwards to learn the outcome.
create or replace function public.claim_chess_color(p_color text)
  returns void
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
begin
  -- is_approved() alone returns true for a null-uid (anon) caller, so guard auth.uid() explicitly.
  if auth.uid() is null or not public.is_approved() then
    raise exception 'auth required';
  end if;
  if p_color = 'w' then
    update public.chess_board
      set white_user = auth.uid(), updated_at = now()
      where id = 'global' and white_user is null;
  elsif p_color = 'b' then
    update public.chess_board
      set black_user = auth.uid(), updated_at = now()
      where id = 'global' and black_user is null;
  else
    raise exception 'bad colour %', p_color;
  end if;
end;
$$;

-- Vacate whichever seat(s) the caller holds, so someone else can take over.
create or replace function public.leave_chess_seat()
  returns void
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null or not public.is_approved() then
    raise exception 'auth required';
  end if;
  update public.chess_board
    set white_user = case when white_user = auth.uid() then null else white_user end,
        black_user = case when black_user = auth.uid() then null else black_user end,
        updated_at = now()
    where id = 'global';
end;
$$;

-- Apply a move. p_prev_fen is the board the client believes it is moving from (optimistic
-- concurrency: if the stored board has since changed, we reject and hand back the current FEN so
-- the client resyncs). The side to move in p_prev_fen must belong to the caller.
create or replace function public.move_chess(p_prev_fen text, p_next_fen text)
  returns text
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
declare
  cur    public.chess_board;
  active text;
  mover  uuid;
begin
  if auth.uid() is null or not public.is_approved() then
    raise exception 'auth required';
  end if;
  select * into cur from public.chess_board where id = 'global' for update;
  if cur.fen <> p_prev_fen then
    return cur.fen; -- board moved on under us; caller should resync to this
  end if;
  active := split_part(cur.fen, ' ', 2); -- 'w' or 'b'
  mover := case when active = 'w' then cur.white_user else cur.black_user end;
  if mover is null or mover <> auth.uid() then
    raise exception 'not your move';
  end if;
  update public.chess_board
    set fen = p_next_fen, updated_at = now(), updated_by = auth.uid()
    where id = 'global';
  return p_next_fen;
end;
$$;

-- Reset to the starting position (new game). Only a seated player may reset; seats are kept.
create or replace function public.reset_chess()
  returns void
  language plpgsql
  security definer
  set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null or not public.is_approved() then
    raise exception 'auth required';
  end if;
  perform 1 from public.chess_board
    where id = 'global' and (white_user = auth.uid() or black_user = auth.uid());
  if not found then
    raise exception 'only a seated player can reset';
  end if;
  update public.chess_board
    set fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        updated_at = now(), updated_by = auth.uid()
    where id = 'global';
end;
$$;

-- Only signed-in users may call these. Supabase grants EXECUTE to anon by default (both via PUBLIC
-- and a direct role grant), so revoke both; the functions also guard auth.uid() internally.
revoke execute on function public.claim_chess_color(text) from public, anon;
revoke execute on function public.leave_chess_seat() from public, anon;
revoke execute on function public.move_chess(text, text) from public, anon;
revoke execute on function public.reset_chess() from public, anon;
grant execute on function public.claim_chess_color(text) to authenticated;
grant execute on function public.leave_chess_seat() to authenticated;
grant execute on function public.move_chess(text, text) to authenticated;
grant execute on function public.reset_chess() to authenticated;
