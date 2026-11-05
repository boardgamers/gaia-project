# Lost Fleet insignia

`SpaceshipEmblem.vue` contains hand-drawn SVG interpretations, **not original publisher vector assets**.

Reference: official **Gaia Project: The Lost Fleet rulebook v1.0, page 7**, the four individually named ship boards. The checked-in copy is `docs/lost-fleet/rulebook-v1.0.pdf`. Also checked the [Capstone Games publisher download](https://capstone-games.com/cdn/shop/files/GP_Exp_Rule_EN_V1_Web.pdf?v=6134275372584409409). Both embed the boards at only about 250×77 pixels; enlargement does not recover the fine detail. Page 2 also shows the purple insignia on a ship tile. The owner's tabletop photograph supplies the same high-level shapes and colors.

- **Twilight / Nautilaks:** white segmented nautilus spiral, purple disc. Supported motif; simplified spiral chambers, not an exact tracing.
- **Eclipse / Eridani Empire:** dark planet/orbital ellipse on gold. Supported motif; simplified orbit intersection.
- **T F Mars / Gaia Federation:** two dark, rising diagonal leaf/slash shapes on pale silver. Supported motif; simplified silhouettes.
- **Rebellion / Vo'Kron:** the owner's subsequent close-up resolves the long tapered U/claw, inner crown and lower angular divisions. The SVG interprets those dark shapes on a pale silver/ivory medallion, with light gaps between the divisions. It replaces the provisional R; the ship-board header retains the ship's brown identity color.

Primary map and board headers use the same component. Headers keep their full names independently of the symbol (including T F MARS). The primary map no longer fills the underlying ship hex with an identity color. The alternate map keeps E/T/R/M on colored hexes and its board has its own unchanged template; no CSS hiding or shared-template mode is needed. Generic spacecraft controls and action-effect symbols are intentionally untouched.

The map insignia inherits the existing upright counter-rotation and now fills most of its hex (radius 0.8, up from 0.33 in the first proposal). Explorer tokens retain their original size and positions; they are painted after the emblem and intentionally overlap it. Tooltips and accessible names retain the ship and its faction identity.
