from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_db
from app.models.agent import Agent, Workflow, WorkflowRun
from app.runtime.engine import run_workflow

router = APIRouter(prefix="/runs", tags=["runs"])


class RunCreate(BaseModel):
    workflow_id: str
    input_message: str


@router.post("/")
async def start_run(payload: RunCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == payload.workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    config = workflow.graph_config
    agent_ids = config.get("agents", [])
    edges = [tuple(e) for e in config.get("edges", [])]

    agent_results = await db.execute(select(Agent).where(Agent.id.in_(agent_ids)))
    agents = agent_results.scalars().all()

    if not agents:
        raise HTTPException(status_code=400, detail="Workflow has no agents configured")

    agent_map = {a.id: a for a in agents}
    ordered_agents = [agent_map[aid] for aid in agent_ids if aid in agent_map]

    run = WorkflowRun(
        workflow_id=workflow.id,
        status="running",
        started_at=datetime.utcnow()
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    try:
        await run_workflow(
            agents=ordered_agents,
            edges=edges,
            input_message=payload.input_message,
            run_id=run.id,
            db=db
        )
        run.status = "completed"
        run.completed_at = datetime.utcnow()
    except Exception as e:
        run.status = "failed"
        run.completed_at = datetime.utcnow()
        await db.commit()
        raise HTTPException(status_code=500, detail=str(e))

    await db.commit()
    return {"run_id": run.id, "status": run.status}