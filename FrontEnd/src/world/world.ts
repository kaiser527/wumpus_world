import { WorldConfig, Cell } from "@/types/backend";

/* ───────────────── config ───────────────── */

export const DEFAULT_CONFIG: WorldConfig = {
  size: 8,
  pitProb: 0.2,
  pitWumpus: 0.08,
  minGoldDistance: 2,
};

export const SAFE_START_CELLS = new Set([
  "0,0",
  "0,1",
  "1,0",
  "2,0",
  "1,1",
  "0,2",
  "0,3",
  "1,2",
  "2,1",
  "3,0",
]);

/* ───────────────── helpers ───────────────── */

export function neighbors(i: number, j: number, size: number) {
  return [
    [i - 1, j],
    [i + 1, j],
    [i, j - 1],
    [i, j + 1],
  ].filter(([ni, nj]) => ni >= 0 && ni < size && nj >= 0 && nj < size);
}

function diagonalNeighbors(i: number, j: number, size: number) {
  return [
    [i - 1, j - 1],
    [i - 1, j + 1],
    [i + 1, j - 1],
    [i + 1, j + 1],
  ].filter(([ni, nj]) => ni >= 0 && ni < size && nj >= 0 && nj < size);
}

function anyAdjacent(
  world: Cell[][],
  i: number,
  j: number,
  size: number,
  types: Cell[]
) {
  return (
    neighbors(i, j, size).some(([ni, nj]) => types.includes(world[ni][nj])) ||
    diagonalNeighbors(i, j, size).some(([ni, nj]) =>
      types.includes(world[ni][nj])
    )
  );
}

/* ───────────────── BFS ───────────────── */

export function bfsSafe(world: Cell[][], size: number) {
  const visited = new Set<string>();
  const dist = new Map<string, number>();
  const queue: [number, number][] = [[0, 0]];

  visited.add("0,0");
  dist.set("0,0", 0);

  while (queue.length) {
    const [i, j] = queue.shift()!;
    const d = dist.get(`${i},${j}`)!;

    for (const [ni, nj] of neighbors(i, j, size)) {
      const key = `${ni},${nj}`;
      if (!visited.has(key) && !["pit", "wumpus"].includes(world[ni][nj])) {
        visited.add(key);
        dist.set(key, d + 1);
        queue.push([ni, nj]);
      }
    }
  }

  return { visited, dist };
}

function bfsFrom(i0: number, j0: number, world: Cell[][], size: number) {
  const dist = new Map<string, number>();
  const queue: [number, number][] = [[i0, j0]];

  dist.set(`${i0},${j0}`, 0);

  while (queue.length) {
    const [i, j] = queue.shift()!;
    const d = dist.get(`${i},${j}`)!;

    for (const [ni, nj] of neighbors(i, j, size)) {
      const key = `${ni},${nj}`;
      if (!dist.has(key) && !["pit", "wumpus"].includes(world[ni][nj])) {
        dist.set(key, d + 1);
        queue.push([ni, nj]);
      }
    }
  }

  return dist;
}

/* ───────────────── placement utils ───────────────── */

function computeWumpusCount(size: number, prob: number) {
  return Math.max(1, Math.floor(size * size * prob));
}

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* 🔥 STRONG gold-guarding Wumpus placement */
function placeWumpusesNearGold(
  world: Cell[][],
  size: number,
  gi: number,
  gj: number,
  count: number
): number {
  const dist = bfsFrom(gi, gj, world, size);

  const candidates = [...dist.entries()]
    .map(([k, d]) => ({
      pos: k.split(",").map(Number) as [number, number],
      d,
    }))
    .filter(
      ({ pos: [i, j], d }) =>
        world[i][j] === "empty" &&
        !SAFE_START_CELLS.has(`${i},${j}`) &&
        d > 0 &&
        d <= 2
    )
    .sort((a, b) => a.d - b.d); // distance 1 first

  let placed = 0;

  for (const {
    pos: [i, j],
  } of candidates) {
    if (placed >= count) break;
    if (anyAdjacent(world, i, j, size, ["wumpus"])) continue;

    world[i][j] = "wumpus";
    placed++;
  }

  return placed;
}

/* ───────────────── main world builder ───────────────── */

export function createWorld(config: WorldConfig): Cell[][] {
  const { size, pitProb, pitWumpus, minGoldDistance } = config;
  const desiredWumpusCount = computeWumpusCount(size, pitWumpus);

  while (true) {
    const world: Cell[][] = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => "empty")
    );

    const safeCells = new Set(SAFE_START_CELLS);
    neighbors(0, 0, size).forEach(([i, j]) => safeCells.add(`${i},${j}`));

    /* 🕳 pits */
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) {
        if (safeCells.has(`${i},${j}`)) continue;
        if (Math.random() >= pitProb) continue;
        if (anyAdjacent(world, i, j, size, ["pit"])) continue;

        world[i][j] = "pit";
      }
    }

    /* 💰 gold */
    const { visited, dist } = bfsSafe(world, size);
    const goldCandidates = [...visited]
      .map((s) => s.split(",").map(Number) as [number, number])
      .filter(
        ([i, j]) =>
          world[i][j] === "empty" &&
          !SAFE_START_CELLS.has(`${i},${j}`) &&
          (dist.get(`${i},${j}`) ?? 0) >= minGoldDistance
      );

    if (!goldCandidates.length) continue;

    const [gi, gj] =
      goldCandidates[Math.floor(Math.random() * goldCandidates.length)];
    world[gi][gj] = "gold";

    /* 👹 Wumpus priority near gold */
    const nearGoldTarget = Math.min(
      desiredWumpusCount,
      Math.max(1, Math.floor(desiredWumpusCount * 0.8))
    );

    const nearGoldPlaced = placeWumpusesNearGold(
      world,
      size,
      gi,
      gj,
      nearGoldTarget
    );

    let totalWumpus = nearGoldPlaced;

    const safe = bfsSafe(world, size).visited;
    const restCandidates = [...safe]
      .map((s) => s.split(",").map(Number) as [number, number])
      .filter(
        ([i, j]) =>
          world[i][j] === "empty" && !SAFE_START_CELLS.has(`${i},${j}`)
      );

    shuffle(restCandidates);

    for (const [i, j] of restCandidates) {
      if (totalWumpus >= desiredWumpusCount) break;
      if (anyAdjacent(world, i, j, size, ["wumpus"])) continue;

      world[i][j] = "wumpus";
      totalWumpus++;
    }

    if (totalWumpus !== desiredWumpusCount) continue;

    /* 🏹 arrows = EXACT wumpus count */
    let arrowsPlaced = 0;
    shuffle(restCandidates);

    for (const [i, j] of restCandidates) {
      if (arrowsPlaced >= totalWumpus) break;
      if (world[i][j] !== "empty") continue;
      if (anyAdjacent(world, i, j, size, ["pit", "wumpus", "arrow"])) continue;

      world[i][j] = "arrow";
      arrowsPlaced++;
    }

    if (arrowsPlaced !== totalWumpus) continue;

    return world;
  }
}
