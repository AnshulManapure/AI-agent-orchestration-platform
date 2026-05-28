from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.agent import Workflow

TEMPLATES = [
    {
        "name": "Research + Summary",
        "description": "A Researcher agent gathers information on a topic, then a Writer agent turns it into a clean, concise summary.",
        "is_template": True,
        "graph_config": {
            "agents": [],
            "edges": [],
            "template_roles": [
                {
                    "role": "researcher",
                    "name": "Researcher",
                    "system_prompt": "You are a research assistant. When given a topic, research it thoroughly and return a detailed summary of key facts.",
                    "position": {"x": 100, "y": 200}
                },
                {
                    "role": "writer",
                    "name": "Writer",
                    "system_prompt": "You are a professional writer. You take research notes and turn them into a clean, concise, well-structured summary a non-expert could understand.",
                    "position": {"x": 400, "y": 200}
                }
            ],
            "template_edges": [
                ["Researcher", "Writer"],
                ["Writer", "END"]
            ]
        }
    },
    {
        "name": "Support Triage",
        "description": "A Classifier agent reads a user message and routes it to either a FAQ agent or an Escalation agent based on content.",
        "is_template": True,
        "graph_config": {
            "agents": [],
            "edges": [],
            "template_roles": [
                {
                    "role": "classifier",
                    "name": "Classifier",
                    "system_prompt": "You are a support ticket classifier. Read the user message and determine if it is a simple FAQ (questions about pricing, features, hours) or needs escalation (complaints, billing issues, technical failures). Reply with only one word: FAQ or ESCALATE.",
                    "position": {"x": 100, "y": 200}
                },
                {
                    "role": "faq",
                    "name": "FAQ Agent",
                    "system_prompt": "You are a helpful FAQ agent. Answer common questions about our product clearly and concisely.",
                    "position": {"x": 400, "y": 100}
                },
                {
                    "role": "escalation",
                    "name": "Escalation Agent",
                    "system_prompt": "You are an escalation specialist. Acknowledge the user's issue with empathy, apologize for the inconvenience, and let them know a human agent will follow up within 24 hours.",
                    "position": {"x": 400, "y": 300}
                }
            ],
            "template_edges": [
                ["Classifier", "FAQ Agent"],
                ["FAQ Agent", "END"],
                ["Classifier", "Escalation Agent"],
                ["Escalation Agent", "END"]
            ]
        }
    }
]


async def seed_templates(db: AsyncSession):
    for template in TEMPLATES:
        result = await db.execute(
            select(Workflow).where(
                Workflow.name == template["name"],
                Workflow.is_template == True
            )
        )
        existing = result.scalar_one_or_none()
        if not existing:
            workflow = Workflow(**template)
            db.add(workflow)
    await db.commit()