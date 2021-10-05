import { ExtractLog } from "./simple-charts";
import { Building, Command, Faction, Player, PowerArea } from "@gaia-project/engine";
import { ResourceSource } from "./resources";
import { resourceCounter } from "./resource-counter";

const powerLeverage = "powerLeverage";

export const powerLeverageSource: ResourceSource = {
  type: powerLeverage,
  label: "Power Leverage",
  description: "Additional spend power due to Brainstone or Nevlas tokens with Planetary Institute",
  weight: 0,
  color: "--tech-tile",
};

function taklonsPowerLeverage(): ExtractLog<ResourceSource> {
  return resourceCounter((want, a, data, callback) => {
    if (a.log.player != want.player) {
      return 0;
    }
    const old = data.brainstone;
    callback();
    if (old == PowerArea.Area3 && data.brainstone == PowerArea.Area1) {
      return 2;
    }
    return 0;
  });
}

function nevlasPowerLeverage(): ExtractLog<ResourceSource> {
  let pi = false;
  return resourceCounter((want, a, data, callback) => {
    if (a.log.player != want.player) {
      return 0;
    }
    if (a.cmd?.command == Command.Build && a.cmd.args[0] == Building.PlanetaryInstitute) {
      pi = true;
    }

    const area1 = data.power.area1;
    const area3 = data.power.area3;

    callback();

    if (pi && data.power.area3 < area3 && data.power.area1 > area1) {
      return Math.floor((area3 - data.power.area3) / 2);
    }

    return 0;
  });
}

export const extractPowerLeverage = ExtractLog.wrapper<ResourceSource>((want, source) => {
  if (source.type == powerLeverage) {
    switch (want.faction) {
      case Faction.Taklons:
        return taklonsPowerLeverage();
      case Faction.Nevlas:
        return nevlasPowerLeverage();
    }
  }
  return ExtractLog.new(() => () => 0);
});

