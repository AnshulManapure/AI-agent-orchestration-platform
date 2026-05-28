from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from contextlib import asynccontextmanager
import asyncio

from app.channels.telegram import create_telegram_app
from app.core.database import engine, Base
from app.core.database import AsyncSessionLocal
from app.core.seed import seed_templates
from app.api.agents import router as agents_router
from app.api.workflows import router as workflows_router
from app.api.runs import router as runs_router
from app.api.monitor import router as monitor_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    for attempt in range(5):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            break
        except Exception as e:
            if attempt == 4:
                raise
            print(f"DB not ready, retrying in 3s... ({e})")
            await asyncio.sleep(3)

    # Seed templates
    async with AsyncSessionLocal() as db:
        await seed_templates(db)

    # Start Telegram bot
    telegram_app = create_telegram_app()
    await telegram_app.initialize()
    await telegram_app.start()
    await telegram_app.updater.start_polling()

    yield

    await telegram_app.updater.stop()
    await telegram_app.stop()
    await telegram_app.shutdown()

app = FastAPI(title="Yuno Agent Platform", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents_router)
app.include_router(workflows_router)
app.include_router(runs_router)
app.include_router(monitor_router)

@app.get("/health")
async def health():
    return {"status": "ok"}