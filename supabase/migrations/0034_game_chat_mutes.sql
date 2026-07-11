-- Owner request (Gaia 21 follow-up): let a user mute a specific game's chat so they stop getting
-- push notifications for new messages there, without affecting anyone else or any other game's
-- chat. Default is unmuted (a row's mere existence means "muted" - no player has a row here until
-- they explicitly mute, so a brand new game/user pair is always unmuted by default).

create table public.game_chat_mutes (
  game_id    uuid not null references public.games (id) on delete cascade,
  user_id    uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.game_chat_mutes enable row level security;

-- Same "own row only" bar as game_notes - nobody, not even other players in the same game, can see
-- or change someone else's mute preference.
create policy game_chat_mutes_own on public.game_chat_mutes
  for all to authenticated
  using (public.is_approved() and user_id = auth.uid())
  with check (public.is_approved() and user_id = auth.uid());
