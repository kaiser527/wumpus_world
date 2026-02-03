import { Cell } from "@/types/type";
import { neighbors } from "./world";

export function getPercepts(world: Cell[][], i: number, j: number) {
  const p = {
    breeze: false,
    stench: false,
    glitter: false,
    arrow: false,
  };

  const size = world.length;

  if (world[i][j] === "gold") p.glitter = true;
  if (world[i][j] === "arrow") p.arrow = true;

  for (const [ni, nj] of neighbors(i, j, size)) {
    if (world[ni][nj] === "pit") p.breeze = true;
    if (world[ni][nj] === "wumpus") p.stench = true;
  }

  return p;
}
