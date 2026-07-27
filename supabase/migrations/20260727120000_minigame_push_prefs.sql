-- Per-account opt-in/out for the two side games' "your move" pushes (owner request).
--
-- Until now the sidebar chess board and the research panel's renju board both sent their pushes as
-- the generic "turn" category (notify/logic.ts), so the only way to stop being pinged about a
-- casual gomoku move was to also give up the Gaia turn push - the one notification the app exists
-- for. These two columns split them apart: each side game is now its own category, on by default
-- (nothing changes for anyone who never opens the settings modal) and switchable on its own.
--
-- A missing notification_prefs row still means "defaults" everywhere (notify/logic.ts's
-- DEFAULT_NOTIFICATION_PREFS, mirrored in viewer/src/hosted/notification-prefs.ts), so these
-- defaults must stay `true` to match.
--
-- A future side game adds one more column here, one more NotificationKind, and one more row in the
-- settings modal's category list - no other wiring.
alter table public.notification_prefs
  add column if not exists chess_pushes boolean not null default true,
  add column if not exists renju_pushes boolean not null default true;
