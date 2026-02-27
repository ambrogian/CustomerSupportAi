"""
Senso knowledge base client — local JSON fallback for delay policies,
VIP multiplier, and brand voice rules.

Uses the Senso CLI (installed via npx) if SENSO_API_KEY is available.
"""
import os
import json
import subprocess

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


def _get_local_policy(delay_days: int, customer_tier: str) -> dict:
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


def get_policy(delay_days: int, customer_tier: str) -> dict:
    """
    Look up the applicable compensation policy based on delay duration
    and customer tier using Senso CLI, or fallback locally.
    """
    api_key = os.environ.get("SENSO_API_KEY")
    if not api_key:
        return _get_local_policy(delay_days, customer_tier)

    # We have an API key, so we try the CLI
    try:
        query = f"What is our refund policy and recommended credit amount for a package that is {delay_days} days late for a {customer_tier} customer?"
        # The CLI relies on the API key being in the environment
        env = os.environ.copy()
        
        result = subprocess.run(
            ["npx", "--yes", "@senso-ai/cli", "search", query, "--output", "json", "--quiet"],
            capture_output=True,
            text=True,
            timeout=15,
            check=True,
            env=env,
            shell=True if os.name == 'nt' else False
        )
        data = json.loads(result.stdout)
        
        answer = data.get("answer", "")
        # If Senso had no answer or KB was empty, fallback
        if not answer or "No results found" in answer:
            print("[Senso] No KB results found for query, using fallback.")
            return _get_local_policy(delay_days, customer_tier)
            
        # We got an answer from Senso.
        # Since Senso returns a free-text AI answer, we'll embed it into the policy dict
        # and let the orchestrator prompt use 'senso_answer' directly if we want,
        # but for compatibility with our UI (which shows $ credit), we'll gracefully fallback
        # for structured fields while injecting the textual voice.
        
        fallback = _get_local_policy(delay_days, customer_tier)
        fallback["brand_voice"] = answer  # Use Senso's response as policy guidance
        fallback["policy_source"] = "senso_api"
        return fallback

    except Exception as e:
        print(f"[Senso] CLI error: {e}. Falling back to local policy.")
        return _get_local_policy(delay_days, customer_tier)


def get_full_knowledge_base() -> dict:
    """Return the full KB for context injection into the orchestrator prompt."""
    return KNOWLEDGE_BASE
