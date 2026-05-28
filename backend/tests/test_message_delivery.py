import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from unittest.mock import AsyncMock, patch  # only in test_workflow_execution.py


async def test_get_messages_empty_run(client):
    response = await client.get("/workflows/runs/nonexistent-run-id/messages")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_workflow_runs(client):
    wf = await client.post("/workflows/", json={
        "name": "Runs List Test",
        "description": "test",
        "graph_config": {"agents": [], "edges": []},
        "is_template": False
    })
    workflow_id = wf.json()["id"]
    response = await client.get(f"/workflows/{workflow_id}/runs")
    assert response.status_code == 200
    assert isinstance(response.json(), list)