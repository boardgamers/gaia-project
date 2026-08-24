import { Booster } from "../enums";
import Event from "../events";

const boosterSpec: { [key in Booster]: string[] } = {
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
  [Booster.LostFleetFormer]: ["+o", "gf | 3vp"],
  [Booster.LostFleetPlanet]: ["+o", "pt | vp"],
  [Booster.LostFleetDeep]: ["+3c", "ds | 2vp"],
  [Booster.LostFleetInstant]: ["+2pw", "=> instant-gaiaforming"],
};

export function boosterEvents(booster: Booster): Event[] {
  return Event.parse(boosterSpec[booster], booster);
}
