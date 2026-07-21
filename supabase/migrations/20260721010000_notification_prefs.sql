-- Global (per-account) notification preferences.
--
-- Notifications used to be all-or-nothing per device (a push_subscriptions row). This adds one
-- per-user preferences row - set once, applied by the `notify` Edge Function to every game and
-- every device - so players choose which categories they get, opt in/out of the recurring 12h turn
-- reminder (now OFF by default), tune its interval/cap, set their own quiet-hours window, and snooze
-- everything temporarily. Whether a *specific device* is subscribed at all stays per-device (a Web
-- Push subscription is physically bound to one device); this table is only the "which/when".
--
-- A missing row means defaults (see notify/logic.ts::DEFAULT_NOTIFICATION_PREFS): every category on
-- except reminders, which are opt-in. So shipping this immediately stops the always-on 12h reminders
-- for everyone until they opt in - the intended behavior change.

create table public.notification_prefs (
  user_id                 uuid primary key references auth.users (id) on delete cascade,
  turn_pushes             boolean not null default true,
  chat_pushes             boolean not null default true,
  invite_pushes           boolean not null default true,
  finished_pushes         boolean not null default true,
  reminders_enabled       boolean not null default false,
  reminder_interval_hours int not null default 12 check (reminder_interval_hours in (12, 24, 48)),
  reminder_max_count      int not null default 3 check (reminder_max_count between 1 and 10),
  quiet_hours_enabled     boolean not null default true,
  quiet_start_hour        int not null default 22 check (quiet_start_hour between 0 and 23),
  quiet_end_hour          int not null default 8 check (quiet_end_hour between 0 and 23),
  snooze_until            timestamptz,
  updated_at              timestamptz not null default now()
);

alter table public.notification_prefs enable row level security;

-- A user only ever sees/edits their own row. The notify function reads with the service role, which
-- bypasses RLS.
create policy notification_prefs_select_own on public.notification_prefs
  for select to authenticated using (user_id = auth.uid());

create policy notification_prefs_insert_own on public.notification_prefs
  for insert to authenticated with check (user_id = auth.uid());

create policy notification_prefs_update_own on public.notification_prefs
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Keep updated_at current on every write (the client upserts the whole row; this saves it from
-- having to set the timestamp itself).
create or replace function public.touch_notification_prefs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger notification_prefs_touch_updated_at
  before update on public.notification_prefs
  for each row execute function public.touch_notification_prefs_updated_at();
