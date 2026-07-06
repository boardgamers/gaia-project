-- Gaia 10 (docs/lost-fleet/PROGRESS.md): the turn-order presence dots (Gaia 9, PROGRESS #75) never
-- actually worked - confirmed live with two real signed-in browsers that Realtime Presence never
-- delivers a "sync"/"join" event (subscribe + track() both silently succeed, but the state stays
-- empty forever, self included). Root cause: this project has Realtime Authorization enabled by
-- default (RLS on realtime.messages, zero policies), so a private Presence channel is never
-- granted read/write access to its own topic. hosted/presence.ts now marks its channels
-- `private: true` (required for these policies to even be consulted), so they need real grants.
--
-- Scope is deliberately unrestricted by topic/user: the shared "presence:app" channel only ever
-- carries {context: {type, gameId}, focused} for a signed-in user, which is no more sensitive than
-- the players/games rows already readable under existing RLS.
create policy "authenticated can receive broadcasts"
on "realtime"."messages"
for select
to authenticated
using ( true );

create policy "authenticated can send broadcasts"
on "realtime"."messages"
for insert
to authenticated
with check ( true );
