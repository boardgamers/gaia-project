// Original geometric achievement scenes, MIT. No publisher raster/vector assets are embedded.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const OUTPUT = path.join(ROOT, "artifacts/achievement-scenes");
export const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const ink = "#10283d",
  paper = "#ecf5f1",
  gold = "#ffce72",
  teal = "#65d6c0";
const circle = (x, y, r, fill, extra = "") => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
const line = (x, y, X, Y, color = teal, w = 3) =>
  `<path d="M${x} ${y}L${X} ${Y}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
const shape = (d, fill = paper, extra = "") =>
  `<path d="${d}" fill="${fill}" stroke="${ink}" stroke-width="2" stroke-linejoin="round" ${extra}/>`;
const group = (x, y, s, body, extra = "") => `<g transform="translate(${x} ${y}) scale(${s})" ${extra}>${body}</g>`;
function building(type, x, y, s = 1, color = paper) {
  const paths = {
    mine: "M-12 10V-4L0 -14L12 -4V10L0 17Z M-12 -4L0 3L12 -4 M0 3V17",
    trade: "M-12 15V-5L-4 -5V-18H8V-5H14V15Z",
    lab: "M-16 12C-16 -22 16 -22 16 12Q0 22 -16 12Z",
    institute: "M-22 13L0 -23L22 13L0 24Z M0 -23V24",
    academy: "M-17 16V-13H-5V-23H6V-13H17V16Z M-17 0H17 M0 -23V16",
  };
  return group(x, y, s, shape(paths[type], color), `data-building="${type}"`);
}
const planets = [
  ["terra", "#5599e4"],
  ["desert", "#e9c464"],
  ["swamp", "#aa8058"],
  ["oxide", "#e97565"],
  ["volcanic", "#777e8d"],
  ["titanium", "#d4d8dd"],
  ["ice", "#9edfe9"],
  ["gaia", "#8fd080"],
  ["lost", "#b998e2"],
  ["asteroid", "#bca7a1"],
  ["protoplanet", "#e994c5"],
];
function world(index, x, y, r = 16, colony = true) {
  const [name, color] = planets[index];
  let body =
    index === 9
      ? shape(`M${-r} 0L${-r * 0.5} ${-r}L${r * 0.7} ${-r * 0.8}L${r} ${r * 0.4}L0 ${r}Z`, color)
      : circle(0, 0, r, color, `stroke="${paper}" stroke-width="1.5"`);
  // Surface bands remain distinct in grayscale; Gaia sprouts, Lost has an orbit.
  if (index === 7) body += shape("M0 9V-6Q-12 -12 -8 -1L0 4Q10 -12 12 -7L0 4", ink);
  else if (index === 8)
    body += `<ellipse rx="${r + 5}" ry="6" fill="none" stroke="${paper}" stroke-width="2" transform="rotate(-30)"/>`;
  else if (index === 10) body += circle(0, 0, r * 0.5, ink) + circle(0, 0, r * 0.2, gold);
  else body += line(-r * 0.6, r * 0.2, r * 0.5, -r * 0.45, ink, 2);
  if (colony) body += building("mine", 0, -2, r / 30, paper);
  return group(x, y, 1, body, `data-planet="${name}" data-colony="${colony}"`);
}
function victory() {
  return (
    `<g data-victory="true" fill="none" stroke="${gold}" stroke-width="4" stroke-linecap="round"><path d="M52 174Q27 118 58 73M204 174Q229 118 198 73"/>${[0, 1, 2].map((i) => `<path d="M${45 - i * 2} ${138 - i * 20}l-8 -12M${211 + i * 2} ${138 - i * 20}l8 -12"/>`).join("")}</g>` +
    shape("M113 53L110 39L121 45L128 32L135 45L146 39L143 53Z", gold)
  );
}
function colony(x = 128, y = 147, s = 1) {
  return group(
    x,
    y,
    s,
    circle(0, 14, 42, "#3478a1") +
      `<ellipse cy="25" rx="40" ry="12" fill="${ink}" opacity=".35"/>` +
      building("institute", 0, -4, 1.15) +
      building("mine", -27, 17, 0.62, teal) +
      building("trade", 27, 10, 0.65, teal)
  );
}
function ship(x, y, kind) {
  const colors = ["#b895c7", "#ddca76", "#ccd7dd", "#b78d70"];
  const signs = [
    `<path d="M-6 4C-14 -10 10 -14 10 0C10 10 -3 10 -3 0C-3 -4 3 -4 3 0" fill="none" stroke="${ink}" stroke-width="3"/>`,
    `<ellipse rx="12" ry="4" transform="rotate(-30)" fill="none" stroke="${ink}" stroke-width="2"/>` +
      circle(0, 0, 6, ink),
    shape("M-9 8L-3 -9L2 -4Z M0 9L10 -8L11 1Z", ink),
    shape("M-10 -9L-5 7L0 11L5 7L10 -9L5 1L0 -3L-5 1Z", ink),
  ];
  return group(
    x,
    y,
    1,
    shape("M-25 8L-20 -7L0 -21L20 -7L25 8L0 19Z", colors[kind]) + signs[kind],
    `data-ship="${["twilight", "eclipse", "tf-mars", "rebellion"][kind]}"`
  );
}
function factionHead(faction) {
  let body;
  if (faction === "ivits")
    body =
      shape("M-12 -19H12L16 7L8 23H-8L-16 7Z", "#e97854") +
      `<ellipse cx="-17" cy="-5" rx="7" ry="17" fill="#9db9da"/><ellipse cx="17" cy="-5" rx="7" ry="17" fill="#9db9da"/>` +
      line(0, -15, 0, 14, ink, 3);
  if (faction === "lantids")
    body =
      shape("M-23 20L-16 -12L-5 -22L0 -30L5 -22L16 -12L23 20L10 10L0 24L-10 10Z", "#99c9df") +
      shape("M-12 -1L-5 3M12 -1L5 3", "none") +
      line(-5, 14, 5, 14, gold, 3);
  if (faction === "bescods")
    body =
      shape("M-18 -19H13L20 -8V18H-17Z", "#bcc8c8") +
      shape("M-21 -8H21V1H-21Z", gold) +
      circle(-7, -4, 3, ink) +
      circle(8, -4, 3, ink) +
      shape("M-9 8H9V20H-9Z", ink) +
      line(0, 10, 0, 17, teal, 3);
  return group(128, 65, 1, body, `data-faction="${faction}"`);
}
const scene = (id, title, semantics, body) => ({ id, title, semantics, body });
export function scenes() {
  const out = [];
  out.push(
    scene(
      "win-mode-base",
      "Base Game Victory",
      { mode: "base", victory: true },
      victory() + [0, 1, 2, 3, 4, 5, 6].map((p, i) => world(p, 68 + i * 20, 88, 8, false)).join("") + colony()
    )
  );
  out.push(
    scene(
      "win-mode-lost-fleet",
      "Lost Fleet Victory",
      { mode: "lost-fleet", victory: true, ships: 4 },
      victory() + ship(82, 93, 0) + ship(174, 93, 1) + ship(77, 166, 2) + ship(179, 166, 3) + colony(128, 139, 0.72)
    )
  );
  const difficulties = ["automalein", "automa", "automaechtig", "ultoma", "alptrauma"];
  difficulties.forEach((d, i) => {
    // Five different tactical layouts; no stack of cumulative rank stars.
    const layouts = [
      [[128, 106]],
      [
        [98, 92],
        [157, 92],
        [128, 120],
      ],
      [
        [91, 83],
        [128, 83],
        [165, 83],
        [106, 116],
        [150, 116],
      ],
      [
        [85, 94],
        [128, 76],
        [171, 94],
        [87, 135],
        [169, 135],
      ],
      [
        [85, 84],
        [128, 70],
        [171, 84],
        [77, 120],
        [179, 120],
        [100, 144],
        [156, 144],
      ],
    ];
    const nodes = layouts[i];
    let body = shape("M70 66H186V156H70Z", "#234157", `data-automa-card="${d}"`);
    body += nodes
      .slice(1)
      .map(([x, y], j) => line(nodes[j][0], nodes[j][1], x, y, "#c38eb7", 3))
      .join("");
    body += nodes
      .map(([x, y], j) =>
        group(x, y, 0.65, j % 2 ? shape("M-12 -12H12V12H-12Z", "#dca4ca") : shape("M0 -15L14 0L0 15L-14 0Z", "#dca4ca"))
      )
      .join("");
    body += colony(128, 166, 0.69) + victory();
    out.push(scene(`win-automa-${d}`, `Defeat ${d}`, { difficulty: d, exact: true, victory: true }, body));
  });
  let all = "";
  [
    ["mine", 8, 169, 0.58],
    ["trade", 4, 135, 0.78],
    ["lab", 3, 96, 0.82],
    ["institute", 1, 52, 0.78],
    ["academy", 2, 52, 0.74],
  ].forEach(([type, n, y, s]) => {
    for (let i = 0; i < n; i++) {
      const x =
        type === "institute"
          ? 128
          : type === "academy"
            ? 81 + i * 94
            : 128 + (i - (n - 1) / 2) * (type === "mine" ? 20 : 34);
      all += building(type, x, y, s, type === "mine" ? teal : paper);
    }
  });
  out.push(
    scene(
      "build-all-standard",
      "Full Deployment",
      { buildings: { mine: 8, trade: 4, lab: 3, institute: 1, academy: 2 } },
      all + `<path d="M62 195H194" stroke="${gold}" stroke-width="4"/>`
    )
  );
  let formations = "";
  [
    [85, 83],
    [170, 83],
    [85, 164],
    [170, 164],
  ].forEach(([x, y]) => {
    formations += group(
      x,
      y,
      1,
      `<g data-formation="true">${line(-15, -12, 16, 5)}${line(16, 5, -12, 23)}${line(-15, -12, 22, -18)}${circle(22, -18, 4, gold)}${building("institute", -15, -12, 0.7)}${building("academy", 16, 5, 0.65)}${building("mine", -12, 23, 0.65)}</g>`
    );
  });
  out.push(scene("federation-form-4", "Four Formations", { formations: 4 }, formations));
  for (const fleet of [false, true]) {
    const n = fleet ? 11 : 9;
    const positions = fleet
      ? [
          [92, 55],
          [128, 51],
          [164, 55],
          [71, 95],
          [109, 96],
          [147, 96],
          [185, 95],
          [77, 142],
          [128, 140],
          [179, 142],
          [128, 185],
        ]
      : [
          [84, 66],
          [128, 61],
          [172, 66],
          [77, 119],
          [128, 115],
          [179, 119],
          [84, 171],
          [128, 177],
          [172, 171],
        ];
    out.push(
      scene(
        `explore-all-types-${fleet ? "lost-fleet" : "base"}`,
        `Every World: ${fleet ? "Lost Fleet" : "Base"}`,
        { planetTypes: planets.slice(0, n).map((p) => p[0]), mainOwned: true },
        positions.map(([x, y], i) => world(i, x, y, 17)).join("")
      )
    );
  }
  let growth = factionHead("ivits");
  const points = [
    [69, 159],
    [105, 128],
    [148, 158],
    [187, 125],
  ];
  growth += `<path d="M69 159L105 128L148 158L187 125" fill="none" stroke="${teal}" stroke-width="5" data-growing-federation="true"/>`;
  points.forEach(([x, y], i) => {
    growth +=
      circle(x, y, 21, "#254b5b") +
      building(i === 0 ? "institute" : "mine", x, y, 0.8) +
      circle(x, y + 28, 7, gold) +
      `<text x="${x}" y="${y + 31}" text-anchor="middle" fill="${ink}" font-size="10" font-family="sans-serif">${i + 1}</text>`;
  });
  out.push(
    scene(
      "faction-ivits-growing-federation",
      "Ivits: Growing Federation",
      { faction: "ivits", connectedFederations: 1, growthMilestones: 4 },
      growth
    )
  );
  let shared = factionHead("lantids");
  [
    [78, 124],
    [128, 124],
    [178, 124],
    [78, 176],
    [128, 176],
    [178, 176],
  ].forEach(([x, y], i) => {
    shared +=
      world(i, x, y, 19, false) + building("trade", x - 7, y, 0.58, gold) + building("mine", x + 9, y + 7, 0.53, teal);
  });
  out.push(
    scene(
      "faction-lantids-shared-civilization",
      "Lantids: Shared Civilization",
      { faction: "lantids", sharedMines: 6 },
      shared
    )
  );
  let research = factionHead("bescods") + line(62, 128, 194, 128, gold, 3);
  for (let i = 0; i < 6; i++) {
    const x = 68 + i * 24;
    research += `<g data-research-track="${i}" data-level="3">` + line(x, 188, x, 105, "#537185", 5);
    for (let j = 0; j < 4; j++) research += line(x - 6, 188 - j * 20, x + 6, 188 - j * 20, paper, 2);
    research += shape(`M${x} 119L${x + 8} 128L${x} 137L${x - 8} 128Z`, teal) + `</g>`;
  }
  out.push(
    scene(
      "faction-bescods-balanced-research",
      "Bescods: Balanced Research",
      { faction: "bescods", tracks: 6, minimumLevel: 3 },
      research
    )
  );
  return out;
}
export function svgFor(item) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 256 256"><title>${item.title}</title>${circle(128, 128, 124, ink)}${circle(128, 128, 117, "none", `stroke="#5e8494" stroke-width="2"`)}${item.body}</svg>`;
}
export async function generateScenes(output = OUTPUT) {
  await mkdir(output, { recursive: true });
  const assets = [];
  const layers = [];
  for (const [i, item] of scenes().entries()) {
    const key = `achievement-${item.id}`,
      svg = Buffer.from(svgFor(item));
    const png = await sharp(svg).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(path.join(output, `${key}.svg`), svg);
    await writeFile(path.join(output, `${key}.png`), png);
    assets.push({
      id: item.id,
      key,
      semantics: item.semantics,
      source: { path: `${key}.svg`, sha256: sha256(svg) },
      output: { path: `${key}.png`, sha256: sha256(png), width: 512, height: 512 },
    });
    const x = (i % 2) * 650,
      y = Math.floor(i / 2) * 210;
    layers.push({ input: await sharp(png).resize(160).toBuffer(), left: x + 12, top: y + 32 });
    for (const [j, size] of [64, 48, 32].entries())
      for (const [k, bg] of ["#f5f3e9", "#10202d"].entries()) {
        const icon = await sharp(png).resize(size).flatten({ background: bg }).toBuffer();
        layers.push({
          input: await sharp({ create: { width: 80, height: 80, channels: 3, background: bg } })
            .composite([{ input: icon, left: Math.floor((80 - size) / 2), top: Math.floor((80 - size) / 2) }])
            .png()
            .toBuffer(),
          left: x + 195 + j * 86,
          top: y + 35 + k * 82,
        });
      }
    const label = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="28"><text x="12" y="20" fill="#eff5f3" font-family="sans-serif" font-size="16">${item.title} · 160 / 64 / 48 / 32 px</text></svg>`
    );
    layers.push({ input: label, left: x, top: y });
  }
  await sharp({ create: { width: 1300, height: 1470, channels: 3, background: "#203747" } })
    .composite(layers)
    .png()
    .toFile(path.join(output, "contact-sheet.png"));
  const preserved = JSON.parse(
    await readFile(path.join(ROOT, "scripts/assets/achievement-scenes/preserved-assets.json"), "utf8")
  );
  const manifest = {
    schemaVersion: 1,
    game: "gaia-project",
    engineVersion: "4.17.10",
    revision: 5,
    baseline: { engineVersion: "4.17.9", revision: 4, commit: "8861fe0121c9ea697c0b34b265f74a34fd782fc0" },
    provenance: {
      license: "MIT",
      author: "Original geometric artwork authored for boardgamers/gaia-project, 2026",
      inputs: [],
      references:
        "Game vocabulary only: standard pieces, planet types, Lost Fleet four named insignia and existing faction identities. No external or existing image bytes copied; preserved assets excluded from generation.",
    },
    generator: {
      path: "scripts/generate-achievement-scenes.mjs",
      sha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    },
    toolchain: sharp.versions,
    assets,
    preserved,
  };
  await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await generateScenes(process.argv[2]);
