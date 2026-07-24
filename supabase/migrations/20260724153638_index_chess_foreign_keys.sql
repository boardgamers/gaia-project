-- Account deletion should vacate a chess colour instead of blocking on a stale auth.users
-- reference. Cover each FK as recommended by the database advisor; game_id is already covered by
-- the chess_board primary key.

alter table public.chess_board
  drop constraint if exists chess_board_white_user_fkey,
  drop constraint if exists chess_board_black_user_fkey,
  drop constraint if exists chess_board_updated_by_fkey;

alter table public.chess_board
  add constraint chess_board_white_user_fkey
    foreign key (white_user) references auth.users (id) on delete set null,
  add constraint chess_board_black_user_fkey
    foreign key (black_user) references auth.users (id) on delete set null,
  add constraint chess_board_updated_by_fkey
    foreign key (updated_by) references auth.users (id) on delete set null;

create index if not exists chess_board_white_user_idx on public.chess_board (white_user);
create index if not exists chess_board_black_user_idx on public.chess_board (black_user);
create index if not exists chess_board_updated_by_idx on public.chess_board (updated_by);
