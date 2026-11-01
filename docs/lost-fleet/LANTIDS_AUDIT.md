# Lantids rules audit — 2026-11-01

## Rules used

- [Base rules, Appendix I: Lantids](https://www.feuerland-spiele.de/fileadmin/game/Gaia_Project/GAIA_PROJECT_EN_rules_Web.pdf):
  a shared mine functions normally except that it cannot be upgraded and does not contribute to
  planet-type or Gaia conditions. Mine placement still pays the mine cost and range, but no
  habitability cost. Shared mines retain their owner's income and building value.
- [Designer clarifications on shared mines](https://boardgamegeek.com/article/27462499):
  sector/structure presence and navigation count; planet-specific effects do not.
- [Lost Fleet rules](https://capstone-games.com/cdn/shop/files/GP_Exp_Rule_EN_V1_Web.pdf?v=6134275372584409409),
  pp. 8, 14–15: adjusted PI, Deep Space sector rewards, bonus mine actions.
- [Protoplanet/asteroid clarification](https://boardgamegeek.com/thread/3389868/lantids-plus-protoplanet):
  a shared protoplanet grants no 6 VP and a shared asteroid does not count for asteroid scoring.
  This thread relays the designer ruling; the existing implementation already follows it for
  ordinary builds. The audit applies that same rule to bonus mine actions.

## Findings and coverage

| Area                                                         | Outcome                                                                                                                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Deep Space final goal, booster, immediate/pass Advanced Tech | Fixed: include shared mines; count each physical sector once. Gaiaformers, stations and off-map artifacts do not add sectors.                                                                           |
| Bonus mine from Range/Terraform federation or Terraform tech | Fixed: sharing Gaia needs no habitability QIC; sharing an asteroid needs no Gaiaformer; sharing a protoplanet gives no 6 VP. Normal range rules still apply.                                            |
| Solo/2-player PI on a shared Terra planet                    | Fixed: one 2-knowledge reward, not two. Shared mines already receive the base PI reward and do not also qualify for a planet-type reward.                                                               |
| Charts and scoring help                                      | Fixed: include shared deep-sector mines, recognize own first colonization, track Lost Planet ownership, and isolate each chart's history state. Completed Gaia projects count when their mine is built. |
| Ordinary shared-mine costs and benefits                      | Verified: mine cost, range, mine income/scoring, PI knowledge, structure/federation count, own power value and leech. No Gaia/asteroid/planet-type scoring or protoplanet reward.                       |
| Build restrictions                                           | Verified: no upgrade of a shared mine, no sharing an unfinished Gaia project, normal mine supply limit. Starting placement remains restricted to vacant home planets.                                   |
| Lost Fleet adjustments                                       | Existing tests cover +1 token income, own Terra PI bonus in solo/2p, extra PI charge in 3p, and unchanged 4p/base behavior.                                                                             |
| Round sector/planet-type scoring                             | Existing tests and the protoplanet regression distinguish sector presence from planet-type colonization.                                                                                                |

The old fuzzer exclusion of shared Deep Space mines was based on the implementation rather than
the rules. Both the production count and independent map-scan oracle now include them.

The existing house ruling for the base game's **ordinary sector** goal remains separate from
Deep Space scoring (RULES_CLARIFICATIONS §G4c). This audit does not change that ruling.

Regression files: `engine/src/faction-boards/lantids-rules.spec.ts`, existing
`lantids.spec.ts` / `tiles/scoring.spec.ts`, and `viewer/src/logic/charts/lantids-charts.spec.ts`.
The existing all-families chart fixture now correctly credits Lantids with their starting Terra
planet type rather than zero planet types.

## Reported game

In Wicked-banana-8201 at move 201, Lantids have a shared mine on DS14_0: their Deep Space count
must be **1**, previously **0**. The mine's ordinary 3-VP new-sector reward is already present;
the earlier removal of its incorrect 6-VP protoplanet bonus remains valid. Deep Space progress is
computed from the board, so this correction does not require rewriting that game's moves.
