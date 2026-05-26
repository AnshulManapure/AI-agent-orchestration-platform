from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from contextlib import asynccontextmanager
from app.core.database import engine, Base
from app.api.agents import router as agents_router
from app.api.workflows import router as workflows_router
from app.api.runs import router as runs_router


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
    yield

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

@app.get("/health")
async def health():
    return {"status": "ok"}