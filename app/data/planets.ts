import { Planet } from "@gaia-project/engine";

interface PlanetInfo {
  radius: number, 
  color: number, 
  borderColor: number
};

const arrayData : Array<[Planet, PlanetInfo]> = [
  [Planet.Terra, {radius: 0.7, color: 0xa25b15, borderColor: 0x874d12}],
  [Planet.Desert, {radius: 0.7, color: 0xdbc442, borderColor: 0xc1a925}],
  [Planet.Swamp, {radius: 0.7, color: 0x99ccff, borderColor: 0x3399ff}],
  [Planet.Oxide, {radius: 0.7, color: 0xff9900, borderColor: 0xff0000}],
  [Planet.Volcanic, {radius: 0.7, color: 0xff3300, borderColor: 0xff8566}],
  [Planet.Titanium, {radius: 0.7, color: 0x3d3d5c, borderColor: 0xd1d1e0}],
  [Planet.Ice, {radius: 0.7, color: 0xccffff, borderColor: 0x33ffff}],
  [Planet.Gaia, {radius: 0.7, color: 0x009933, borderColor: 0x004d1a}],
  [Planet.Transdim, {radius: 0.4, color: 0xa64dff, borderColor: 0xa64dff}]
];

const data: {[planet in Planet]?: PlanetInfo} = {
};

for (let [planet, info] of arrayData) {
  data[planet] = info;
}

export default data;