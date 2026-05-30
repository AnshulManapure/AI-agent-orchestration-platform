import json
import redis.asyncio as aioredis
from datetime import datetime
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from sqlalchemy.ext.asyncio import AsyncSession
from app.runtime.state import GraphState
from app.models.agent import Agent, AgentMessage
from app.core.config import settings


def get_llm():
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        google_api_key=settings.GEMINI_API_KEY
    )


def build_agent_node(agent: Agent, is_entry: bool = False):
    async def node(state: GraphState) -> GraphState:
        llm = get_llm()
        if is_entry:
            messages = [SystemMessage(content=agent.system_prompt)] + state["messages"]
        else:
            # Wrap the previous agent's output as a human message so Gemini accepts it
            last_content = state["messages"][-1].content
            if isinstance(last_content, list):
                last_content = " ".join(
                    block.get("text", "") if isinstance(block, dict) else str(block)
                    for block in last_content
                )
            messages = [
                SystemMessage(content=agent.system_prompt),
                HumanMessage(content=f"Here is the input for you to work with:\n\n{last_content}")
            ]
        response = await llm.ainvoke(messages)

        content = response.content
        if isinstance(content, list):
            content = " ".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in content
            )
        if not content:
            content = str(response)

        return {
            "messages": [response],
            "current_agent": agent.name,
            "run_id": state["run_id"],
            "metadata": state.get("metadata", {})
        }
    node.__name__ = agent.name
    return node


async def persist_message(db: AsyncSession, run_id: str, sender: str,
                           recipient: str, content: str, tokens: int = 0):
    msg = AgentMessage(
        run_id=run_id,
        sender=sender,
        recipient=recipient,
        content=content,
        tokens_used=tokens,
        timestamp=datetime.utcnow()
    )
    db.add(msg)
    await db.commit()


async def publish_message(redis_client, run_id: str, sender: str, content: str):
    payload = json.dumps({
        "run_id": run_id,
        "sender": sender,
        "content": content,
        "timestamp": datetime.utcnow().isoformat()
    })
    await redis_client.publish(f"run:{run_id}", payload)


async def run_workflow(
    agents: list[Agent],
    edges: list[tuple[str, str]],
    input_message: str,
    run_id: str,
    db: AsyncSession
):
    redis_client = aioredis.from_url(settings.REDIS_URL)

    agent_map = {a.name: a for a in agents}

    graph = StateGraph(GraphState)

    for i, agent in enumerate(agents):
        graph.add_node(agent.name, build_agent_node(agent, is_entry=(i == 0)))

    graph.set_entry_point(agents[0].name)

    for from_name, to_name in edges:
        if to_name == "END":
            graph.add_edge(from_name, END)
        else:
            graph.add_edge(from_name, to_name)

    compiled = graph.compile()

    initial_state: GraphState = {
        "messages": [HumanMessage(content=input_message)],
        "current_agent": "user",
        "run_id": run_id,
        "metadata": {}
    }

    async for state in compiled.astream(initial_state):
        for node_name, node_state in state.items():
            if node_name == "__end__":
                continue
            last_message = node_state["messages"][-1]
            
            content = last_message.content
            if isinstance(content, list):
                content = " ".join(
                    block.get("text", "") if isinstance(block, dict) else str(block)
                    for block in content
                )
            if not content:
                content = str(last_message)

            await persist_message(
                db=db,
                run_id=run_id,
                sender=node_name,
                recipient="next_agent",
                content=content
            )
            await publish_message(redis_client, run_id, node_name, content)
    
    # Signal completion
    await redis_client.publish(f"run:{run_id}", json.dumps({
        "run_id": run_id,
        "sender": "__system__",
        "content": "__done__",
        "timestamp": datetime.utcnow().isoformat()
    }))

    await redis_client.aclose()