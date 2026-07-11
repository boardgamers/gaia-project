-- In-game chat + private notes (Gaia 21): each game gets its own chat (visible to every approved
-- user, same visibility as the game itself - players and spectators alike per the owner's answer)
-- and its own private per-user notes (never shared, not even with other players of the same game).
-- Mirrors the existing games/players/moves visibility model (is_approved()) rather than inventing a
-- separate one - see 20260708172234_admin_private_user_approval.sql for that gate.

create table public.game_chat_messages (
  id          bigint generated always as identity primary key,
  game_id     uuid not null references public.games (id) on delete cascade,
  user_id     uuid not null references auth.users (id),
  author_name text not null,
  body        text not null check (length(trim(body)) > 0 and length(body) <= 2000),
  created_at  timestamptz not null default now()
);

create index game_chat_messages_game_idx on public.game_chat_messages (game_id, created_at);

alter table public.game_chat_messages enable row level security;

-- Same read bar as the game itself (is_approved()) rather than is_game_member() - open games are
-- spectatable by any approved user (0018), and chat should be too, per the owner's explicit answer
-- ("Yes, spectators can read and post").
create policy game_chat_messages_select on public.game_chat_messages
  for select to authenticated using (public.is_approved());

create policy game_chat_messages_insert on public.game_chat_messages
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());

alter publication supabase_realtime add table public.game_chat_messages;

-- Private per-user, per-game notes - one row per (game, user), upserted on every autosave. Nobody
-- but the row's own owner can ever read or write it, not even other players in the same game.
create table public.game_notes (
  game_id    uuid not null references public.games (id) on delete cascade,
  user_id    uuid not null references auth.users (id),
  body       text not null default '',
  updated_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.game_notes enable row level security;

create policy game_notes_own on public.game_notes
  for all to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());
