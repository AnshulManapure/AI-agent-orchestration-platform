# Conductor

> AI Agent Orchestration Platform — Built for Yuno AI Engineer Challenge

Conductor is a platform for creating AI agents, connecting them into collaborative workflows, and running them autonomously. Agents communicate asynchronously through a LangGraph runtime, persist their message history, and stream live output to a web UI. A human can interact with any agent directly through Telegram.

---

## Demo

> https://www.loom.com/share/598e7c2696bc4a93bdf015e7f1c1760f (Expires in 14 days)
> https://drive.google.com/file/d/1jkgIeZ5CTXaRmB3o4btLsdc_qHVnoMqO/view?usp=sharing

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      React Frontend                          │
│        Agents · Visual Workflow Builder · Live Monitor       │
└────────────────────────┬────────────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼────────────────────────────────────┐
│                     FastAPI Backend                          │
│    /agents   /workflows   /runs   /monitor/ws/{run_id}      │
└──────┬──────────────┬──────────────────┬────────────────────┘
       │              │                  │
┌──────▼──────┐ ┌─────▼──────┐  ┌───────▼──────┐
│  LangGraph  │ │ PostgreSQL │  │    Redis     │
│  Runtime    │ │  (state)   │  │  (pub/sub)   │
└──────┬──────┘ └────────────┘  └──────────────┘
       │
┌──────▼──────┐
│  Telegram   │
│    Bot      │
└─────────────┘
```

### How it works

1. A user creates agents (name, role, system prompt, model, tools, channel) and connects them into a workflow using the visual graph builder.
2. When a run is triggered -- via the UI or Telegram -- the backend loads the workflow's `graph_config`, builds a LangGraph `StateGraph` at runtime, and executes it.
3. Each agent node calls Gemini, receives the previous agent's output as a `HumanMessage`, and returns its response as state.
4. After every node execution, the message is written to Postgres (permanent storage) and published to a Redis channel (real-time streaming).
5. The frontend Monitor page subscribes to that Redis channel via WebSocket and renders messages as they arrive.
6. The Telegram bot runs as a background task inside the FastAPI lifespan, polling for messages and routing them through the same workflow engine.

---

## Tech Stack & Decisions

### Language: Python + JavaScript

Python for the backend because the entire LangChain/LangGraph ecosystem is Python-native. Attempting this in another language would mean reimplementing the agent runtime from scratch. JavaScript (React) for the frontend because ReactFlow -- the best visual graph library available -- is JS-only.

### AI Runtime: LangGraph

LangGraph was chosen over CrewAI and AutoGen for three reasons:

1. **Explicit state management.** Every node receives a typed `GraphState` dict and returns a partial update. There is no hidden memory or implicit context -- the full conversation history is inspectable at every step.
2. **`astream` support.** LangGraph's async streaming yields state after each node, enabling live message publishing to Redis without polling.
3. **Graph compiled at runtime.** The `StateGraph` is built dynamically from the workflow's `graph_config`, meaning any user-defined agent topology works without code changes.

### AI Model: Gemini 2.5 Flash

Cost-efficient, fast, and available on the same Google AI Studio key used for development. The `langchain-google-genai` integration is a drop-in replacement for any other LangChain-compatible LLM -- swapping models requires changing one string.

### Backend: FastAPI

Async-native, which is required for SQLAlchemy's `asyncpg` driver and the WebSocket monitor endpoint. The auto-generated Swagger UI at `/docs` also serves as a live API reference during development.

### Persistence: PostgreSQL + Redis

PostgreSQL stores all permanent state: agents, workflows, runs, and messages. Redis handles ephemeral pub/sub -- the monitor WebSocket subscribes to `run:{run_id}` channels and receives messages in real time as the engine publishes them. Separating these concerns means the monitor works even if the DB write is slightly delayed.

### Messaging Channel: Telegram

Telegram's bot polling API requires no webhook, no public URL, and no SSL certificate -- it works entirely locally. The bot runs as a background coroutine inside the FastAPI lifespan, polling via `python-telegram-bot`. Any message sent to the bot triggers the same `run_workflow` function used by the REST API.

### Frontend: React + ReactFlow

ReactFlow provides the visual workflow builder canvas with drag-and-drop nodes, connection handles, and edge routing out of the box. The agent nodes are custom components that reflect live agent configuration (role, channel, model). The workflow's `graph_config` stores node positions alongside agent IDs and edges, so the canvas state is fully reconstructable from the DB.

---

## Setup

### Prerequisites

- Docker and Docker Compose
- A [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)

### 1. Clone and configure

```bash
git clone https://github.com/AnshulManapure/AI-agent-orchestration-platform.git
cd conductor
```

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql+asyncpg://yuno:yuno@postgres:5432/yuno_agents
REDIS_URL=redis://redis:6379
GEMINI_API_KEY=your-gemini-api-key
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

### 2. Start everything

```bash
docker compose up --build
```

This starts PostgreSQL, Redis, the FastAPI backend, and the React frontend. Tables are created automatically on first boot. Two workflow templates are seeded.

### 3. Access

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

---

## Usage

### Creating a workflow

1. Go to **Agents** and create at least two agents. Set `channel: telegram` on the agent you want to receive Telegram messages.
2. Go to **Workflows → + New Workflow**.
3. Click agents in the sidebar to add them to the canvas.
4. Drag from one node's handle to another to connect them.
5. Save the workflow.

### Running a workflow

**Via UI:** Go to **Monitor**, select your workflow, type an input message, and click **▶ Run**. Messages stream in live.

**Via Telegram:** Send any message to your bot. It finds the workflow containing the Telegram-enabled agent and runs it, replying with the final agent's output.

**Via API:**
```bash
curl -X POST http://localhost:8000/runs/ \
  -H "Content-Type: application/json" \
  -d '{"workflow_id": "<id>", "input_message": "Tell me about transformers"}'
