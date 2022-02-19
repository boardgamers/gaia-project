import { Building, Command, PowerArea, Resource, Reward } from "@gaia-project/engine";
import { sum } from "lodash";
import { resourceCounter } from "./resource-counter";
import { ExtractLog } from "./simple-charts";

export const taklonsPowerLeverage: (factor: number) => ExtractLog<any> = (factor: number) =>
  resourceCounter((want, a, data, simulateResources) => {
    if (a.log.player != want.player) {
      return 0;
    }
    const old = data.brainstone;
    simulateResources();
    if (old == PowerArea.Area3 && data.brainstone == PowerArea.Area1) {
      return factor;
    }
    return 0;
  });

export const nevlasPowerLeverage: ExtractLog<any> = ExtractLog.wrapper(() => {
  let pi = false;

  return resourceCounter((want, a, data, simulateResources) => {
    if (a.log.player != want.player) {
      return 0;
    }
    if (a.cmd?.command == Command.Build && a.cmd.args[0] == Building.PlanetaryInstitute) {
      pi = true;
    }

    const changes = simulateResources();

    const leverage = (r: Reward) => (r.type == Resource.ChargePower && r.count < 0 ? Math.floor(-r.count / 2) : 0);

    return pi
      ? sum(
          Object.values(changes)
            .flat()
            .map((r) => leverage(r))
        )
      : 0;
  });
});
