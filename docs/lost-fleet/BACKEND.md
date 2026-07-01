# Lost Fleet — Supabase Multiplayer Backend: Design (PROPOSED, awaiting owner confirmation)

> Status: **DESIGN ONLY — no implementation code yet**, per the working agreement (plan first,
> confirm, then code). Grounded in the actual code paths listed below, not assumptions.
> Locked decisions honored: §A2 (undo within own turn only), §A3 (no Automa/solo),
> §J1 (only completed turns persist + broadcast), §J2 (derive "who can act" from the engine,
> not round-robin), §J3 (seed fixed at creation), §J4 (email turn notifications baseline).
> Date: 2026-07-01.

## 0. Code facts this design is built on (traced, with refs)

| Fact | Where |
| --- | --- |
| The viewer app is wrapped in an `EventEmitter`; an external host drives it via `"state"`, `"player"`, `"preferences"` events and observes `"move"` | `viewer/src/launcher.ts:26-90` |
| `"player"` event → `store.commit("player", data)` → `state.player = { index }` | `launcher.ts:41`, `store.ts:205-207` |
| Turn locking already exists: `canPlay = !ended && (!state.player \|\| sessionPlayer === engine.players[currentPlayer(engine)])` — it just never gets a non-null `state.player` today | `Game.vue:272-274`, `Game.vue:307-313` |
| `currentPlayer(engine)` = `engine.playerToMove` | `engine/wrapper.ts:201-203` |
| `engine.playerToMove` returns `tempCurrentPlayer` when set — i.e. **mid-turn leech/charge interrupts already resolve to the interrupting seat**. Exactly one seat can act at any moment. | `engine/src/engine.ts:588-594` |
| Commit rule: clone engine, apply the move line, keep it **only if `copy.newTurn`** (turn completed); otherwise the clone is discarded and only rendered | `viewer/src/self-contained.ts:127-141`, mirrored by `engine/wrapper.ts:205-210` (`toSave`) |
| The `"move"` payload is the **whole turn line so far** (the UI accumulates commands with `". "` into `currentMove` and re-emits the full line each time) — so one committed turn = one string | `Game.vue:143,353-391` |
| `engine.moveHistory[0]` is the `init <players> <seed>` line; committed turns are indexes 1.. | `self-contained.ts:104`, `engine.ts:319,421` |
| Replay is total: `new Engine(["init N seed", ...moves], options)` deterministically rebuilds any state (§J3) | `self-contained.ts:104`, whole engine test suite |
| Zero persistence code exists in `viewer/src` today; `main.ts` picks self-contained mode unconditionally | `viewer/src/main.ts`, PROGRESS.md "Current mechanics" (~line 1099) |
| Game options shape to persist = `SelfContainedSetup["options"]` | `self-contained.ts:12-26` |
| Engine `Player` has a display `name` field, restorable via `fromData` | `engine/src/player.ts:123,171,223` |

Conclusion baked into everything below: **the engine is the sole authority on legality and
turn order; Supabase stores `seed + options + append-only committed turn lines` and fans them
out.** The backend never interprets game rules. No `engine/` changes are needed anywhere in
this plan (everything uses the existing public surface: `fromData`, `move`, `newTurn`,
`playerToMove`, `moveHistory`, `phase`).

## 1. Schema (one SQL migration, checked into `supabase/migrations/`)

