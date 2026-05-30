from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
import json
import redis.asyncio as aioredis
from app.core.config import settings
from app.core.database import get_db, AsyncSessionLocal
from app.models.agent import Agent, Workflow, WorkflowRun, AgentMessage
from app.runtime.engine import run_workflow

router = APIRouter(prefix="/runs", tags=["runs"])


class RunCreate(BaseModel):
    workflow_id: str
    input_message: str


@router.post("/")
async def start_run(
    payload: RunCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    # 1. Load workflow
    result = await db.execute(select(Workflow).where(Workflow.id == payload.workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    # 2. Load agents
    config = workflow.graph_config
    agent_ids = config.get("agents", [])
    edges = [tuple(e) for e in config.get("edges", [])]

    agent_results = await db.execute(select(Agent).where(Agent.id.in_(agent_ids)))
    agents = agent_results.scalars().all()

    if not agents:
        raise HTTPException(status_code=400, detail="Workflow has no agents configured")

    agent_map = {a.id: a for a in agents}
    ordered_agents = [agent_map[aid] for aid in agent_ids if aid in agent_map]

    # 3. Create run record
    run = WorkflowRun(
        workflow_id=workflow.id,
        status="running",
        started_at=datetime.utcnow()
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    # 4. Save user input as first message
    user_msg = AgentMessage(
        run_id=run.id,
        sender="user",
        recipient=ordered_agents[0].name,
        content=payload.input_message,
        tokens_used=0,
        timestamp=datetime.utcnow()
    )
    db.add(user_msg)
    await db.commit()

    # 5. Publish user message to Redis for live monitor
    redis_client = aioredis.from_url(settings.REDIS_URL)
    await redis_client.publish(f"run:{run.id}", json.dumps({
        "run_id": run.id,
        "sender": "user",
        "content": payload.input_message,
        "timestamp": datetime.utcnow().isoformat()
    }))
    await redis_client.aclose()

    # 6. Execute workflow in background
    async def execute():
        async with AsyncSessionLocal() as bg_db:
            try:
                await run_workflow(
                    agents=ordered_agents,
                    edges=edges,
                    input_message=payload.input_message,
                    run_id=run.id,
                    db=bg_db
                )
                result = await bg_db.execute(
                    select(WorkflowRun).where(WorkflowRun.id == run.id)
                )
                bg_run = result.scalar_one_or_none()
                if bg_run:
                    bg_run.status = "completed"
                    bg_run.completed_at = datetime.utcnow()
                    await bg_db.commit()
            except Exception as e:
                result = await bg_db.execute(
                    select(WorkflowRun).where(WorkflowRun.id == run.id)
                )
                bg_run = result.scalar_one_or_none()
                if bg_run:
                    bg_run.status = "failed"
                    bg_run.completed_at = datetime.utcnow()
                    await bg_db.commit()

    background_tasks.add_task(execute)

    return {"run_id": run.id, "status": "running"}