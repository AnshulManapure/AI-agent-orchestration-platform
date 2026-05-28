import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from app.main import app
from unittest.mock import AsyncMock, patch  # only in test_workflow_execution.py


async def test_create_agent(client):
    response = await client.post("/agents/", json={
        "name": "Test Agent",
        "role": "tester",
        "system_prompt": "You are a test agent.",
        "model": "gemini-2.5-flash",
        "tools": [],
        "channel": None,
        "memory_enabled": False
    })
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Agent"
    assert "id" in data


async def test_list_agents(client):
    response = await client.get("/agents/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


async def test_get_agent(client):
    create = await client.post("/agents/", json={
        "name": "Get Test Agent",
        "role": "tester",
        "system_prompt": "You are a test agent.",
        "model": "gemini-2.5-flash",
        "tools": [],
        "channel": None,
        "memory_enabled": False
    })
    agent_id = create.json()["id"]
    response = await client.get(f"/agents/{agent_id}")
    assert response.status_code == 200
    assert response.json()["id"] == agent_id


async def test_update_agent(client):
    create = await client.post("/agents/", json={
        "name": "Update Test Agent",
        "role": "tester",
        "system_prompt": "Original prompt.",
        "model": "gemini-2.5-flash",
        "tools": [],
        "channel": None,
        "memory_enabled": False
    })
    agent_id = create.json()["id"]
    response = await client.patch(f"/agents/{agent_id}", json={
        "system_prompt": "Updated prompt."
    })
    assert response.status_code == 200
    assert response.json()["system_prompt"] == "Updated prompt."


async def test_delete_agent(client):
    create = await client.post("/agents/", json={
        "name": "Delete Test Agent",
        "role": "tester",
        "system_prompt": "To be deleted.",
        "model": "gemini-2.5-flash",
        "tools": [],
        "channel": None,
        "memory_enabled": False
    })
    agent_id = create.json()["id"]
    delete = await client.delete(f"/agents/{agent_id}")
    assert delete.status_code == 200
    get = await client.get(f"/agents/{agent_id}")
    assert get.status_code == 404


async def test_get_nonexistent_agent(client):
    response = await client.get("/agents/nonexistent-id")
    assert response.status_code == 404