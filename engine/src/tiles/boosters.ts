import { Booster } from "../enums";
import Event from "../events";

export const boosters = Object.fromEntries(
  Object.entries({
    [Booster.Booster1]: ["+k", "+o"],
    [Booster.Booster2]: ["+o", "+2t"],
    [Booster.Booster3]: ["+q", "+2c"],
    [Booster.Booster4]: ["+2c", "=> step"],
    [Booster.Booster5]: ["+2pw", "=> range+3"],
    [Booster.Booster6]: ["+o", "m | vp"],
    [Booster.Booster7]: ["+o", "ts | 2vp"],
    [Booster.Booster8]: ["+k", "lab | 3vp"],
    [Booster.Booster9]: ["+4pw", "PA | 4vp"],
    [Booster.Booster10]: ["+4c", "g | vp"],
  }).map(([b, specs]) => [b as Booster, specs.map((s) => new Event(s, b as Booster))])
) as { [key in Booster]: Event[] };
