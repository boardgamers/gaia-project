import { Federation } from "@gaia-project/engine";

export const federationData: { [key in Federation]: { color: string; shortcut: string } } = {
  [Federation.Fed1]: { color: "--res-vp", shortcut: "v" },
  [Federation.Fed2]: { color: "--res-qic", shortcut: "q" },
  [Federation.Fed3]: { color: "--res-power", shortcut: "t" },
  [Federation.Fed4]: { color: "--res-ore", shortcut: "o" },
  [Federation.Fed5]: { color: "--res-credit", shortcut: "c" },
  [Federation.Fed6]: { color: "--res-knowledge", shortcut: "k" },
  [Federation.Gleens]: { color: "--desert", shortcut: null }, // is gained passively when buidling the PI
};