```sql
create table games (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  created_by    uuid not null references auth.users (id),
  name          text not null default '',
  seed          text not null,                          -- fixed at creation, never regenerated (§J3)
  player_count  int  not null check (player_count between 2 and 5),
  options       jsonb not null,                         -- exact SelfContainedSetup["options"] shape
  status        text not null default 'active' check (status in ('active', 'finished')),
  current_seat  int,                                    -- engine.playerToMove after last commit; null when finished
  move_count    int not null default 0,                 -- = max(moves.seq); maintained only by commit_turn()
  last_committed_by uuid,                               -- who committed last (notify skips self-notifications)
  -- Phase 2 (optional fast-boot cache, see §8) — columns exist but stay null in v1:
  cached_state       jsonb,
  cached_state_moves int
);

create table players (
  game_id       uuid not null references games (id) on delete cascade,
  seat          int  not null check (seat >= 0),        -- = engine player index 0..player_count-1
  invited_email text not null,                          -- stored lowercased
  user_id       uuid references auth.users (id),        -- null until the invitee claims the seat
  display_name  text not null default '',
  primary key (game_id, seat),
  unique (game_id, invited_email)
);

create table moves (
  game_id      uuid not null references games (id) on delete cascade,
  seq          int  not null,      -- 1-based; equals the line's index in engine.moveHistory
                                   -- (the init line is index 0 and is NEVER stored — it is
                                   --  reconstructed from games.seed/player_count)
  seat         int  not null,      -- engine player index that committed this turn
  move         text not null,      -- the full committed turn line (may contain ". "-joined commands)
  committed_at timestamptz not null default now(),
  committed_by uuid not null references auth.users (id),
  primary key (game_id, seq)       -- append-only + race-safe: a stale double-commit is a PK conflict
);

-- §6 (push notifications, post-amendment):
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique,                      -- browser push service URL
  p256dh     text not null,                             -- client public key
  auth       text not null,                             -- client auth secret
  user_agent text,
  created_at timestamptz not null default now()
);

-- Service-role-only config (RLS on, zero policies): VAPID keypair + notify function URL/key,
-- seeded directly into the live DB, never committed to the repo.
create table app_config (
  key   text primary key,
  value jsonb not null
);
```

Why the move list (not a state blob) is the source of truth: locked §A decision — the engine
is deterministic from `seed + moves`, so `games` + `moves` reconstruct everything, the log is
auditable, and no server code ever has to understand game state. `current_seat` / `move_count`
/ `status` on `games` are **denormalized copies for the lobby and the notification trigger
only** — the client never uses them for enforcement (the replayed engine is authoritative;
see §4).

### Write path: RPCs only (this is what makes the log append-only)

No direct `insert/update` policies exist on `games`/`players`/`moves`. All writes go through
three `security definer` functions, so append-only isn't a convention — it's the only door:

- `create_game(name, seed, player_count, options, invites jsonb)` — inserts the `games` row +
  one `players` row per invite `{email, seat, display_name}`. Asserts the caller's own email
  is among the invites (the host always plays; no spectator-only role in v1) and that seats
  are exactly `0..player_count-1`.
- `claim_my_seats()` — `update players set user_id = auth.uid() where user_id is null and
  invited_email = lower(auth.email())`. Called by the client after every sign-in; this is the
  entire "accept invite" step.
- `commit_turn(game_id, seq, seat, move, next_seat, finished)` — the only way a move row is
  born. Asserts: caller's `auth.uid()` owns `seat` in this game; `games.status = 'active'`;
  `seq = games.move_count + 1`. Then, atomically: insert the `moves` row and update
  `games.move_count / current_seat / status`. A concurrent/stale commit fails the `seq`
  assertion (or the PK), and the client resyncs — no lost or reordered turns possible.

## 2. Invite flow & auth

- **Auth = Supabase magic links** (`signInWithOtp`) — passwordless email sign-in, works on
  every device, natural fit for "identify friends by email". No passwords to manage for a
  handful of users.
- Host fills in the create-game form: game name, options (incl. `lostFleet`), and the friends'
  emails in **seat order** (UI offers a shuffle button; seed is generated once client-side and
  stored — §J3). Seat index = engine player index; everything downstream (faction pick order,
  auction, in-game turn order) is the engine's business via normal committed moves.
- Invitees get an email ("You've been invited to <game> — <link>", sent by the same Edge
  Function as turn notifications, triggered on game creation). Opening the link → magic-link
  sign-in → `claim_my_seats()` matches their email to their seat(s) → the game loads with
  their seat locked.
- Invite-only enforcement is RLS (§5): a stranger who signs in sees zero rows. No public
  matchmaking, no anonymous play (locked decision).

## 3. Turn order & locking (the §J2 case)

- **Client-side (enforcement):** after loading, the hosted entry point finds the caller's
  `players` row and emits `emitter.emit("player", { index: seat })` — the one thing
  `self-contained.ts` never does. From there the *existing* chain does all the work:
  `launcher.ts:41` → `store.state.player` → `Game.vue:272` `canPlay` compares the session
  seat against `engine.playerToMove`. Because `playerToMove` returns `tempCurrentPlayer`
  during pending leech/charge decisions (`engine.ts:588-594`), a mid-turn interrupt
  automatically unlocks the interrupting player's browser and locks everyone else's —
  **zero new turn-order logic is written; §J2 is satisfied by the engine itself.**
