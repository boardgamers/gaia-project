-- Extend per-game chess to the agreed multiplayer relay:
--   * 2 Gaia players: one chess player per colour.
--   * 3 Gaia players: one two-person team and one solo player.
--   * 4 Gaia players: two two-person teams.
-- A team shares its colour, but its members alternate that colour's moves. All membership and
-- next-mover transitions happen under the chess row lock so the rule survives concurrent tabs.

alter table public.chess_board
  add column if not exists white_user_2 uuid,
  add column if not exists black_user_2 uuid,
  add column if not exists white_next_user uuid,
  add column if not exists black_next_user uuid;

-- Existing one-player colours remain the first relay member and therefore move first.
update public.chess_board
set white_next_user = coalesce(white_next_user, white_user),
    black_next_user = coalesce(black_next_user, black_user);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chess_board_white_user_2_fkey'
      and conrelid = 'public.chess_board'::regclass
  ) then
    alter table public.chess_board
      add constraint chess_board_white_user_2_fkey
      foreign key (white_user_2) references auth.users (id) on delete set null;
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chess_board_black_user_2_fkey'
      and conrelid = 'public.chess_board'::regclass
  ) then
    alter table public.chess_board
      add constraint chess_board_black_user_2_fkey
      foreign key (black_user_2) references auth.users (id) on delete set null;
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chess_board_white_next_user_fkey'
      and conrelid = 'public.chess_board'::regclass
  ) then
    alter table public.chess_board
      add constraint chess_board_white_next_user_fkey
      foreign key (white_next_user) references auth.users (id) on delete set null;
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chess_board_black_next_user_fkey'
      and conrelid = 'public.chess_board'::regclass
  ) then
    alter table public.chess_board
      add constraint chess_board_black_next_user_fkey
      foreign key (black_next_user) references auth.users (id) on delete set null;
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chess_board_white_next_member_check'
      and conrelid = 'public.chess_board'::regclass
  ) then
    alter table public.chess_board
      add constraint chess_board_white_next_member_check
      check (
        white_next_user is null
        or white_next_user = white_user
        or white_next_user = white_user_2
      );
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chess_board_black_next_member_check'
      and conrelid = 'public.chess_board'::regclass
  ) then
    alter table public.chess_board
      add constraint chess_board_black_next_member_check
      check (
        black_next_user is null
        or black_next_user = black_user
        or black_next_user = black_user_2
      );
  end if;
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chess_board_unique_team_users_check'
      and conrelid = 'public.chess_board'::regclass
  ) then
    alter table public.chess_board
      add constraint chess_board_unique_team_users_check
      check (
        (white_user is null or white_user_2 is null or white_user <> white_user_2)
        and (white_user is null or black_user is null or white_user <> black_user)
        and (white_user is null or black_user_2 is null or white_user <> black_user_2)
        and (white_user_2 is null or black_user is null or white_user_2 <> black_user)
        and (white_user_2 is null or black_user_2 is null or white_user_2 <> black_user_2)
        and (black_user is null or black_user_2 is null or black_user <> black_user_2)
      );
  end if;
end;
$$;

create index if not exists chess_board_white_user_2_idx on public.chess_board (white_user_2);
create index if not exists chess_board_black_user_2_idx on public.chess_board (black_user_2);
create index if not exists chess_board_white_next_user_idx on public.chess_board (white_next_user);
create index if not exists chess_board_black_next_user_idx on public.chess_board (black_next_user);

