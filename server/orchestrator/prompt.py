"""
GPT-4o system prompt for the Resolve orchestrator.
"""

SYSTEM_PROMPT = """You are Resolve, an autonomous customer service agent for a DTC sneaker brand.
You have access to the customer's full history, order status, and company policy.
Your job is to decide the best action to take and draft the customer message.

Rules:
- Always check LTV and tier before deciding compensation level
- VIP customers get 2x the standard credit
- Never approve refunds over $150 without flagging for human review
- Match the brand voice: warm, direct, use first name, never robotic
- Never say "I apologize for the inconvenience"
- If you apply a credit or refund, always explain why in plain English
- Output ONLY valid JSON matching this schema:

{
  "action": "send_message" | "apply_credit" | "process_refund" | "escalate",
  "message": "<customer-facing message>",
  "creditAmount": <number>,
  "requiresHumanReview": <boolean>,
  "reasoning": "<internal reasoning for the activity feed, not shown to customer>"
}
"""


def build_user_prompt(
    customer_context: dict,
    customer_message: str,
    policy: dict = None,
    external_context: str = None,
) -> str:
    """
    Build the user-side message that includes all context for GPT-4o.
    """
    customer = customer_context.get("customer", {})
    orders = customer_context.get("orders", [])
    issues = customer_context.get("issues", [])
    resolutions = customer_context.get("resolutions", [])

    parts = []
    parts.append("=== CUSTOMER CONTEXT ===")
    parts.append(f"Name: {customer.get('name', 'Unknown')}")
    parts.append(f"Email: {customer.get('email', 'N/A')}")
    parts.append(f"Tier: {customer.get('tier', 'standard')}")
    parts.append(f"LTV: ${customer.get('ltv', 0):,.2f}")
    parts.append(f"Prior issues: {len(issues)}")

    if orders:
        parts.append("\\n=== ORDERS ===")
        for o in orders:
            parts.append(
                f"- Order {o.get('id')}: {o.get('product')} | "
                f"Status: {o.get('status')} | Carrier: {o.get('carrier')} | "
                f"Total: ${o.get('total', 0):.2f}"
            )

    if issues:
        parts.append("\\n=== ISSUE HISTORY ===")
        for i in issues:
            parts.append(
                f"- [{i.get('status')}] {i.get('type')}: {i.get('description')}"
            )

    if resolutions:
        parts.append("\\n=== RESOLUTION HISTORY ===")
        for r in resolutions:
            parts.append(
                f"- {r.get('action')}: credit ${r.get('creditApplied', 0)} — "
                f"{r.get('message', '')[:80]}"
            )

    if policy:
        parts.append("\\n=== APPLICABLE POLICY ===")
        parts.append(f"Recommended action: {policy.get('action')}")
        parts.append(f"Credit amount: ${policy.get('credit', 0):.2f}")
        parts.append(f"Brand voice: {policy.get('brand_voice', '')}")
        parts.append(
            f"Auto-approve refund threshold: ${policy.get('auto_approve_refund_threshold', 150)}"
        )

    # Call history
    calls = customer_context.get("calls", [])
    if calls:
        parts.append("\\n=== CALL HISTORY ===")
        for c in calls:
            initiated = c.get("initiatedBy", "unknown")
            duration = c.get("duration", 0)
            started = c.get("startedAt", "N/A")
            parts.append(
                f"- Call on {started[:10]} | Duration: {duration}s | Initiated by: {initiated}"
            )

    # Transcript summaries from past calls
    transcripts = customer_context.get("transcripts", [])
    transcript_summaries = [t for t in transcripts if t.get("summary")]
    if transcript_summaries:
        parts.append("\\n=== RECENT TRANSCRIPT SUMMARIES ===")
        for t in transcript_summaries:
            parts.append(f"- [{t.get('createdAt', 'N/A')[:10]}] {t.get('summary', '')[:200]}")

    if external_context:
        parts.append(f"\\n=== EXTERNAL CONTEXT ===\\n{external_context}")

    parts.append(f"\\n=== CUSTOMER MESSAGE ===\\n{customer_message}")

    return "\\n".join(parts)
