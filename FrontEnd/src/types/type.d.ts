export interface WorldConfig {
  size: number;
  pitProb: number;
  pitWumpus: number;
  minGoldDistance: number;
}

export type Cell = "empty" | "pit" | "wumpus" | "gold" | "arrow";

export type Position = [number, number];

export interface Percepts {
  breeze: boolean;
  stench: boolean;
  glitter: boolean;
  arrow: boolean;
}

export interface KnowledgeCell {
  visited: boolean;
  safe: boolean;
  confirmed_pit: boolean;
  confirmed_wumpus: boolean;
  percepts: Percepts;
  p_pit: number;
  p_wumpus: number;
}

export interface AgentState {
  // ---- core world / agent state ----
  world: Cell[][];
  size: number;
  pos: Position;
  path: Position[];
  alive: boolean;

  // ---- mission state ----
  arrows: number;
  gold_found: boolean;
  returning: boolean;
  steps: number;
  max_steps: number;
  mode: string;
  action: string;

  // ---- statistics ----
  arrow_positions: Position[];
  killed_wumpus_positions: Position[];
  wumpus_kill_count: number;
  total_arrows_collected: number;
  death_cause: string | null;

  // ---- full knowledge base ----
  knowledge: KnowledgeCell[][];
}

export interface ActionResult {
  alive: boolean;
  arrows_left: number;
  gold_found: boolean;
  path: number[][];
  returned_home: boolean;
  steps: number;
  total_arrows_collected: number;
  wumpus_killed: number;
  death_cause: string | null;
}