create or replace function public.claim_chess_color(p_game_id uuid, p_color text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_player_count integer;
  v_board        public.chess_board%rowtype;
  v_team_size    integer;
  v_team_capacity integer;
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  select g.player_count
  into v_player_count
  from public.games g
  where g.id = p_game_id;
  if not found or v_player_count not between 2 and 4 then
    raise exception 'unsupported Gaia player count';
  end if;
  if not exists (
    select 1
    from public.players p
    where p.game_id = p_game_id
      and public.is_seat_owner(p.game_id, p.seat)
  ) then
    raise exception 'only a player in this game can join a chess team';
  end if;
  if p_color not in ('w', 'b') then
    raise exception 'bad chess colour %', p_color;
  end if;

  insert into public.chess_board (game_id, updated_by)
  values (p_game_id, v_uid)
  on conflict (game_id) do nothing;

  select *
  into v_board
  from public.chess_board
  where game_id = p_game_id
  for update;

  if v_uid = v_board.white_user or v_uid = v_board.white_user_2 then
    if p_color = 'w' then
      return;
    end if;
    raise exception 'already on the other chess team';
  end if;
  if v_uid = v_board.black_user or v_uid = v_board.black_user_2 then
    if p_color = 'b' then
      return;
    end if;
    raise exception 'already on the other chess team';
  end if;
  if num_nonnulls(v_board.white_user, v_board.white_user_2, v_board.black_user, v_board.black_user_2)
     >= v_player_count then
    raise exception 'all chess team places are taken';
  end if;

  v_team_capacity := case when v_player_count = 2 then 1 else 2 end;
  if p_color = 'w' then
    v_team_size := num_nonnulls(v_board.white_user, v_board.white_user_2);
    if v_team_size >= v_team_capacity then
      raise exception 'that chess team is full';
    end if;
    if v_board.white_user is null then
      update public.chess_board
      set white_user = v_uid,
          white_next_user = coalesce(v_board.white_next_user, v_board.white_user_2, v_uid),
          updated_at = now(),
          updated_by = v_uid
      where game_id = p_game_id;
    else
      update public.chess_board
      set white_user_2 = v_uid,
          white_next_user = coalesce(v_board.white_next_user, v_board.white_user, v_uid),
          updated_at = now(),
          updated_by = v_uid
      where game_id = p_game_id;
    end if;
  else
    v_team_size := num_nonnulls(v_board.black_user, v_board.black_user_2);
    if v_team_size >= v_team_capacity then
      raise exception 'that chess team is full';
    end if;
    if v_board.black_user is null then
      update public.chess_board
      set black_user = v_uid,
          black_next_user = coalesce(v_board.black_next_user, v_board.black_user_2, v_uid),
          updated_at = now(),
          updated_by = v_uid
      where game_id = p_game_id;
    else
      update public.chess_board
      set black_user_2 = v_uid,
          black_next_user = coalesce(v_board.black_next_user, v_board.black_user, v_uid),
          updated_at = now(),
          updated_by = v_uid
      where game_id = p_game_id;
    end if;
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
  v_uid   uuid := (select auth.uid());
  v_board public.chess_board%rowtype;
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
    return;
  end if;

  if v_board.white_user = v_uid then
    update public.chess_board
    set white_user = v_board.white_user_2,
        white_user_2 = null,
        white_next_user = v_board.white_user_2,
        updated_at = now(),
        updated_by = v_uid
    where game_id = p_game_id;
  elsif v_board.white_user_2 = v_uid then
    update public.chess_board
    set white_user_2 = null,
        white_next_user = v_board.white_user,
        updated_at = now(),
        updated_by = v_uid
    where game_id = p_game_id;
  elsif v_board.black_user = v_uid then
    update public.chess_board
    set black_user = v_board.black_user_2,
        black_user_2 = null,
        black_next_user = v_board.black_user_2,
        updated_at = now(),
        updated_by = v_uid
    where game_id = p_game_id;
  elsif v_board.black_user_2 = v_uid then
    update public.chess_board
    set black_user_2 = null,
        black_next_user = v_board.black_user,
        updated_at = now(),
        updated_by = v_uid
    where game_id = p_game_id;
  end if;
end;
$$;

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
  v_mover := case
    when v_active = 'w' then coalesce(v_board.white_next_user, v_board.white_user, v_board.white_user_2)
    else coalesce(v_board.black_next_user, v_board.black_user, v_board.black_user_2)
  end;
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
      white_next_user = case
        when v_active <> 'w' then white_next_user
        when white_user is not null and white_user_2 is not null then
          case when v_mover = white_user then white_user_2 else white_user end
        else coalesce(white_user, white_user_2)
      end,
      black_next_user = case
        when v_active <> 'b' then black_next_user
        when black_user is not null and black_user_2 is not null then
          case when v_mover = black_user then black_user_2 else black_user end
        else coalesce(black_user, black_user_2)
      end,
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id;
  return p_next_fen;
end;
$$;

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
      white_next_user = coalesce(white_user, white_user_2),
      black_next_user = coalesce(black_user, black_user_2),
      updated_at = now(),
      updated_by = v_uid
  where game_id = p_game_id
    and (
      white_user = v_uid
      or white_user_2 = v_uid
      or black_user = v_uid
      or black_user_2 = v_uid
    );
  if not found then
    raise exception 'only a chess team member can reset';
  end if;
end;
$$;

revoke execute on function public.claim_chess_color(uuid, text) from public, anon;
revoke execute on function public.leave_chess_seat(uuid) from public, anon;
revoke execute on function public.move_chess(uuid, text, text) from public, anon;
revoke execute on function public.reset_chess(uuid) from public, anon;
grant execute on function public.claim_chess_color(uuid, text) to authenticated;
grant execute on function public.leave_chess_seat(uuid) to authenticated;
grant execute on function public.move_chess(uuid, text, text) to authenticated;
grant execute on function public.reset_chess(uuid) to authenticated;
