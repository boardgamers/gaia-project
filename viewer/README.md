# gaia-viewer

A Vue.js / SVG UI for Gaia Project

## Demo

Check out [boardgamers.space](https://www.boardgamers.space)!

## Build and Run

In the viewer's folder:

```bash
pnpm install
npm run serve
```

And open localhost:8080 in the browser.

You can change [src/self-contained.ts](src/self-contained.ts) to change the initial setup: number of players, factions...

## Offline pass-and-play

The hosted viewer can run multiple hot-seat games entirely on a single phone:

1. While online, open the app and choose **Offline games** (or open `?offline=1`).
2. Wait until the green banner says **App available offline**. On a phone, add Fight Club to the
   home screen for the most reliable way to launch it later.
3. Choose **New game**. Offline creation uses the same Lost Fleet setup preview, sector rotation,
   player count, faction-selection, ban-phase, and official center-sector controls as online creation,
   without lobby seats or invitations. It defaults to **Silent Auction** with the **Ban phase** enabled.
4. Create as many local games as needed and choose one from the offline lobby before passing the
   phone around. In airplane mode, opening the installed app falls back to this local lobby.

The first visit must be online so the browser can download and cache the web app. After that, the
app shell and game assets are cached, while each game's latest state is saved synchronously in this
browser profile after every command. A refresh, accidental close, or phone restart resumes the same
game, including a turn that was only partly entered. The original single-game save from v5.31.0 is
automatically imported into the offline lobby. Browser/site-data deletion also deletes the local
library, so use **Export backup** when a separate recoverable copy matters. Hosted multiplayer games
remain server-backed and are not copied into offline mode.

## Include in other projects

For now there are three ways to include the viewer:

- By importing individual components: If you want to integrate into an existing Vue APP, for example
- Through `index.ts`, the default export is the `launch` function: The viewer will create its own Vue App on the given selector
- Through `unpkg.com/@gaia-project/viewer`, which will set `window.gaiaViewer` or `global.gaiaViewer`. Here is an example:

```html
<script src="//unpkg.com/vue@^2/dist/vue.min.js"></script>
<script src="//unpkg.com/bootstrap-vue@^2/dist/bootstrap-vue.min.js"></script>

<script source="//unpkg.com/@gaia-project/viewer">
<link type="text/css" rel="stylesheet" href="//unpkg.com/@gaia-project/viewer/dist/package/viewer.css">
```

If you want something else, contact us.

### launch function

The default export, and `window.gaiaViewer.launch` / `global.gaiaViewer.launch` when included via a `script` tag, is a function taking a css selector as an argument. When executed, it instantiates a Game on the aformentioned element, and returns an `EventEmitter` that can be communicated with.

The EventEmitter has this interface:

```js
// Give the new game data to the viewer
emitter.emit("state", gameData);
// Update preferences
emitter.emit("preferences", { noFactionFill: true });
// Set player - choose either. If no player is set, then everyone can play
// in the same window
emitter.emit("player", { auth: "xxx" });
emitter.emit("player", { index: 0 });
// Listen for move actions
emitter.on("move", (move) => {
  /* send move to backend and give back result */
});
// Signals that a player's name was clicked
emitter.on("player:clicked", ({ name, index, auth }) => {
  /* ... */
});
```

If you want a self-contained game which plays in the browser with no interaction with your code, you can do:

```js
// via <script>
window.gaiaViewer.launchSelfContained("#my-selector");

// via import
import { launchSelfContained } from "@gaia-project/viewer";
```
