import { Building, Command, PowerArea } from "@gaia-project/engine";
import { resourceCounter } from "./resource-counter";
import { ResourceSource } from "./resources";
import { ExtractLog } from "./simple-charts";

export const powerLeverage = "powerLeverage";

export const powerLeverageSource: ResourceSource = {
  type: powerLeverage,
  label: "Power Leverage",
  description: "Additional spent power due to Brainstone (2 per use) or Nevlas tokens with Planetary Institute",
  weight: 0,
  color: "--tech-tile",
};

export const taklonsPowerLeverage = resourceCounter((want, a, data, simulateResources) => {
  if (a.log.player != want.player) {
    return 0;
  }
  const old = data.brainstone;
  simulateResources();
  if (old == PowerArea.Area3 && data.brainstone == PowerArea.Area1) {
    return 2;
  }
  return 0;
});

export const nevlasPowerLeverage = (): ExtractLog<ResourceSource> => {
  let pi = false;
  return resourceCounter((want, a, data, simulateResources) => {
    if (a.log.player != want.player) {
      return 0;
    }
    if (a.cmd?.command == Command.Build && a.cmd.args[0] == Building.PlanetaryInstitute) {
      pi = true;
    }

    const area1 = data.power.area1;
    const area3 = data.power.area3;

    simulateResources();

    if (pi && data.power.area3 < area3 && data.power.area1 > area1) {
      return Math.floor((area3 - data.power.area3) / 2);
    }

    return 0;
  });
};
