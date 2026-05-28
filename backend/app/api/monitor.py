import json
import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.config import settings

router = APIRouter(prefix="/monitor", tags=["monitor"])


@router.websocket("/ws/{run_id}")
async def monitor_run(websocket: WebSocket, run_id: str):
    await websocket.accept()
    redis_client = aioredis.from_url(settings.REDIS_URL)
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(f"run:{run_id}")

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                await websocket.send_text(message["data"].decode("utf-8"))
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(f"run:{run_id}")
        await redis_client.aclose()