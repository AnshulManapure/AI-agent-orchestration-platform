import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from unittest.mock import AsyncMock, patch
from app.main import app
from unittest.mock import AsyncMock, patch  # only in test_workflow_execution.py


async def test_create_workflow(client):
    response = await client.post("/workflows/", json={
        "name": "Test Workflow",
        "description": "A test workflow",
        "graph_config": {"agents": [], "edges": []},
        "is_template": False
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Workflow"
    assert "id" in data


async def test_list_templates(client):
    # Seed one template directly
    await client.post("/workflows/", json={
        "name": "Research + Summary",
        "description": "Test template",
        "graph_config": {"agents": [], "edges": []},
        "is_template": True
    })
    response = await client.get("/workflows/templates")
    assert response.status_code == 200
    templates = response.json()
    assert isinstance(templates, list)
    assert len(templates) >= 1


async def test_run_invalid_workflow(client):
    response = await client.post("/runs/", json={
        "workflow_id": "nonexistent-id",
        "input_message": "test"
    })
    assert response.status_code == 404


async def test_run_workflow_no_agents(client):
    create = await client.post("/workflows/", json={
        "name": "Empty Workflow",
        "description": "No agents",
        "graph_config": {"agents": [], "edges": []},
        "is_template": False
    })
    workflow_id = create.json()["id"]
    response = await client.post("/runs/", json={
        "workflow_id": workflow_id,
        "input_message": "test"
    })
    assert response.status_code == 400


async def test_run_workflow_success(client):
    r1 = await client.post("/agents/", json={
        "name": "Runner Agent 1",
        "role": "researcher",
        "system_prompt": "Respond with a single sentence about the topic.",
        "model": "gemini-2.5-flash",
        "tools": [], "channel": None, "memory_enabled": False
    })
    r2 = await client.post("/agents/", json={
        "name": "Runner Agent 2",
        "role": "writer",
        "system_prompt": "Summarize the input in one sentence.",
        "model": "gemini-2.5-flash",
        "tools": [], "channel": None, "memory_enabled": False
    })
    a1_id = r1.json()["id"]
    a2_id = r2.json()["id"]
    a1_name = r1.json()["name"]
    a2_name = r2.json()["name"]

    wf = await client.post("/workflows/", json={
        "name": "Execution Test Workflow",
        "description": "Tests real execution",
        "graph_config": {
            "agents": [a1_id, a2_id],
            "edges": [[a1_name, a2_name], [a2_name, "END"]]
        },
        "is_template": False
    })
    workflow_id = wf.json()["id"]

    with patch("app.api.runs.run_workflow", new_callable=AsyncMock) as mock_run:
        mock_run.return_value = None
        response = await client.post("/runs/", json={
            "workflow_id": workflow_id,
            "input_message": "Tell me about transformers"
        })

    assert response.status_code == 200
    assert response.json()["status"] == "completed"