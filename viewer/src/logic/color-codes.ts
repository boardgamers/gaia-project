export class ColorCoded {
  color: string;
  shortcut: string;

  constructor(shortcut: string, color: string) {
    this.color = color;
    this.shortcut = shortcut;
  }

  public add<T>(t: Omit<T, "color" | "shortcut">, shortcutPrefix = ""): T {
    const ret = t as any;
    ret.shortcut = shortcutPrefix + this.shortcut;
    ret.color = this.color;
    return ret;
  }
}

export const colorCodes = {
  terraformingStep: new ColorCoded("s", "--dig"),
  planetType: new ColorCoded("t", "--dig"),
  sector: new ColorCoded("e", "--current-round"),
  satellite: new ColorCoded("a", "--terra"),
  federation: new ColorCoded("f", "--federation"),
  range: new ColorCoded("r", "--rt-nav"),
  gaia: new ColorCoded("g", "--gaia"),
  researchStep: new ColorCoded("r", "--rt-sci"),
};
