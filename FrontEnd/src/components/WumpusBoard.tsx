import { useEffect, useState } from "react";
import KnowledgeBoard from "./KnowledgeBoard";
import { createWorld, DEFAULT_CONFIG } from "@/world/world";
import { getPercepts } from "@/world/percepts";
import WorldControls from "./WorldControls";
import {
  wumpus_image,
  pit_image,
  gold_image,
  arrow_up_image,
} from "@/world/images";
import "@/styles/world.scss";
import { ActionResult, AgentState, Cell, WorldConfig } from "@/types/type";
import { useAppDispatch, useAppSelector } from "@/redux/hooks";
import { setConfig } from "@/redux/slice/configSlice";
import { io } from "socket.io-client";
import { addData } from "@/redux/slice/resultSlice";

const images: Record<Cell, string | null> = {
  empty: null,
  pit: pit_image,
  wumpus: wumpus_image,
  gold: gold_image,
  arrow: arrow_up_image,
};

const socket = io("http://localhost:8000", {
  transports: ["websocket"],
});

export default function WumpusBoard() {
  const config: WorldConfig = useAppSelector((state) => state.config.config);

  const [world, setWorld] = useState<Cell[][]>(() =>
    createWorld(DEFAULT_CONFIG)
  );
  const [isPlaying, setIsPlaying] = useState(true);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [agent, setAgent] = useState<AgentState | null>(null);
  const [isDisabled, setIsDisabled] = useState(false);

  const dispatch = useAppDispatch();

  const visitCount = new Map<string, number>();

  if (agent?.path) {
    for (const [x, y] of agent.path) {
      const key = `${x},${y}`;
      visitCount.set(key, (visitCount.get(key) || 0) + 1);
    }
  }

  useEffect(() => {
    socket.on("connected", (msg) => {
      console.log("✅ Server:", msg);
    });

    socket.on("world_ready", (data) => {
      console.log("🌍 world_ready", data);
      setWorld(data.world); // server is now source of truth
      setAgent(data);
    });

    // receive agent updates while running
    socket.on("agent_update", (data) => {
      setResult(null);
      setWorld(data.world);
      setAgent(data);
    });

    socket.on("simulation_end", (data) => {
      console.log("🏁 Simulation ended:", data);
      setResult(data);

      const success = data.gold_found && data.returned_home;
      const died = Boolean(data.death_cause);

      if (success || died) {
        dispatch(addData(data));
        setIsDisabled(true);
      }
    });

    return () => {
      socket.off("connected");
      socket.off("world_ready");
      socket.off("agent_update");
      socket.off("simulation_end");
    };
  }, []);

  useEffect(() => {
    const newWorld = createWorld(config);
    setWorld(newWorld);
    socket.emit("init_world", { world: newWorld, arrows: 0 });
  }, [config]);

  return (
    <>
      <div className="top-panel">
        <WorldControls
          config={config}
          onChange={(c) => dispatch(setConfig(c))}
        />
        <div className="sim-controls">
          <button
            className="prev"
            onClick={() => {
              setResult(null);
              socket.emit("previous");
            }}
            disabled={!agent || (agent.pos[0] === 0 && agent.pos[1] === 0)}
          >
            Prev ⏮
          </button>
          <button
            className="stop"
            onClick={() => {
              setIsPlaying(!isPlaying);
              setResult(null);
              isPlaying ? socket.emit("start") : socket.emit("stop");
            }}
            disabled={!agent || isDisabled}
          >
            {isPlaying ? "▶ Run" : "⏹ Stop"}
          </button>
          <button
            className="step"
            onClick={() => {
              setResult(null);
              socket.emit("step");
            }}
            disabled={!agent || isDisabled}
          >
            ⏭ Next
          </button>
        </div>
      </div>
      <div className="main-panel">
        <div
          className="board"
          style={
            {
              "--size": config.size,
            } as React.CSSProperties
          }
        >
          {world.map((row, i) =>
            row.map((cell, j) => {
              const p = getPercepts(world, i, j);
              const hidePercepts =
                cell === "pit" || cell === "wumpus" || cell === "arrow";

              const isAgent = agent && agent.pos[0] === i && agent.pos[1] === j;
              const visits = visitCount.get(`${i},${j}`) || 0;

              let pathClass = "";
              if (visits > 0) pathClass = "path path-1";
              if (visits > 1) pathClass = "path path-2";
              if (visits > 3) pathClass = "path path-3";
              if (visits > 6) pathClass = "path path-4";

              const arrowHere = agent?.arrow_positions?.some(
                ([x, y]) => x === i && y === j
              );
              const killedWumpusHere = agent?.killed_wumpus_positions?.some(
                ([x, y]) => x === i && y === j
              );

              return (
                <div className={`cell ${pathClass}`} key={`${i}-${j}`}>
                  {images[cell] && (
                    <img
                      src={images[cell]!}
                      draggable={false}
                      style={
                        cell === "arrow" ? { transform: "rotate(180deg)" } : {}
                      }
                    />
                  )}

                  {isAgent && (
                    <>
                      <div className="agent">🤖</div>
                      <p className="agent-mode">{agent?.mode ?? "idle"}</p>
                      {agent.action && (
                        <p className="agent-action">{agent.action}</p>
                      )}
                    </>
                  )}

                  {arrowHere && <div className="arrow-collected">🏹</div>}
                  {killedWumpusHere && <div className="wumpus-dead">💀</div>}

                  <div className="percepts">
                    {!hidePercepts && p.breeze && <span>Breeze</span>}
                    {!hidePercepts && p.stench && <span>Stench</span>}
                    {!hidePercepts && p.glitter && <span>Glitter</span>}
                    {!hidePercepts && p.arrow && <span>Arrow</span>}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <KnowledgeBoard agent={agent} result={result} />
      </div>
    </>
  );
}
