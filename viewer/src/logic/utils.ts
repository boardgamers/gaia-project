import Engine, { Phase } from "@gaia-project/engine";

export function phaseBeforeSetupBuilding(data: Engine): boolean {
  return (
    data.phase === Phase.SetupInit ||
    data.phase === Phase.SetupBoard ||
    data.phase === Phase.SetupFaction ||
    data.phase === Phase.SetupAuction
  );
}

export function getMapHex(map, location: string) {
  const { q, r } = map.parse(location);
  return map.grid.get({ q, r });
}

export const deltaCounter: (initial: number) => (val: number) => number = (initial: number) => {
  let last = 0;

  return (val: number) => {
    const ret = val - last;
    last = val;
    return ret;
  };
};
