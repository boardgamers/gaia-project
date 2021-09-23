import { Command, Federation, federations } from "@gaia-project/engine";
import { federationData } from "../../data/federations";
import { ChartSource } from "./charts";
import { SimpleSourceFactory, statelessExtractLog } from "./simple-charts";

export const federationsSourceFactory: SimpleSourceFactory<ChartSource<Federation>> = {
  name: "Federations",
  showWeightedTotal: false,
  playerSummaryLineChartTitle: "Federations of all players",
  extractLog: statelessExtractLog((e) => {
    const type = e.source.type;
    if (e.cmd.command == Command.FormFederation) {
      return (e.cmd.args[1] as Federation) == type ? 1 : 0;
    }
    if (e.allCommands[0] === e.cmd && !e.allCommands.find((c) => c.command == Command.FormFederation)) {
      //only take the federation from changes once, i.e. when seeing the first command
      const c = e.log.changes?.[Command.FormFederation];
      if (c != null) {
        const want = Object.entries(c)
          .map(([r, a]) => (a > 1 ? a : "") + r)
          .join(",");
        if (Object.entries(federations).find(([, res]) => res == want)[0] == type) {
          return 1;
        }
      }
    }
    return 0;
  }),
  sources: Federation.values()
    .map((f) => ({
      type: f,
      label: federations[f],
      color: federationData[f].color,
      weight: 1,
    }))
    .concat({
      type: Federation.Gleens,
      label: "Gleens",
      color: "--desert",
      weight: 1,
    }),
};
