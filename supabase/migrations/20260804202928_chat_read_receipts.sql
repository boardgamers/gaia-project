-- Owner request (2026-08-04): "read checks" in chat - see who has read the thread so far, and how
-- far each person got. One row per reader per thread, holding the newest message id that reader has
-- seen. Mirrors the existing two-chat split (0032's per-game `game_chat_messages` and 0035's global
-- `lobby_chat_messages`) with one receipts table each, rather than one table with a nullable
-- game_id.
--
-- Visibility deliberately matches the chat itself (is_approved(), same bar as the messages): a read
-- receipt is only meaningful if everyone in the thread can see it. Nobody writes these tables
-- directly - the two security-definer RPCs below are the only write path, so a client can never
-- forge someone else's receipt or rewind its own (the upsert takes greatest(), so a second device
-- with a shorter loaded window can't drag a receipt backwards).

create table if not exists public.game_chat_reads (
  game_id              uuid not null references public.games (id) on delete cascade,
  user_id              uuid not null references auth.users (id),
  reader_name          text not null default '',
  last_read_message_id bigint not null,
  last_read_at         timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index if not exists game_chat_reads_user_idx on public.game_chat_reads (user_id);

create table if not exists public.lobby_chat_reads (
  user_id              uuid primary key references auth.users (id),
  reader_name          text not null default '',
  last_read_message_id bigint not null,
  last_read_at         timestamptz not null default now()
);

alter table public.game_chat_reads enable row level security;
alter table public.lobby_chat_reads enable row level security;

drop policy if exists game_chat_reads_select on public.game_chat_reads;
create policy game_chat_reads_select on public.game_chat_reads
  for select to authenticated using ((select public.is_approved()));

drop policy if exists lobby_chat_reads_select on public.lobby_chat_reads;
create policy lobby_chat_reads_select on public.lobby_chat_reads
  for select to authenticated using ((select public.is_approved()));

revoke all on table public.game_chat_reads from public, anon, authenticated;
revoke all on table public.lobby_chat_reads from public, anon, authenticated;
grant select on table public.game_chat_reads to authenticated;
grant select on table public.lobby_chat_reads to authenticated;
grant all on table public.game_chat_reads to service_role;
grant all on table public.lobby_chat_reads to service_role;

-- Live receipts: a reader opening the panel should light up on everyone else's thread without a
-- reload, the same way the messages themselves already do.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'game_chat_reads'
  ) then
    alter publication supabase_realtime add table public.game_chat_reads;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lobby_chat_reads'
  ) then
    alter publication supabase_realtime add table public.lobby_chat_reads;
  end if;
end;
$$;

create or replace function public.mark_game_chat_read(
  p_game_id uuid,
  p_message_id bigint,
  p_reader_name text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  insert into public.game_chat_reads (game_id, user_id, reader_name, last_read_message_id, last_read_at)
  values (p_game_id, v_uid, coalesce(nullif(btrim(p_reader_name), ''), 'Player'), p_message_id, now())
  on conflict (game_id, user_id) do update
    set last_read_message_id = greatest(game_chat_reads.last_read_message_id, excluded.last_read_message_id),
        reader_name = excluded.reader_name,
        last_read_at = now();
end;
$$;

create or replace function public.mark_lobby_chat_read(
  p_message_id bigint,
  p_reader_name text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null or not (select public.is_approved()) then
    raise exception 'auth required';
  end if;

  insert into public.lobby_chat_reads (user_id, reader_name, last_read_message_id, last_read_at)
  values (v_uid, coalesce(nullif(btrim(p_reader_name), ''), 'Player'), p_message_id, now())
  on conflict (user_id) do update
    set last_read_message_id = greatest(lobby_chat_reads.last_read_message_id, excluded.last_read_message_id),
        reader_name = excluded.reader_name,
        last_read_at = now();
end;
$$;

revoke execute on function public.mark_game_chat_read(uuid, bigint, text) from public, anon;
revoke execute on function public.mark_lobby_chat_read(bigint, text) from public, anon;
grant execute on function public.mark_game_chat_read(uuid, bigint, text) to authenticated;
grant execute on function public.mark_lobby_chat_read(bigint, text) to authenticated;
