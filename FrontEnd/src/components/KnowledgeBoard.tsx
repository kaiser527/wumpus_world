import { ActionResult, AgentState } from "@/types/backend";
import HistoryResult from "./HistoryResult";
import "@/styles/knowledge.scss";
import pit_image from "@/assets/images/pit.png";
import wumpus_image from "@/assets/images/wumpus.png";
import { useState } from "react";

interface Props {
  agent: AgentState | null;
  result: ActionResult | null;
}

export default function KnowledgeBoard({ agent, result }: Props) {
  const [showPath, setShowPath] = useState(false);
  const [showModal, setShowModal] = useState(false);

  if (!agent) {
    return <div className="knowledge empty">No agent data</div>;
  }

  const kb = agent.knowledge;

  const liveResult: ActionResult | null = agent
    ? {
        alive: agent.alive,
        gold_found: agent.gold_found,
        returned_home:
          agent.gold_found && agent.pos[0] === 0 && agent.pos[1] === 0,
        steps: agent.steps,
        path: agent.path,
        death_cause: agent.death_cause ?? "unknown",
        arrows_left: agent.arrows,
        total_arrows_collected: agent.total_arrows_collected,
        wumpus_killed: agent.wumpus_kill_count,
      }
    : null;

  const displayResult = result ?? liveResult;

  const visitCount = new Map<string, number>();

  if (displayResult) {
    for (const [i, j] of displayResult.path) {
      const key = `${i},${j}`;
      visitCount.set(key, (visitCount.get(key) ?? 0) + 1);
    }
  }

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div className="knowledge-wrapper">
          {showPath && displayResult && displayResult.path.length > 1 && (
            <svg
              className="path-overlay"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              {displayResult.path.slice(1).map(([i, j], idx) => {
                const [pi, pj] = displayResult.path[idx];

                const x1 = (pj + 0.5) * (100 / agent.size);
                const y1 = (pi + 0.5) * (100 / agent.size);
                const x2 = (j + 0.5) * (100 / agent.size);
                const y2 = (i + 0.5) * (100 / agent.size);

                const visits = visitCount.get(`${i},${j}`) ?? 1;

                // color ramp (keeps increasing)
                const strokeColor =
                  visits === 1
                    ? "#38bdf8" // first time (blue)
                    : visits === 2
                    ? "#22c55e" // second time (green)
                    : visits === 3
                    ? "#facc15" // third time (yellow)
                    : "#ef4444"; // many times (red)

                return (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={strokeColor}
                    strokeWidth={1}
                    strokeLinecap="round"
                  />
                );
              })}
            </svg>
          )}
          <div
            className="knowledge-board"
            style={{ "--size": agent.size } as React.CSSProperties}
          >
            {kb.map((row, i) =>
              row.map((cell, j) => {
                const isAgentHere = agent.pos[0] === i && agent.pos[1] === j;
                const isDead =
                  displayResult && !displayResult.alive && isAgentHere;

                const {
                  visited,
                  safe,
                  confirmed_pit,
                  confirmed_wumpus,
                  p_pit,
                  p_wumpus,
                  percepts,
                } = cell;

                let cls = "kcell";
                if (visited) cls += " visited";
                if (safe) cls += " safe";
                if (confirmed_pit) cls += " pit";
                if (confirmed_wumpus) cls += " wumpus";

                return (
                  <div key={`${i}-${j}`} className={cls}>
                    <div className="coords">
                      {i},{j}
                    </div>

                    {visited && (
                      <div className="percepts-text">
                        {percepts?.breeze && (
                          <div className="breeze">Breeze</div>
                        )}
                        {percepts?.stench && (
                          <div className="stench">Stench</div>
                        )}
                      </div>
                    )}

                    {confirmed_pit && (
                      <img
                        className="kicon"
                        src={pit_image}
                        draggable={false}
                      />
                    )}
                    {confirmed_wumpus && (
                      <img
                        className="kicon"
                        src={wumpus_image}
                        draggable={false}
                      />
                    )}

                    {!confirmed_pit && !confirmed_wumpus && (
                      <div className="probs">
                        {p_pit > 0 && (
                          <div>pit: {(p_pit * 100).toFixed(0)}%</div>
                        )}
                        {p_wumpus > 0 && (
                          <div>w: {(p_wumpus * 100).toFixed(0)}%</div>
                        )}
                      </div>
                    )}

                    {isAgentHere && !isDead && (
                      <div className="k-agent">🤖</div>
                    )}
                    {isDead && <div className="k-agent dead">☠️</div>}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div onClick={() => setShowModal(true)} className="result-panel">
          {!displayResult && (
            <div className="result-placeholder">
              No result yet — run the simulation.
            </div>
          )}
          {displayResult && (
            <>
              <div
                className={`result-header ${
                  displayResult.alive ? "alive" : "dead"
                }`}
              >
                {displayResult.returned_home &&
                  "🏆 Agent returned home with the gold!"}
                {!displayResult.returned_home &&
                  displayResult.gold_found &&
                  "💰 Gold found, but agent did not return home"}
                {!displayResult.gold_found &&
                  displayResult.alive &&
                  "🤖 Agent is alive, but failed to find gold"}
                {!displayResult.alive &&
                  `☠️ Agent died due to ${displayResult.death_cause}`}
              </div>
              <div className="result-grid">
                <div>
                  <span>Steps</span>
                  <b>{displayResult.steps}</b>
                </div>
                <div>
                  <span>Gold</span>
                  <b>{displayResult.gold_found ? "Yes" : "No"}</b>
                </div>
                <div>
                  <span>Returned</span>
                  <b>{displayResult.returned_home ? "Yes" : "No"}</b>
                </div>
                <div>
                  <span>Alive</span>
                  <b>{displayResult.alive ? "Yes" : "No"}</b>
                </div>
                <div>
                  <span>Arrows left</span>
                  <b>{displayResult.arrows_left}</b>
                </div>
                <div>
                  <span>Arrows collected</span>
                  <b>{displayResult.total_arrows_collected}</b>
                </div>
                <div>
                  <span>Wumpus killed</span>
                  <b>{displayResult.wumpus_killed}</b>
                </div>
                <div
                  style={{ cursor: "pointer" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPath((v) => !v);
                  }}
                  title="Click to toggle agent path"
                >
                  <span>Path length</span>
                  <b>
                    {displayResult.path.length}
                    {showPath && " 👁️"}
                  </b>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      <HistoryResult show={showModal} setShow={setShowModal} />
    </>
  );
}
