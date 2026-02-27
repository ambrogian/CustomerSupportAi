"""
Senso knowledge base client — local JSON fallback for delay policies,
VIP multiplier, and brand voice rules.

Replace with actual Senso API calls when the real key is available.
"""

# ── Local policy data (mirrors what Senso KB would return) ─────
KNOWLEDGE_BASE = {
    "delay_policies": {
        "1_2_days_late": {"action": "send_apology", "credit": 0},
        "3_5_days_late": {"action": "send_apology_with_credit", "credit": 10},
        "6_plus_days_late": {"action": "offer_refund_or_replacement", "credit": 25},
    },
    "vip_multiplier": 2.0,
    "auto_approve_refund_threshold": 150,
    "brand_voice": (
        "warm, direct, never robotic. Use the customer's first name. "
        "Never say 'I apologize for the inconvenience'."
    ),
}


def get_policy(delay_days: int, customer_tier: str) -> dict:
    """
    Look up the applicable compensation policy based on delay duration
    and customer tier.

    Returns:
        {
            "action": str,
            "credit": float,
            "brand_voice": str,
            "auto_approve_refund_threshold": int,
            "policy_source": "senso_local_fallback"
        }
    """
    policies = KNOWLEDGE_BASE["delay_policies"]
    vip_mult = KNOWLEDGE_BASE["vip_multiplier"]

    if delay_days <= 0:
        base = {"action": "no_action_needed", "credit": 0}
    elif delay_days <= 2:
        base = policies["1_2_days_late"]
    elif delay_days <= 5:
        base = policies["3_5_days_late"]
    else:
        base = policies["6_plus_days_late"]

    # Apply VIP multiplier
    credit = base["credit"]
    if customer_tier == "vip" and credit > 0:
        credit = credit * vip_mult

    return {
        "action": base["action"],
        "credit": credit,
        "brand_voice": KNOWLEDGE_BASE["brand_voice"],
        "auto_approve_refund_threshold": KNOWLEDGE_BASE["auto_approve_refund_threshold"],
        "policy_source": "senso_local_fallback",
    }


def get_full_knowledge_base() -> dict:
    """Return the full KB for context injection into the orchestrator prompt."""
    return KNOWLEDGE_BASE
