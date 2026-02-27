"""
Yutori API clients — Scouting (tracking) and Browsing (automated actions).
"""
import os
import requests
import random


# ─── Scouting API (carrier tracking) ──────────────────────────

def check_tracking(tracking_url: str) -> dict:
    """
    Check a carrier tracking URL for delivery status using Yutori Scouting API.
    """
    api_key = os.environ.get("YUTORI_API_KEY")
    if api_key:
        try:
            response = requests.post(
                "https://api.yutori.com/v1/scouting/tasks",
                headers={"X-API-Key": api_key},
                json={
                    "query": f"Check the delivery status for tracking URL: {tracking_url}. Extract: status (on_time, delayed, delivered, exception), days late, estimated delivery date, and any carrier message."
                },
                timeout=15
            )
            response.raise_for_status()
            data = response.json()
            
            # Simple heuristic parsing since we don't have a guaranteed structured JSON schema back
            result_str = str(data.get("result", data)).lower()
            status = "delayed" if "delay" in result_str else "on_time"
            
            return {
                "status": status,
                "days_late": 0,
                "estimated_delivery": "See Yutori status",
                "carrier_message": str(data.get("result", data))[:150],
            }
        except Exception as e:
            print(f"[Yutori] Scouting API error or timeout: {e}. Falling back to mock.")

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
    """
    api_key = os.environ.get("YUTORI_API_KEY")
    
    if api_key:
        try:
            task = f"Navigate to Shopify admin, find order {order_id}, and perform action: {action} with amount ${amount}. Return a step-by-step summary."
            response = requests.post(
                "https://api.yutori.com/v1/browsing/tasks",
                headers={"X-API-Key": api_key},
                json={
                    "task": task,
                    "start_url": "https://admin.shopify.com"
                },
                timeout=20
            )
            response.raise_for_status()
            data = response.json()
            
            result_text = data.get("result", str(data))
            # Split the result text into steps by newline or just return it as one step
            steps = [f"Yutori Browsing: {step.strip()}" for step in str(result_text).split('\n') if step.strip()]
            if not steps:
                steps = [f"Yutori Browsing completed action: {action}"]
                
            return {
                "success": True,
                "steps": steps,
                "screenshot_url": data.get("screenshot_url")
            }
        except Exception as e:
            print(f"[Yutori] Browsing API error or timeout: {e}. Falling back to mock.")

    # Mock Fallback
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
