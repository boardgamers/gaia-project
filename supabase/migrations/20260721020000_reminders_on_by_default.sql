-- Turn reminders: on by default (opt-out), reversing the opt-in default from
-- 20260721010000_notification_prefs.
--
-- The notify function already treats a missing prefs row as DEFAULT_NOTIFICATION_PREFS (now with
-- reminders_enabled = true), so this is what actually drives "on by default" for the vast majority
-- of users who never open the settings modal. This migration keeps the column default in sync for
-- the rare direct insert that omits the field. Existing rows are left untouched - they represent an
-- explicit choice a user already saved.
alter table public.notification_prefs
  alter column reminders_enabled set default true;
