from collections import defaultdict
import heapq
import math
from pysat.formula import CNF
from pysat.solvers import Minisat22

class Agent:
    def __init__(self, world, arrows=0):
        self.world = world
        self.size = len(world)
        self.pos = (0, 0)
        self.path = [self.pos]
        self.alive = True
        self.death_cause = None
        self.mode = ""
        self.action = ""

        self.arrows = arrows
        self.gold_found = False
        self.returning = False
        self.steps = 0
        self.max_steps = self.size * self.size * 6

        self.arrow_positions = []
        self.killed_wumpus_positions = []
        self.wumpus_kill_count = 0
        self.total_arrows_collected = 0

        self.knowledge = [[{
            "visited": False,
            "safe": False,
            "confirmed_pit": False,
            "confirmed_wumpus": False,
            "percepts": {},
            "p_pit": 0.0,
            "p_wumpus": 0.0
        } for _ in range(self.size)] for _ in range(self.size)]

        self.knowledge[0][0]["safe"] = True

        self.var_map = {}
        self.rev_map = {}
        self.next_var = 1

    # --------------------------------------------------
    # BASIC WORLD OPS
    # --------------------------------------------------

    def neighbors(self, i, j):
        for di, dj in [(-1,0),(1,0),(0,-1),(0,1)]:
            ni, nj = i + di, j + dj
            if 0 <= ni < self.size and 0 <= nj < self.size:
                yield (ni, nj)
                
    def diagonals(self, i, j):
        for di, dj in [(-1,-1), (-1,1), (1,-1), (1,1)]:
            ni, nj = i + di, j + dj
            if 0 <= ni < self.size and 0 <= nj < self.size:
                yield ni, nj
                
    def is_corner(self, i, j):
        return (i == 0 or i == self.size - 1) and (j == 0 or j == self.size - 1)

    def get_percepts(self, i, j):
        percepts = {"breeze": False, "stench": False, "glitter": False, "arrow": False}

        if self.world[i][j] == "gold":
            percepts["glitter"] = True
        if self.world[i][j] == "arrow":
            percepts["arrow"] = True

        for ni, nj in self.neighbors(i, j):
            if self.world[ni][nj] == "pit":
                percepts["breeze"] = True
            if self.world[ni][nj] == "wumpus":
                percepts["stench"] = True

        return percepts

    # --------------------------------------------------
    # SAT VARIABLE SYSTEM
    # --------------------------------------------------

    def pit_var(self, i, j):
        return self.get_var(("P", i, j))

    def wumpus_var(self, i, j):
        return self.get_var(("W", i, j))

    def get_var(self, key):
        if key not in self.var_map:
            v = self.next_var
            self.var_map[key] = v
            self.rev_map[v] = key
            self.next_var += 1
        return self.var_map[key]

    # --------------------------------------------------
    # KNOWLEDGE UPDATE
    # --------------------------------------------------

    def update_knowledge(self, percepts):
        i, j = self.pos
        cell = self.knowledge[i][j]

        cell["visited"] = True
        cell["safe"] = True
        cell["percepts"] = percepts
        cell["p_pit"] = 0
        cell["p_wumpus"] = 0

        self.rebuild_beliefs()

    # --------------------------------------------------
    # SAT BUILDING
    # --------------------------------------------------

    def build_cnf(self):
        cnf = CNF()

        for i in range(self.size):
            for j in range(self.size):
                P = self.pit_var(i, j)
                W = self.wumpus_var(i, j)

                # not both pit and wumpus
                cnf.append([-P, -W])

                c = self.knowledge[i][j]

                if c["visited"]:
                    cnf.append([-P])
                    cnf.append([-W])

                    nbrs = list(self.neighbors(i, j))
                    pits = [self.pit_var(x, y) for x, y in nbrs]
                    wums = [self.wumpus_var(x, y) for x, y in nbrs]

                    if c["percepts"].get("breeze"):
                        cnf.append(pits)
                    else:
                        for p in pits:
                            cnf.append([-p])

                    if c["percepts"].get("stench"):
                        cnf.append(wums)
                    else:
                        for w in wums:
                            cnf.append([-w])

        return cnf

    def sat_entails(self, literal):
        cnf = self.build_cnf()

        with Minisat22(bootstrap_with=cnf) as solver:
            if not solver.solve():
                return False

            solver.add_clause([-literal])
            return not solver.solve()

    # --------------------------------------------------
    # GLOBAL REASONING
    # --------------------------------------------------

    def rebuild_beliefs(self):
        # reset
        for i in range(self.size):
            for j in range(self.size):
                c = self.knowledge[i][j]
                c["p_pit"] = 0.0
                c["p_wumpus"] = 0.0
                if not c["visited"]:
                    c["safe"] = False
                    c["confirmed_pit"] = False
                    c["confirmed_wumpus"] = False

        # ---------- SAT LOGICAL PASSES ----------
        for i in range(self.size):
            for j in range(self.size):
                if self.knowledge[i][j]["visited"]:
                    continue

                P = self.pit_var(i, j)
                W = self.wumpus_var(i, j)

                if self.sat_entails(P):
                    self.knowledge[i][j]["confirmed_pit"] = True
                    self.knowledge[i][j]["safe"] = False

                elif self.sat_entails(W):
                    self.knowledge[i][j]["confirmed_wumpus"] = True
                    self.knowledge[i][j]["safe"] = False

                elif self.sat_entails(-P) and self.sat_entails(-W):
                    self.knowledge[i][j]["safe"] = True

        # ---------- PROBABILISTIC SUPPORT ----------
        pit_support = defaultdict(int)
        wumpus_support = defaultdict(int)

        def support_to_prob(support, i, j, base=0.32, cap=0.82):
            support = min(support, 4)
            if support <= 0:
                return 0.0

            p = base * (math.log2(support + 1) ** 1.1)

            if self.is_corner(i, j):
                p *= 1.6   

            return min(cap, p)

        # 1) Count percept support
        for i in range(self.size):
            for j in range(self.size):
                c = self.knowledge[i][j]
                if not c["visited"]:
                    continue

                nbrs = [
                    (x, y) for x, y in self.neighbors(i, j)
                    if not self.knowledge[x][y]["visited"]
                    and not self.knowledge[x][y]["safe"]
                    and not self.knowledge[x][y]["confirmed_pit"]
                    and not self.knowledge[x][y]["confirmed_wumpus"]
                ]

                if not nbrs:
                    continue

                if c["percepts"].get("breeze"):
                    for n in nbrs:
                        pit_support[n] += 1

                if c["percepts"].get("stench"):
                    for n in nbrs:
                        wumpus_support[n] += 1

        # 2) Assign probabilities from support
        for (i, j), s in pit_support.items():
            c = self.knowledge[i][j]
            if not c["safe"] and not c["confirmed_pit"]:
                c["p_pit"] = support_to_prob(s, i, j)

        for (i, j), s in wumpus_support.items():
            c = self.knowledge[i][j]
            if not c["safe"] and not c["confirmed_wumpus"]:
                c["p_wumpus"] = support_to_prob(s, i, j)

        # 3) Enforce logical dominance + structural rules
        for i in range(self.size):
            for j in range(self.size):
                c = self.knowledge[i][j]

                # ---------- CONFIRMED PIT ----------
                if c["confirmed_pit"]:
                    c["p_pit"] = 1.0
                    c["p_wumpus"] = 0.0

                    # neighbors cannot be pit
                    for ni, nj in self.neighbors(i, j):
                        self.knowledge[ni][nj]["p_pit"] = 0.0

                    # zig-zag (diagonal) cannot be pit
                    for ni, nj in self.diagonals(i, j):
                        self.knowledge[ni][nj]["p_pit"] = 0.0

                # ---------- CONFIRMED WUMPUS ----------
                elif c["confirmed_wumpus"]:
                    c["p_wumpus"] = 1.0
                    c["p_pit"] = 0.0

                    # neighbors cannot be wumpus
                    for ni, nj in self.neighbors(i, j):
                        self.knowledge[ni][nj]["p_wumpus"] = 0.0

                    # zig-zag (diagonal) cannot be wumpus
                    for ni, nj in self.diagonals(i, j):
                        self.knowledge[ni][nj]["p_wumpus"] = 0.0

                # ---------- SAFE ----------
                elif c["safe"]:
                    c["p_pit"] = 0.0
                    c["p_wumpus"] = 0.0

    # --------------------------------------------------
    # RISK + PATHFINDING
    # --------------------------------------------------

    def risk(self, i, j):
        c = self.knowledge[i][j]
        if c["confirmed_pit"] or c["confirmed_wumpus"]:
            return float("inf")

        death = 1 - (1 - c["p_pit"]) * (1 - c["p_wumpus"])
        revisit_penalty = 0.05 if c["visited"] else 0
        arrow_bonus = -0.15 if self.arrows and c["p_wumpus"] > 0.5 else 0
        compound_penalty = 0.3 if (c["p_pit"] > 0.4 and c["p_wumpus"] > 0.4) else 0

        return death * 100 + revisit_penalty + compound_penalty + arrow_bonus

    def astar(self, target, allow_target_wumpus=False):
        start = self.pos
        pq = [(0, start, [], 0)]
        visited = {start: 0}

        while pq:
            _, (i, j), path, cost = heapq.heappop(pq)
            if (i, j) == target:
                return path, cost

            for ni, nj in self.neighbors(i, j):
                c = self.knowledge[ni][nj]
                
                if c["confirmed_pit"]:
                    continue

                if c["confirmed_wumpus"] and not (allow_target_wumpus and (ni, nj) == target):
                    continue              
                
                if allow_target_wumpus and (ni, nj) == target:
                    step_risk = 0
                else:
                    step_risk = self.risk(ni, nj)
                
                new_cost = cost + 1 + step_risk
                
                if new_cost < visited.get((ni, nj), 1e9):
                    visited[(ni, nj)] = new_cost
                    h = abs(ni - target[0]) + abs(nj - target[1])
                    heapq.heappush(pq, (new_cost + h, (ni, nj), path + [(ni, nj)], new_cost))

        return None, 1e9

    # --------------------------------------------------
    # FRONTIER
    # --------------------------------------------------

    def frontier(self):
        out = []
        for i in range(self.size):
            for j in range(self.size):
                if not self.knowledge[i][j]["visited"]:
                    if any(self.knowledge[x][y]["visited"] for x, y in self.neighbors(i, j)):
                        out.append((i, j))
        return out

    def choose_frontier(self):
        best = None
        best_score = 1e9

        for f in self.frontier():
            path, cost = self.astar(f)
            if path:
                c = self.knowledge[f[0]][f[1]]
                utility = cost + 40 * (c["p_pit"] + c["p_wumpus"])
                if utility < best_score:
                    best_score = utility
                    best = path
        return best
    
    def backtrack_target(self):
        """Return the closest visited cell that has at least one safe unvisited neighbor."""
        candidates = []

        for i in range(self.size):
            for j in range(self.size):
                if self.knowledge[i][j]["visited"]:
                    for ni, nj in self.neighbors(i, j):
                        if self.knowledge[ni][nj]["safe"] and not self.knowledge[ni][nj]["visited"]:
                            candidates.append((i, j))
                            break

        best = None
        best_cost = 1e9

        for cell in candidates:
            path, cost = self.astar(cell)
            if path and cost < best_cost:
                best = path
                best_cost = cost

        return best
    
    def no_safe_unvisited_exists(self):
        for i in range(self.size):
            for j in range(self.size):
                if not self.knowledge[i][j]["visited"]:
                    continue

                for ni, nj in self.neighbors(i, j):
                    c = self.knowledge[ni][nj]

                    if not c["visited"]:
                        # If ANY unvisited neighbor has zero risk, exploration is still possible
                        if c["p_pit"] == 0.0 and c["p_wumpus"] == 0.0:
                            return False

        return True
    
    def confirmed_wumpus_cells(self):
        return [
            (i, j)
            for i in range(self.size)
            for j in range(self.size)
            if self.knowledge[i][j]["confirmed_wumpus"]
        ]
        
    def hunt_wumpus(self):
        targets = self.confirmed_wumpus_cells()
        best = None
        best_cost = 1e9

        for wi, wj in targets:
            path, cost = self.astar(
                (wi, wj),
                allow_target_wumpus=True
            )
            if path and cost < best_cost:
                best = path
                best_cost = cost

        return best

    # --------------------------------------------------
    # SHOOTING LOGIC
    # --------------------------------------------------

    def shoot_arrow(self, target_i, target_j):
        ai, aj = self.pos
        di = 0 if target_i == ai else (1 if target_i > ai else -1)
        dj = 0 if target_j == aj else (1 if target_j > aj else -1)

        killed = []
        ci, cj = ai + di, aj + dj

        while 0 <= ci < self.size and 0 <= cj < self.size:
            if self.world[ci][cj] == "wumpus":
                self.world[ci][cj] = "empty"
                killed.append((ci, cj))
                self.killed_wumpus_positions.append((ci, cj))
                self.wumpus_kill_count += 1
                break
            ci += di
            cj += dj

        return killed

    def update_beliefs_after_shot(self, killed_positions):
        for wi, wj in killed_positions:
            c = self.knowledge[wi][wj]
            c["visited"] = True
            c["safe"] = True
            c["confirmed_wumpus"] = False
            c["confirmed_pit"] = False
            c["p_wumpus"] = 0.0
            c["p_pit"] = 0.0

        # refresh percepts everywhere stench might change
        for i in range(self.size):
            for j in range(self.size):
                if self.knowledge[i][j]["visited"]:
                    self.knowledge[i][j]["percepts"] = self.get_percepts(i, j)

        self.rebuild_beliefs()

    # --------------------------------------------------
    # MAIN LOOP
    # --------------------------------------------------

    def next_move(self):
        if not self.alive:
            return None
        
        self.action = ""

        self.steps += 1
        if self.steps > self.max_steps:
            self.alive = False
            print("⏱️ Max steps exceeded")
            return None
        
        print("Confirmed pits:",
            [(i,j) for i in range(self.size) for j in range(self.size)
            if self.knowledge[i][j]["confirmed_pit"]])

        print("Confirmed wumpus:",
            [(i,j) for i in range(self.size) for j in range(self.size)
            if self.knowledge[i][j]["confirmed_wumpus"]])

        tile = self.world[self.pos[0]][self.pos[1]]
        if tile in ("pit", "wumpus"):
            self.alive = False
            self.death_cause = tile
            print(f"💀 Agent died at {self.pos} due to {tile}")
            return None

        percepts = self.get_percepts(*self.pos)
        self.update_knowledge(percepts)

        # GOLD
        if percepts.get("glitter", False) and not self.gold_found:
            self.gold_found = True
            self.action = "PICK GOLD"
            self.returning = True
            self.world[self.pos[0]][self.pos[1]] = "empty"

        # ARROW
        if percepts.get("arrow", False):
            self.arrows += 1
            self.total_arrows_collected += 1
            self.action = "PICK ARROW"
            self.arrow_positions.append(self.pos)
            self.world[self.pos[0]][self.pos[1]] = "empty"

        # SHOOT
        if self.arrows > 0:
            # --- 1) IMMEDIATE shot if any neighbor is confirmed ---
            for ni, nj in self.neighbors(*self.pos):
                c = self.knowledge[ni][nj]
                if c["confirmed_wumpus"]:
                    self.action = "SHOOT ARROW"
                    self.arrows -= 1
                    killed = self.shoot_arrow(ni, nj)
                    if killed:
                        self.update_beliefs_after_shot(killed)
                    return self.pos

            # --- 2) Otherwise, probabilistic shot if stench and high risk ---
            if percepts.get("stench", False):
                targets = [(self.knowledge[i][j]["p_wumpus"], i, j)
                           for i, j in self.neighbors(*self.pos)
                           if not self.knowledge[i][j]["visited"]]

                if targets:
                    p, ti, tj = max(targets)
                    if p > 0.65:
                        self.action = "SHOOT ARROW"
                        self.arrows -= 1
                        killed = self.shoot_arrow(ti, tj)
                        if killed:
                            self.update_beliefs_after_shot(killed)
                        return self.pos

        # RETURN
        if self.returning:
            path, _ = self.astar((0, 0))
            if path:
                self.mode = "RETURNING"
                self.pos = path[0]
                self.path.append(self.pos)
            return self.pos

        # SAFE MOVE
        nbrs = list(self.neighbors(*self.pos))
        safe = [n for n in nbrs if self.knowledge[n[0]][n[1]]["safe"]
                and not self.knowledge[n[0]][n[1]]["visited"]]
        if safe:
            self.mode = "SAFE MOVE"
            self.pos = min(safe, key=lambda c: self.risk(*c))
            self.path.append(self.pos)
            return self.pos
        
        # HUNT MODE
        if (
            self.arrows > 0
            and self.no_safe_unvisited_exists()
            and self.confirmed_wumpus_cells()
        ):
            hunt_path = self.hunt_wumpus()
            if hunt_path:
                self.mode = "HUNT"
                self.pos = hunt_path[0]
                self.path.append(self.pos)
                return self.pos
        
        # BACKTRACK
        backtrack_path = self.backtrack_target()
        if backtrack_path:
            self.mode = "BACKTRACK"
            self.pos = backtrack_path[0]
            self.path.append(self.pos)
            return self.pos
        
        # FRONTIER
        best = self.choose_frontier()
        if best:
            self.mode = "FRONTIER"
            self.pos = best[0]
            self.path.append(self.pos)
            return self.pos

        # GAMBLE
        self.mode = "GAMBLE"
        choices = [
            n for n in nbrs
            if not self.knowledge[n[0]][n[1]]["confirmed_pit"]
            and not self.knowledge[n[0]][n[1]]["confirmed_wumpus"]
        ]
        if not choices:
            choices = nbrs
        self.pos = min(choices, key=lambda c: self.risk(*c))
        self.path.append(self.pos)
        return self.pos