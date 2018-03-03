import {defineGrid} from "honeycomb-grid";

const Grid = defineGrid();
const grid1 = Grid.hexagon({radius: 2});

console.log(grid1[0], grid1.length);