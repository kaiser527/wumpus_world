import socketio
import asyncio
from agent import Agent
import copy

def snapshot_agent(agent):
    return copy.deepcopy(agent)

# -----------------------------------
# Socket.IO setup 
# -----------------------------------

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*" 
)

app = socketio.ASGIApp(sio)

# -----------------------------------
# Global simulation state
# -----------------------------------

world = None
agent = None
running = False
history = []

# -----------------------------------
# Socket events
# -----------------------------------

@sio.event
async def connect(sid, environ):
    print("🟢 Connected:", sid)
    await sio.emit("connected", {"msg": "ready"}, to=sid)

@sio.event
async def disconnect(sid):
    print("🔴 Disconnected:", sid)

# -------- RECEIVE WORLD FROM FRONTEND --------

@sio.event
async def init_world(sid, data):
    global world, agent, running, history

    world = data["world"]
    arrows = data.get("arrows", 0)

    agent = Agent(world, arrows=arrows)
    history = []
    running = False

    print("🌍 World initialized")

    await sio.emit("world_ready", serialize_agent(agent), to=sid)

# -------- STEP-BY-STEP MODE --------

@sio.event
async def step(sid):
    global agent, history

    if not agent or not agent.alive:
        return

    history.append(snapshot_agent(agent))
    agent.next_move()
    
    await sio.emit("agent_update", serialize_agent(agent), to=sid)

# -------- AUTO-RUN MODE --------

@sio.event
async def start(sid):
    global running

    if running or not agent:
        return

    running = True
    asyncio.create_task(simulation_loop())

@sio.event
async def stop(sid):
    global running
    running = False
    
@sio.event
async def previous(sid):
    global agent, history

    if not history:
        return

    agent = history.pop()   
    await sio.emit("agent_update", serialize_agent(agent), to=sid)

# -----------------------------------
# Simulation loop
# -----------------------------------

async def simulation_loop():
    global running, agent, history

    while running and agent and agent.alive:
        history.append(snapshot_agent(agent))
        agent.next_move()
        
        await sio.emit("agent_update", serialize_agent(agent))

        if agent.gold_found and agent.pos == (0, 0):
            print("🏆 Agent returned home with gold")
            break

        await asyncio.sleep(0.5)

    running = False

    if agent:
        await sio.emit("simulation_end", {
            "alive": agent.alive,
            "gold_found": agent.gold_found,
            "returned_home": agent.pos == (0, 0) and agent.gold_found,
            "steps": agent.steps,
            "path": agent.path,
            "death_cause": agent.death_cause,
            "arrows_left": agent.arrows,
            "total_arrows_collected": agent.total_arrows_collected,
            "wumpus_killed": agent.wumpus_kill_count
        })

# -----------------------------------
# Serialization
# -----------------------------------

def serialize_agent(agent: Agent):
    return {
        "world": agent.world,
        "size": agent.size,
        "pos": list(agent.pos),
        "path": [list(p) for p in agent.path],
        "alive": agent.alive,

        "arrows": agent.arrows,
        "gold_found": agent.gold_found,
        "returning": agent.returning,
        "steps": agent.steps,
        "max_steps": agent.max_steps,
        "mode": agent.mode,
        "action": agent.action,
        "death_cause": agent.death_cause,

        "arrow_positions": [list(p) for p in agent.arrow_positions],
        "killed_wumpus_positions": [list(p) for p in agent.killed_wumpus_positions],
        "wumpus_kill_count": agent.wumpus_kill_count,
        "total_arrows_collected": agent.total_arrows_collected,

        "knowledge": [
            [
                {
                    "visited": c["visited"],
                    "safe": c["safe"],
                    "confirmed_pit": c["confirmed_pit"],
                    "confirmed_wumpus": c["confirmed_wumpus"],
                    "percepts": c["percepts"],
                    "p_pit": c["p_pit"],
                    "p_wumpus": c["p_wumpus"],
                }
                for c in row
            ]
            for row in agent.knowledge
        ]
    }
