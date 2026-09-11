# Gaia Project old UI

The original map, text-based research board and player-card arrangement run on
Vue 2.7 and Vite. The game controller, engine, action controls, chat and journal
are shared with `viewer`; this package has its own renderer and build.

Lost Fleet adds loose map tiles and spaceships, the scoring extension, ship actions,
ship technology/federation tiles, artifacts, and updated faction boards and abilities.

From the repository root:

```sh
pnpm install
pnpm --dir old-ui serve    # http://localhost:5193/
pnpm --dir old-ui test
pnpm --dir old-ui package
```

Use `?lostFleet=1` for expansion setup or `?scenario=lost-fleet-overview` for a
playable test position. The local test tools also load the other expansion positions.

For BGS, publish `dist/package/old-ui.umd.js` and `old-ui.css` as the alternate
viewer. Its API is `gaiaViewer.launch`, with the same events as the normal viewer.
Vue and BootstrapVue remain supplied by the host; game assets and sounds are bundled.
