import { ColorVar, dynamicCellStyle } from "../graphics/colors";
import { FinalScoringContributor, finalScoringSources, FinalScoringTableRow } from "./charts/final-scoring";
import { rowHeaderCell } from "./charts/table";

const finalScoringContributorColors: { [key in FinalScoringContributor]: string } = {
  "Regular Building": "--res-ore",
  "Lantids Guest Mine": "--recent",
  "Lost Planet": "--lost",
  Satellite: "--current-round",
  "Space Station": "--oxide",
  "Gaia Former": "--rt-gaia",
};

const finalScoringTableRows: FinalScoringTableRow[] = Object.keys(finalScoringSources)
  .map((s) => finalScoringSources[s] as FinalScoringTableRow)
  .concat(
    {
      name: "(Starting Point for navigation)",
      color: "--rt-nav",
      contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine", "Space Station"],
    },
    {
      name: "(Power value for federations)",
      color: "--res-knowledge",
      contributors: ["Regular Building", "Lost Planet", "Space Station", "Lantids Guest Mine"],
    },
    {
      name: "(Other players can charge power)",
      color: "--res-power",
      contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine"],
    },
    {
      name: "(Counts as mine for boosters, round scoring, advanced tech)",
      color: "--res-power",
      contributors: ["Regular Building", "Lost Planet", "Lantids Guest Mine"],
    }
  );

export function finalScoringFields(canvas: HTMLElement): any[] {
  return [{ key: "Name", sortable: true, isRowHeader: true } as { key: string }].concat(
    ...Object.keys(finalScoringContributorColors).map((c) => {
      return {
        key: c,
        sortable: true,
        thStyle: dynamicCellStyle(canvas as HTMLCanvasElement, new ColorVar(finalScoringContributorColors[c])),
      };
    })
  );
}

export function finalScoringItems(canvas: HTMLElement): any[] {
  return finalScoringTableRows.map((r) => {
    const row = { Name: rowHeaderCell(dynamicCellStyle(canvas, new ColorVar(r.color)), r.name) };

    for (const contributor of r.contributors) {
      row[contributor] = true;
    }
    return row;
  });
}