- **Server-side (display + notifications):** `commit_turn`'s `next_seat` parameter is
  `copy.playerToMove` computed by the committing client from the post-move engine (null +
  `finished=true` when `copy.phase === EndGame`). It feeds the lobby's "whose turn" column and
  the email trigger. Trust model: clients are trusted to report it honestly (friends group;
  the engine replay is always the real authority, so a wrong `current_seat` can misdirect an
  email at worst, never corrupt a game).

## 4. Realtime sync & catch-up

- **Boot (fresh load / reconnect):** fetch the `games` row + `players` + all `moves` ordered
  by `seq`, then `new Engine(["init ${player_count} ${seed}", ...moves.map(m => m.move)],
  games.options)` + `generateAvailableCommandsIfNeeded()` — the same construction as
  `self-contained.ts:104`, just fed from the database. Stamp `engine.players[seat].name =
  display_name` for display, then emit `"state"`.
- **Live:** one Supabase Realtime channel per game, `postgres_changes` INSERT on `moves`
  filtered by `game_id` (RLS-authorized via the user's JWT). Handler:
  - `row.seq <= localCount` → skip (it's our own commit echoing back, or already applied).
  - `row.seq === localCount + 1` → clone engine (`Engine.fromData`), `copy.move(row.move)`,
    emit `"state"`.
  - gap (`row.seq > localCount + 1`) or any apply error → **full resync** (refetch all moves,
    rebuild). Resync also runs on channel rejoin after disconnect and on tab re-focus, so a
    laptop waking from sleep catches up without a reload.
- **Commit (replaces `self-contained.ts`'s `emitter.on("move")` body, same skeleton):**

  ```ts
  emitter.on("move", async (move: string) => {
    const copy = Engine.fromData(JSON.parse(JSON.stringify(engine)));
    if (move) {
      copy.move(move);
      copy.generateAvailableCommandsIfNeeded();
      if (copy.newTurn) {                       // §J1/§A2: only a completed turn leaves the browser
        await rpc("commit_turn", { game_id, seq: localCount + 1, seat: mySeat, move,
                                   next_seat: ..., finished: ... });
        // success → engine = copy; seq-conflict/failure → full resync + error toast
      }
    }
    emitter.emit("state", JSON.parse(JSON.stringify(copy)));  // partial moves render locally only
  });
  ```

  Incomplete turn lines never reach the network, so **undo within your own turn stays free
  and invisible to others** (§A2), exactly as today. Undo of an already-committed turn is not
  supported in v1 (matches §A2's definition of commitment).

## 5. Row-level security

RLS enabled on all three tables. One membership predicate, used everywhere
(as a `security definer` helper `is_member(game_id)` to avoid recursive-policy issues):

> the caller has a `players` row in this game with `user_id = auth.uid()`
> **or** `invited_email = lower(auth.email())` (so invitees can see the game pre-claim).

- `games`: SELECT for members. No INSERT/UPDATE/DELETE policies (writes only via the RPCs).
- `players`: SELECT for members of the same game. No direct writes.
- `moves`: SELECT for members. No direct writes — append-only is structural (§1).
- Realtime `postgres_changes` respects these SELECT policies, so move broadcasts only reach
  seated players. `moves` is added to the `supabase_realtime` publication in the migration.

## 6. Turn notifications — Web Push (§J4 as AMENDED by owner ruling 2026-07-01)

> Original plan was email-first per the old §J4; the owner overruled it on review: **push
> notifications only, no turn-change emails** (owner doesn't check email / doesn't want spam).
> §J4 in RULES_CLARIFICATIONS.md carries the amendment. The only emails left in the system are
> Supabase Auth's built-in magic-link sign-in emails. Upside: no third-party email provider,
> no domain verification — Web Push is free and provider-less (browser push services + VAPID).

- **Subscriptions:** a `push_subscriptions` table (user_id, endpoint unique, `p256dh`/`auth`
  keys). The viewer registers a service worker and, on an explicit "Enable notifications"
  button (permission prompts require a user gesture), calls `pushManager.subscribe()` with the
  VAPID public key and upserts the subscription. Per-user, multi-device.
- **Trigger:** Postgres trigger (`pg_net`) on `games` INSERT (invites) and UPDATE of
  `current_seat`/`status` → HTTP POST `{game_id, type}` to Edge Function `notify`. The
  function URL + anon key live in an `app_config` table (RLS on, no policies → service-role
  only), so nothing project-specific is hardcoded in the committed migration.
- **`notify` Edge Function** (`supabase/functions/notify/`): service-role reads of
  `games`/`players`/`push_subscriptions` + the VAPID keypair from `app_config`; sends
  **"Your turn in <game>"** push (deep link `?game=<id>`) to every subscription of the seat
  now on turn, skipping when that user *is* the committer (`games.last_committed_by`); on
  `finished`, pushes final-scores to everyone; on game creation, pushes an invite notice to
  invitees who already have accounts+subscriptions. Dead subscriptions (HTTP 404/410 from the
  push service) are deleted. It never runs the engine — everything it needs is denormalized
  on `games`.
- **Accepted caveats (owner acknowledged):** iOS needs the viewer installed to the home screen
  as a PWA (iOS 16.4+) before push works; each device grants permission once; a player with no
  subscribed device gets no notification (game unaffected). First-time invitees can't receive
  an invite push (no account yet) — the host shares the game link out-of-band once.
- Known cosmetic wart, accepted for v1: a leech chain produces a couple of rapid turn-change
  pushes. Fine for a friend group; debounce later if it annoys.

## 7. Viewer integration

- **New files** (nothing existing is removed; `self-contained.ts` keeps working untouched):
  - `viewer/src/hosted.ts` — the Supabase-backed counterpart of `self-contained.ts`: auth →
    `claim_my_seats()` → load game → emit `"player"` + `"state"` → the `"move"` handler from
    §4 → realtime subscription. Also answers `"fetchState"` by re-emitting current state
    (launcher.ts:35-38 expects that).
  - `viewer/src/hosted/` — thin supabase client wrapper (reads `VUE_APP_SUPABASE_URL` /
    `VUE_APP_SUPABASE_ANON_KEY`), sign-in form, and a minimal bootstrap-vue lobby: list my
    games (name / status / whose turn / my seat), create-game form (§2).
- **Mode selection** in `main.ts`: `?game=<uuid>` or `?lobby=1` → hosted mode; anything else →
  the existing self-contained launcher. One static Vercel build, all existing demo/scenario
  URLs keep working; the only deploy change is two env vars on Vercel.
- **Events used, all pre-existing:** `"player"` (seat lock), `"state"` (full load — launcher
  already derives `replaceLog`/gamelog from it at `launcher.ts:30-34`, so the separate
  `"gamelog"` hook needs no new wiring), `"move"` (commit path), `"fetchState"` (re-serve).
- **Toolchain risk, known up front:** `@supabase/supabase-js` v2's `.d.ts` wants TS ≥ 4.x;
  the viewer pins TS 3.9. The production build already runs ts-loader `transpileOnly`
  (`vue.config.js`), so builds are unaffected; if `tsc` complains, add `skipLibCheck` to
  `viewer/tsconfig.json` (which also silences the pre-existing `@types/lodash` noise
  documented in PROGRESS.md "Done so far" #3). Fallback if that somehow isn't enough:
  isolate all supabase imports behind one wrapper module.
- **Tests** (per the standing testing agreement): unit tests for the hosted move handler with
  a mocked supabase client — commits on `newTurn` only, never commits partial lines, resyncs
  on seq conflict, applies realtime rows in order, full-resyncs on gaps. Same style as
  `self-contained.spec.ts`.

## 8. Snapshot cache — deliberately Phase 2, and how it stays honest

Skipped in v1: the engine replays entire recorded games in the test suite in well under a
second, so a few hundred moves at boot is a non-problem at this scale. If load ever feels
slow, the reserved `games.cached_state` / `cached_state_moves` columns activate as follows:
`commit_turn` gains an optional serialized-engine param (best-effort, written by the
committing client); boot becomes `Engine.fromData(cached_state)` + apply moves with
`seq > cached_state_moves`. **Honesty rules:** the cache is never authoritative — the move
log always wins; any `fromData` error, or `cached_state.moveHistory.length !==
cached_state_moves + 1`, or `cached_state_moves > move_count` → discard cache, full replay;
`?replay=1` forces full replay for debugging. The cache can be nulled at any time with zero
data loss.

## 9. Delivery plan (each step = own tested commit on this branch, per repo convention)

1. Supabase project + migration (`supabase/migrations/0001_multiplayer.sql`: tables, RPCs,
   RLS, realtime publication) + `docs` update.
2. `hosted.ts` boot path: auth, claim, load-and-replay, `"player"`/`"state"` emit, seat lock
   verified end-to-end (two browsers, one game).
3. Commit path + realtime fan-out + resync (+ the unit tests from §7).
4. Lobby (create game / invites / list games).
5. `notify` Edge Function + trigger (turn emails + invite emails + finished emails).
6. PROGRESS.md updates as each piece lands.

## 10. Open questions — RESOLVED (owner, 2026-07-01: "whatever you recommend is fine", plus
the push-over-email override)

- **Q1 — Notifications:** owner overrode the email plan → **Web Push only** (see §6 and the
  §J4 amendment). No email provider, no domain needed.
- **Q2 — Supabase project:** created fresh free-tier project **`gaia-lost-fleet`**
  (ref `mitawjpdxkheascdiffz`, region `eu-west-1`, same org/region as the owner's existing
  unrelated project, which was left untouched).
- **Q3 — Lobby scope:** minimal lobby (sign-in, list, create) confirmed for v1.
- **Q4 — Display names:** host types friends' names at invite time.
- **Q5 — Post-commit undo:** out of scope for v1.
- Design is **settled**; implementation proceeds in the §9 steps (with §6 swapped to push).

## 11. Deployment status (2026-07-01) & the two remaining owner actions

**Live right now:**
- Supabase project `gaia-lost-fleet` (ref `mitawjpdxkheascdiffz`, eu-west-1, free tier).
- Both migrations applied (schema, RPCs, RLS, realtime publication, notify trigger); security
  advisors clean apart from the intentionally-callable RPCs.
- `app_config` seeded with the VAPID keypair (subject `mailto:kim.pham.nguyen2@gmail.com`,
  `site_url` `https://gaia-lost-fleet.vercel.app`) and the notify URL/key. The private VAPID key
  exists ONLY there.
- Viewer hosted mode on branch `claude/backend-state-multiplayer-sbhf6c-bov526` — deliberately
  NOT merged to `master` (auto-deploys to production) pending owner review.

**Owner actions (~5 minutes total):**
1. **Deploy the `notify` Edge Function** (the session's MCP deploy call was approval-gated).
   Either from the repo root:
   `npx supabase login && npx supabase functions deploy notify --project-ref mitawjpdxkheascdiffz`
   or paste `supabase/functions/notify/index.ts` into Dashboard → Edge Functions → Deploy new
   function, named exactly `notify`, with "Verify JWT" **enabled**. Until deployed, games are
   fully playable — the trigger's async HTTP call 404s harmlessly; no push arrives, nothing else
   is affected. (`deno check` passes on the file; the seeded VAPID keys were verified to import
   and to match the viewer's committed public key.)
2. **Supabase Auth URL configuration** (Dashboard → Authentication → URL Configuration):
   set Site URL to the real production domain (assumed `https://gaia-lost-fleet.vercel.app` —
   verify in Vercel) and add redirect URLs `https://gaia-lost-fleet.vercel.app/*` and, for local
   dev, `http://localhost:8080/*`. Without this, magic-link emails redirect to the default
   `http://localhost:3000`.

**If the production domain differs** from `https://gaia-lost-fleet.vercel.app`, fix the deep-link
base once in SQL:
`update app_config set value = jsonb_set(value, '{site_url}', '"https://REAL-DOMAIN"') where key = 'vapid';`

**Key rotation note:** the anon key and VAPID public key are committed in
`viewer/src/hosted/config.ts` (public by design). Rotating VAPID keys = regenerate a P-256 JWK
pair, update `app_config['vapid']` and the viewer config, and every device must re-enable
notifications.
