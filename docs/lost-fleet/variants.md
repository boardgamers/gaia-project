# Lost Fleet variants

## Keep 4 QIC → tech tile (2 players)

An optional house rule, disabled by default. In a two-player Lost Fleet game, it restores the base
game's shared **4 QIC → tech tile** action beside the seven power actions. It follows the usual
technology selection, research advancement and once-per-round rules. No exploration is required.
The other two base-game QIC actions remain unavailable, and Rebellion stays out of the game.

The setup option is `lostFleet2pQicTech: true`. It has no effect without Lost Fleet or with more
than two players. Games created without this option retain the official rules.

The BGS setup checkbox is defined in `scripts/game-options/lost-fleet-2p-qic-tech.json`. When
deploying, merge it into the current Gaia Project v3 gameinfo document's `options` by `name`,
after publishing the engine and viewer that support it. Preserve the rest of the document.
