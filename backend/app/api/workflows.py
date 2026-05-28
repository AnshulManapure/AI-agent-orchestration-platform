from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.database import get_db
from app.models.agent import Workflow, WorkflowRun, AgentMessage

router = APIRouter(prefix="/workflows", tags=["workflows"])


# -- Schemas --

class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    graph_config: dict = {}
    is_template: bool = False


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    graph_config: Optional[dict] = None
    is_template: Optional[bool] = None


class WorkflowResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    graph_config: dict
    is_template: bool

    class Config:
        from_attributes = True


class WorkflowRunResponse(BaseModel):
    id: str
    workflow_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    id: str
    run_id: str
    sender: str
    recipient: str
    content: str
    tokens_used: int

    class Config:
        from_attributes = True


# -- Routes --

@router.post("/", response_model=WorkflowResponse)
async def create_workflow(payload: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    workflow = Workflow(**payload.model_dump())
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return workflow


@router.get("/", response_model=list[WorkflowResponse])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow))
    return result.scalars().all()


@router.get("/templates", response_model=list[WorkflowResponse])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.is_template == True))
    return result.scalars().all()


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


@router.patch("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(workflow_id: str, payload: WorkflowUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(workflow, field, value)
    await db.commit()
    await db.refresh(workflow)
    return workflow


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(workflow)
    await db.commit()
    return {"deleted": workflow_id}


@router.get("/{workflow_id}/runs", response_model=list[WorkflowRunResponse])
async def list_runs(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkflowRun).where(WorkflowRun.workflow_id == workflow_id)
    )
    return result.scalars().all()


@router.get("/runs/{run_id}/messages", response_model=list[MessageResponse])
async def get_run_messages(run_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(AgentMessage).where(AgentMessage.run_id == run_id)
    )
    return result.scalars().all()