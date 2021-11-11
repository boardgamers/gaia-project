import Engine, { Phase } from "@gaia-project/engine";

export function phaseBeforeSetupBuilding(data: Engine): boolean {
  return (
    data.phase === Phase.SetupInit ||
    data.phase === Phase.SetupBoard ||
    data.phase === Phase.SetupFaction ||
    data.phase === Phase.SetupAuction
  );
}

export const deltaCounter: (initial: number) => (val: number) => number = (initial: number) => {
  let last = initial;

  return (val: number) => {
    const ret = val - last;
    last = val;
    return ret;
  };
};

export function radiusTranslate(radius: number, index: number, positions: number) {
  const deg = 360 / positions;
  const x = radius * Math.sin(((-180 + index * deg) * Math.PI) / 180);
  const y = radius * Math.cos(((-180 + index * deg) * Math.PI) / 180);
  return `translate(${x}, ${y})`;
}
