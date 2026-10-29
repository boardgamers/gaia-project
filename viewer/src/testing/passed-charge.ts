import Engine from "@gaia-project/engine";

export function passedChargeGame(): Engine {
  return new Engine([
    "init 4 concurrent-charge-test",
    "p1 faction terrans",
    "p2 faction nevlas",
    "p3 faction firaks",
    "p4 faction hadsch-hallas",
    "p1 build m 8A2",
    "p2 build m 8B1",
    "p3 build m 8B3",
    "p4 build m 7B5",
    "p4 build m 1A2",
    "p3 build m 7A4",
    "p2 build m 5A2",
    "p1 build m 4A4",
    "p4 booster booster2",
    "p3 booster booster4",
    "p2 booster booster5",
    "p1 booster booster6",
    "hadsch-hallas income 2t",
    "terrans up nav.",
    "nevlas up nav.",
    "firaks pass booster8",
    "hadsch-hallas up nav.",
    "terrans pass booster9",
    "nevlas build ts 8B1.",
  ]);
}
