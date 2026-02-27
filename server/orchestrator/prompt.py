"""
GPT-4o system prompt for the Resolve orchestrator.
Splits into PROACTIVE and REACTIVE based on whether a user messaged first.
"""
import json

PROACTIVE_PROMPT = """You are Resolve, an autonomous CS agent for a DTC sneaker brand.
You are monitoring orders autonomously. No customer has messaged yet.
Your job: decide whether to act and draft a proactive outreach message.
Be warm but brief. The customer didn't ask for this — make it feel helpful, 
not alarming.
"""

REACTIVE_PROMPT = """You are Resolve, an autonomous CS agent for a DTC sneaker brand.
A customer has sent you a message. They are expecting a response.
Your job: understand what they need, check their history, and resolve it.
Be conversational. Match the customer's energy — if they're frustrated, 
acknowledge it directly before solving.
"""

def build_user_prompt(
    graph_context: dict,
    policy: dict,
    customer_message: str,
    source: str = "reactive",
    external_context: str = None
) -> tuple[str, str]:
    """
    Build the system and user messages that include all context for GPT-4o.
    Returns (system_prompt, user_prompt).
    """
    system_prompt = PROACTIVE_PROMPT if source == "proactive" else REACTIVE_PROMPT
    
    # Safely get properties
    name = graph_context.get("name", "Customer")
    tier = graph_context.get("tier", "standard")
    ltv = graph_context.get("ltv", 0)
    total_orders = graph_context.get("totalOrders", 0)
    total_issues = graph_context.get("totalIssues", 0)
    total_credits = graph_context.get("totalCreditsGiven", 0)
    issue_history = graph_context.get("issueHistory", [])
    
    # Format issue history
    last_issues = issue_history[-3:]
    issue_history_str = "\n".join([
        f"- {i.get('issueType', 'Issue')} → {i.get('resolution', 'Unknown')} (${i.get('credit', 0)} credit) on {i.get('date', 'Unknown date')}"
        for i in last_issues
    ]) if last_issues else "- None"

    # Default policy fallback if None
    policy_str = ""
    if policy:
        delay_policies = policy.get("credit", 0)  # Use credit as placeholder if delay_policies dict doesn't exist
        vip_mult = 2 if tier == "vip" else 1
        max_approve = policy.get("auto_approve_refund_threshold", 150)
        policy_str = (
            f"CURRENT POLICY:\n"
            f"- Delay tier compensation standard: ${delay_policies}\n"
            f"- VIP multiplier: {vip_mult}x\n"
            f"- Max auto-approve: ${max_approve}\n"
        )
    
    components = [
        f"CUSTOMER PROFILE (from knowledge graph):",
        f"- Name: {name}",
        f"- Tier: {tier}",
        f"- Lifetime Value: ${ltv:,.2f}",
        f"- Total Orders: {total_orders}",
        f"- Past Issues: {total_issues}",
        f"- Total Credits Already Given: ${total_credits:,.2f}",
        f"\nISSUE HISTORY (last 3):",
        issue_history_str,
        f"\n{policy_str}",
        f"GRAPH-INFORMED RULES (apply these based on the data above):",
        "- If totalCreditsGiven > $100 in last 30 days → flag for human review even if under auto-approve threshold",
        "- If this is customer's 2nd+ issue → add a personal acknowledgment: \"We know this isn't the first time we've let you down...\"",
        "- If customer has 10+ orders and 0 prior issues → treat as implicit VIP regardless of tier label",
        "- If last resolution was a refund → do NOT offer another refund for same order type, offer replacement instead",
        "- If totalIssues = 0 → this is their first bad experience, be especially warm",
        "- If the order is 10 or more days late -> action = file_carrier_claim",
        "\nRESPONSE RULES:",
        "- Output ONLY valid JSON: { \"action\", \"message\", \"creditAmount\", \"requiresHumanReview\", \"reasoning\" }",
        "- The 'action' string must be one of: send_message | apply_credit | process_refund | escalate | file_carrier_claim",
        "- Use first name. Never say \"I apologize for the inconvenience.\"",
        "- Explain credits in plain English.",
        "- reasoning field must reference specific graph data: \"Customer has had 2 prior issues and received $30 in credits. Escalating to human review to avoid credit abuse.\""
    ]

    if external_context:
        components.append(f"\nEXTERNAL CONTEXT:\n{external_context}")

    components.append(f"\nCUSTOMER MESSAGE (or PROACTIVE TRIGGER):\n{customer_message}")

    return system_prompt, "\n".join(components)