```

---

## Pre-built Templates

Two templates are seeded on startup and visible under **Workflows → Templates**.

### Research + Summary

A two-agent pipeline for research tasks.

```
User → Researcher → Writer → END
```

- **Researcher** -- given a topic, produces a detailed summary of key facts
- **Writer** -- takes the research and produces a clean, non-expert-friendly summary

### Support Triage

A three-agent routing workflow for customer support.

```
User → Classifier → FAQ Agent → END
                 → Escalation Agent → END
```

- **Classifier** -- reads the user message and outputs `FAQ` or `ESCALATE`
- **FAQ Agent** -- handles simple questions
- **Escalation Agent** -- acknowledges complex issues and promises human follow-up

---

## Adding a New Workflow Template

1. Open `backend/app/core/seed.py`
2. Add a new entry to the `TEMPLATES` list following the existing structure:

```python
{
    "name": "Your Template Name",
    "description": "What this workflow does.",
    "is_template": True,
    "graph_config": {
        "agents": [],
        "edges": [],
        "template_roles": [
            {
                "role": "your_role",
                "name": "Agent Name",
                "system_prompt": "Your system prompt here.",
                "position": {"x": 100, "y": 200}
            }
        ],
        "template_edges": [
            ["Agent Name", "END"]
        ]
    }
}
```

3. Restart the backend. The template appears automatically.

---

## Adding a New Messaging Channel

1. Create `backend/app/channels/{channel_name}.py` following the pattern in `telegram.py`:
   - Implement message polling or webhook handling
   - Call `run_workflow()` from `app.runtime.engine`
   - Reply with the last `AgentMessage` content

2. Register the channel in `app/main.py` lifespan -- start it as a background task alongside the Telegram bot.

3. Add the channel name as a valid option in:
   - `AgentCreate` schema in `app/api/agents.py`
   - The channel dropdown in `frontend/src/pages/Agents.jsx`

---

## Running Tests

```bash
docker compose exec backend pytest tests/ -v
```

Tests cover agent CRUD, workflow execution (with mocked LLM), and message delivery. The test suite uses `httpx.AsyncClient` with ASGI transport to test the full request lifecycle without a live server.

---

## Project Structure

```
conductor/
├── docker-compose.yml
├── .env
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── conftest.py
│   ├── tests/
│   │   ├── test_agent_crud.py
│   │   ├── test_workflow_execution.py
│   │   └── test_message_delivery.py
│   └── app/
│       ├── main.py
│       ├── core/
│       │   ├── config.py        # Pydantic settings, env var loading
│       │   ├── database.py      # Async SQLAlchemy engine and session
│       │   └── seed.py          # Template seeding on startup
│       ├── models/
│       │   └── agent.py         # Agent, Workflow, WorkflowRun, AgentMessage
│       ├── api/
│       │   ├── agents.py        # Agent CRUD
│       │   ├── workflows.py     # Workflow CRUD + run history
│       │   ├── runs.py          # Workflow execution endpoint
│       │   └── monitor.py       # WebSocket live monitor
│       ├── runtime/
│       │   ├── engine.py        # LangGraph graph builder and executor
│       │   └── state.py         # GraphState TypedDict
│       └── channels/
│           └── telegram.py      # Telegram bot polling
└── frontend/
    └── src/
        ├── App.jsx              # Router and navigation
        ├── api/client.js        # Axios API client
        └── pages/
            ├── Agents.jsx       # Agent management
            ├── Workflows.jsx    # Visual workflow builder
            └── Monitor.jsx      # Live execution monitor
```

---

## Tradeoffs & Known Limitations

**Graph compiled dynamically.** The LangGraph `StateGraph` is rebuilt from `graph_config` on every run. This is clean and flexible but adds ~50ms per run. For production, compiled graphs should be cached.

**Linear execution only.** The current engine supports sequential agent chains. Conditional branching (as in the Support Triage template) is modelled in the UI but requires a routing function in the engine -- a natural next step using LangGraph's `add_conditional_edges`.

**Polling Telegram bot.** Using long polling instead of webhooks. Works perfectly locally but a production deployment should use webhooks with a public HTTPS endpoint for lower latency.

**No authentication.** The API has no auth layer. For production this would need JWT or API key middleware on all endpoints.
