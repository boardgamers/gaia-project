-- Owner request (Gaia 21 follow-up): a single global "Lobby Chat" room, visible/postable by every
-- approved user, full history saved forever (no game_id - unlike game_chat_messages, this isn't
-- scoped to any one game). Same visibility bar (is_approved()) and RLS shape as game_chat_messages
-- (0032), minus the per-game scoping.

create table public.lobby_chat_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id),
  author_name text not null,
  body        text not null check (length(trim(body)) > 0 and length(body) <= 2000),
  created_at  timestamptz not null default now()
);

create index lobby_chat_messages_created_idx on public.lobby_chat_messages (created_at);

alter table public.lobby_chat_messages enable row level security;

create policy lobby_chat_messages_select on public.lobby_chat_messages
  for select to authenticated using (public.is_approved());

create policy lobby_chat_messages_insert on public.lobby_chat_messages
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());

alter publication supabase_realtime add table public.lobby_chat_messages;
