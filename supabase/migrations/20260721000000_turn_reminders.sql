-- Recurring "still your turn" reminders (turn nudges).
--
-- The one-shot turn push (supabase/functions/notify) fires only the instant it becomes a player's
-- turn. This adds a re-nudge for a player who still hasn't moved: every 12h, capped at 3 per turn,
-- and never during their local night. An hourly pg_cron job re-invokes the existing `notify` Edge
-- Function with {type:'reminder_sweep'}; the function does the candidate query + delivery
-- (notify/logic.ts::planTurnReminder decides per game).
--
-- Mirrors the existing notify trigger's app_config pattern (0001_multiplayer.sql) so no
-- project-specific URL/key lives in this migration, and the sweep stays a silent no-op until
-- app_config['notify'] is seeded.

-- Per-game reminder bookkeeping. turn_reminder_count is scoped to the current turn: the notify
-- function treats a reminder stamped before the turn's start (latest_move_committed_at) as
-- belonging to a previous turn, so the count resets implicitly when the player finally moves - no
-- commit_turn changes needed.
alter table public.games
  add column if not exists last_turn_reminder_at timestamptz,
  add column if not exists turn_reminder_count int not null default 0;

-- Per-device IANA timezone, captured at subscribe time (viewer/src/hosted/push.ts), used only for
-- the sweep's quiet-hours gate. Null for legacy subscriptions - the gate never suppresses on an
-- unknown timezone.
alter table public.push_subscriptions
  add column if not exists tz text;

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- (Re)schedule the hourly sweep idempotently so re-running the migration is safe.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'turn-reminder-sweep') then
    perform cron.unschedule('turn-reminder-sweep');
  end if;
end $$;

select cron.schedule(
  'turn-reminder-sweep',
  '0 * * * *',
  $cron$
    select net.http_post(
      url := (select value ->> 'url' from public.app_config where key = 'notify'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select value ->> 'key' from public.app_config where key = 'notify')
      ),
      body := jsonb_build_object('type', 'reminder_sweep')
    )
    where exists (select 1 from public.app_config where key = 'notify');
  $cron$
);
