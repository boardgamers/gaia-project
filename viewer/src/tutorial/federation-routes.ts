export const detour = "-3x0,-3x1,-3x2,-2x2,-1x2,0x2,0x3,1x2,2x1,3x0";
export const reducedRoute = "-3x0,-2x0,-1x0,0x0,1x0,2x0,3x0";
export const stationRoute = reducedRoute + ",0x1,0x2,0x3";
export type RejectedRoute = "detour" | "station";
export interface RouteRejection {
  message: string;
  coordinates: string[];
  value: number;
  satellites: number;
}
export type RouteRejections = Partial<Record<RejectedRoute, RouteRejection>>;

export const routeExamples = [
  { id: "detour", title: "Avoid the station", location: detour, value: 7, satellites: 7 },
  { id: "station", title: "Add the station, keep the mine", location: stationRoute, value: 9, satellites: 6 },
  { id: "reduced", title: "Remove the mine’s branch", location: reducedRoute, value: 8, satellites: 4 },
] as const;

export const routeRefusals = {
  detour:
    "Attempt 1 refused: the same three buildings can be connected with 6 satellites by going through the trading station, instead of 7.",
  station:
    "Attempt 2 refused: the planetary institute, trading station and academy already total 8. The mine’s branch adds 2 unnecessary satellites; remove it to use only 4.",
};

export function renderRouteComparison(
  target: HTMLElement,
  step: number,
  completed: boolean,
  rejections: RouteRejections
) {
  const doc = target.ownerDocument;
  const examples = routeExamples.slice(0, completed ? 3 : step + 1);
  const list = doc.createElement("ol");
  list.className = completed ? "tutorial-route-comparison" : "tutorial-route-attempts";
  list.setAttribute("aria-label", "Federation attempts");
  for (const [index, example] of examples.entries()) {
    const row = doc.createElement("li");
    const rejection = example.id === "reduced" ? undefined : rejections[example.id];
    const accepted = completed && example.id === "reduced";
    const value = rejection?.value ?? example.value;
    const satellites = rejection?.satellites ?? example.satellites;
    row.className = accepted ? "accepted" : rejection ? "refused" : "current";
    if (!completed && index === step) row.setAttribute("aria-current", "step");
    row.title = example.title;
    const name = doc.createElement("strong");
    name.textContent = completed ? `${index + 1}. ${example.title}` : `${index + 1}. ${satellites} satellites`;
    const stats = doc.createElement("span");
    stats.className = "tutorial-route-stats";
    stats.textContent = completed ? `Value ${value} · ${satellites} satellites` : `Value ${value}`;
    const status = doc.createElement("span");
    status.className = "tutorial-route-status";
    status.textContent = accepted ? "Accepted" : rejection ? "Refused" : "Selected";
    row.append(name, stats, status);
    if (completed) row.append(routeDiagram(doc, example, rejection?.coordinates));
    list.append(row);
  }
  target.replaceChildren(list);
}

function routeDiagram(
  doc: Document,
  example: (typeof routeExamples)[number],
  coordinates = example.location.split(",")
) {
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 620 270");
  svg.setAttribute("role", "img");
  svg.setAttribute(
    "aria-label",
    `${example.title}: ${example.value} building value, ${example.satellites} satellites.`
  );
  const selected = new Set(coordinates);
  const add = (tag: string, attributes: Record<string, string>, text?: string) => {
    const node = doc.createElementNS(svg.namespaceURI, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    if (text) node.textContent = text;
    svg.append(node);
    return node;
  };
  const xy = (q: number, r: number) => [310 + (q + r / 2) * 62, 75 + r * 48];
  const points = coordinates.map((coord) => coord.split("x").map(Number));
  const color = example.id === "reduced" ? "#259675" : "#b87822";
  for (const [index, [q, r]] of points.entries()) {
    const [x1, y1] = xy(q, r);
    for (const [q2, r2] of points.slice(index + 1)) {
      if (Math.max(Math.abs(q - q2), Math.abs(r - r2), Math.abs(q + r - q2 - r2)) !== 1) continue;
      const [x2, y2] = xy(q2, r2);
      add("line", {
        x1: String(x1),
        y1: String(y1),
        x2: String(x2),
        y2: String(y2),
        stroke: color,
        "stroke-width": "5",
      });
    }
    add("circle", { cx: String(x1), cy: String(y1), r: "5", fill: color });
  }
  for (const [q, r, words, value] of [
    [-3, 0, ["Planetary", "institute"], 3],
    [0, 0, ["Trading", "station"], 2],
    [3, 0, ["Academy"], 3],
    [0, 3, ["Mine"], 1],
  ] as const) {
    const [x, y] = xy(q, r);
    const opacity = selected.has(`${q}x${r}`) ? "1" : "0.35";
    add("circle", {
      cx: String(x),
      cy: String(y),
      r: "22",
      fill: "var(--tutorial-diagram-bg)",
      stroke: "currentColor",
      "stroke-width": "2",
      opacity,
    });
    add(
      "text",
      { x: String(x), y: String(y + 7), "text-anchor": "middle", fill: "currentColor", opacity },
      String(value)
    );
    for (const [line, word] of words.entries())
      add(
        "text",
        {
          x: String(x),
          y: String(y - 33 - (words.length - line - 1) * 24),
          "text-anchor": "middle",
          fill: "currentColor",
          stroke: "var(--tutorial-diagram-bg)",
          "stroke-width": "5",
          "paint-order": "stroke",
          opacity,
        },
        word
      );
  }
  return svg;
}
