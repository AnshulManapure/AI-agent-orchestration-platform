import logging
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.models.agent import Agent, Workflow, WorkflowRun
from app.runtime.engine import run_workflow
from datetime import datetime

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Hello! I'm Conductor's Telegram agent.\n"
        "Send me any message and I'll run the research workflow on it."
    )


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user_message = update.message.text
    await update.message.reply_text("Running workflow, please wait...")

    async with AsyncSessionLocal() as db:
        # Find the first agent with telegram channel configured
        result = await db.execute(
            select(Agent).where(Agent.channel == "telegram")
        )
        telegram_agent = result.scalar_one_or_none()

        if not telegram_agent:
            await update.message.reply_text(
                "No Telegram agent configured. Please set channel='telegram' on an agent."
            )
            return

        # Find a workflow that contains this agent
        result = await db.execute(select(Workflow))
        workflows = result.scalars().all()

        target_workflow = None
        for wf in workflows:
            if telegram_agent.id in wf.graph_config.get("agents", []):
                target_workflow = wf
                break

        if not target_workflow:
            await update.message.reply_text("No workflow found for this agent.")
            return

        # Build agent list and edges
        config = target_workflow.graph_config
        agent_ids = config.get("agents", [])
        edges = [tuple(e) for e in config.get("edges", [])]

        agent_results = await db.execute(
            select(Agent).where(Agent.id.in_(agent_ids))
        )
        agents = agent_results.scalars().all()
        agent_map = {a.id: a for a in agents}
        ordered_agents = [agent_map[aid] for aid in agent_ids if aid in agent_map]

        # Create run record
        run = WorkflowRun(
            workflow_id=target_workflow.id,
            status="running",
            started_at=datetime.utcnow()
        )
        db.add(run)
        await db.commit()
        await db.refresh(run)

        # Execute workflow
        try:
            await run_workflow(
                agents=ordered_agents,
                edges=edges,
                input_message=user_message,
                run_id=run.id,
                db=db
            )
            run.status = "completed"
            run.completed_at = datetime.utcnow()
        except Exception as e:
            run.status = "failed"
            run.completed_at = datetime.utcnow()
            await db.commit()
            await update.message.reply_text(f"Workflow failed: {str(e)}")
            return

        await db.commit()

        # Fetch the last message (Writer's output) and send it back
        from app.models.agent import AgentMessage
        msg_result = await db.execute(
            select(AgentMessage)
            .where(AgentMessage.run_id == run.id)
            .order_by(AgentMessage.timestamp.desc())
        )
        last_msg = msg_result.scalars().first()

        if last_msg:
            await update.message.reply_text(last_msg.content)
        else:
            await update.message.reply_text("Workflow completed but no output was generated.")


def create_telegram_app():
    application = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    return application