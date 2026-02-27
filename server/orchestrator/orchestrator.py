"""
Main orchestrator — the brain of Resolve.

Flow:
  1. Query Neo4j for customer context
  2. Query Senso for applicable policy (optional, based on delay_days)
  3. Build prompt with all context
  4. Call GPT-4o → structured JSON decision
  5. Execute action (write Issue + Resolution to Neo4j)
  6. Return decision
"""
from server.neo4j_db.queries import (
    get_customer_context,
    create_issue_node,
    create_resolution_node,
)
from server.integrations.openai_client import call_llm
from server.integrations.senso import get_policy
from server.integrations.tavily import search_web
from server.websocket.events import emit_tavily_search
from server.orchestrator.prompt import SYSTEM_PROMPT, build_user_prompt


def orchestrate(
    customer_id: str,
    customer_message: str,
    delay_days: int = 0,
    order_id: str = None,
    external_context: str = None,
) -> dict:
    """
    Run the full orchestration pipeline.

    Args:
        customer_id: Neo4j customer ID
        customer_message: What the customer said (or auto-generated for proactive)
        delay_days: If coming from the agent loop, how many days late
        order_id: If tied to a specific order
        external_context: Extra context (Tavily search results, etc.)

    Returns:
        {
            "action": str,
            "message": str,
            "creditAmount": float,
            "requiresHumanReview": bool,
            "reasoning": str,
            "customer_context": dict,  # for the dashboard
            "policy": dict | None
        }
    """
    # Step 1: Get full customer context from Neo4j
    try:
        ctx = get_customer_context(customer_id)
    except RuntimeError:
        # Neo4j unavailable — use demo fallback context
        _demo_customers = {
            "customer-001": {"name": "Sarah Chen", "tier": "vip", "email": "sarah@demo.com"},
            "customer-002": {"name": "Marcus Johnson", "tier": "standard", "email": "marcus@demo.com"},
            "customer-003": {"name": "Priya Patel", "tier": "vip", "email": "priya@demo.com"},
        }
        cust = _demo_customers.get(customer_id)
        ctx = {"customer": cust, "orders": [], "issues": [], "resolutions": []} if cust else None

    if ctx is None:
        return {
            "action": "escalate",
            "message": "Customer not found.",
            "creditAmount": 0,
            "requiresHumanReview": True,
            "reasoning": f"No customer found with ID {customer_id}",
            "customer_context": None,
            "policy": None,
        }

    # Step 2: Get applicable policy and external context if there's a delay
    policy = None
    if delay_days > 0:
        tier = ctx["customer"].get("tier", "standard")
        policy = get_policy(delay_days, tier)
        
        # Step 2.5: Search the web for context (carrier delays, weather) if none provided
        if not external_context:
            carrier = "shipping"
            if order_id and ctx.get("orders"):
                order = next((o for o in ctx["orders"] if o.get("id") == order_id), None)
                if order and order.get("carrier"):
                    carrier = order["carrier"]
            
            query = f"{carrier} shipping delays weather news"
            emit_tavily_search(query)
            search_res = search_web(query)
            
            if search_res.get("results"):
                external_context = f"Recent web search results for '{query}':\n"
                for r in search_res["results"]:
                    external_context += f"- {r['title']}: {r['snippet']}\n"

    # Step 3: Build the prompt
    user_prompt = build_user_prompt(
        customer_context=ctx,
        customer_message=customer_message,
        policy=policy,
        external_context=external_context,
    )

    # Step 4: Call GPT-4o
    decision = call_llm(SYSTEM_PROMPT, user_prompt)

    # Ensure all fields are present with defaults
    decision.setdefault("action", "send_message")
    decision.setdefault("message", "")
    decision.setdefault("creditAmount", 0)
    decision.setdefault("requiresHumanReview", False)
    decision.setdefault("reasoning", "")

    # Step 5: Write Issue + Resolution to Neo4j if we have an order
    if order_id:
        try:
            issue_id = create_issue_node(order_id, {
                "type": "late_delivery" if delay_days > 0 else "customer_inquiry",
                "description": customer_message[:200],
            })

            create_resolution_node(issue_id, {
                "action": decision["action"],
                "creditAmount": decision["creditAmount"],
                "message": decision["message"],
            })
        except RuntimeError:
            pass  # Neo4j unavailable — skip graph writes

    # Step 6: Return the full decision with context
    decision["customer_context"] = ctx
    decision["policy"] = policy
    return decision
