"""
Yutori API clients — Scouting (tracking) and Browsing (automated actions).

Both are mocked with clean interfaces so we can swap in real
Yutori API calls at the hackathon once we have the docs.
"""
import random


# ─── Scouting API (carrier tracking) ──────────────────────────

def check_tracking(tracking_url: str) -> dict:
    """
    Check a carrier tracking URL for delivery status.

    MOCK: Returns a static "on_time" result. The /api/trigger-delay
    endpoint will override this to simulate delays during the demo.

    Real implementation: POST to Yutori Scouting API with the tracking URL,
    receive structured status back.

    Returns:
        {
            "status": "on_time" | "delayed" | "delivered" | "exception",
            "days_late": int,
            "estimated_delivery": str,
            "carrier_message": str
        }
    """
    # Default mock: everything is on time
    return {
        "status": "on_time",
        "days_late": 0,
        "estimated_delivery": "2026-03-03",
        "carrier_message": "Package is on schedule for delivery.",
    }


# ─── Browsing API (autonomous Shopify admin actions) ───────────

def execute_shopify_action(action: str, order_id: str, amount: float = 0) -> dict:
    """
    Use Yutori Browsing API to navigate Shopify admin and perform an action.

    MOCK: Returns a successful result with simulated browsing steps.

    Real implementation: POST to Yutori Browsing API with instructions like
    "Navigate to Shopify admin, find order {order_id}, apply credit of ${amount}"

    Returns:
        {
            "success": bool,
            "steps": list[str],  # browsing steps for the activity feed
            "screenshot_url": str | None
        }
    """
    if action == "apply_credit":
        steps = [
            f"Navigating to Shopify admin panel...",
            f"Searching for Order {order_id}...",
            f"Found order — opening details...",
            f"Clicking 'Apply Credit' button...",
            f"Entering credit amount: ${amount:.2f}...",
            f"Confirming credit application...",
            f"Credit of ${amount:.2f} applied successfully ✓",
        ]
    elif action == "process_refund":
        steps = [
            f"Navigating to Shopify admin panel...",
            f"Searching for Order {order_id}...",
            f"Found order — opening details...",
            f"Clicking 'Refund' button...",
            f"Entering refund amount: ${amount:.2f}...",
            f"Selecting refund reason: Shipping delay...",
            f"Processing refund...",
            f"Refund of ${amount:.2f} processed successfully ✓",
        ]
    else:
        steps = [f"Action '{action}' completed on Order {order_id} ✓"]

    return {
        "success": True,
        "steps": steps,
        "screenshot_url": None,
    }
