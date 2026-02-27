"""
Autonomous agent loop — runs every 60 seconds in a background thread.

Flow per iteration:
  1. Fetch all orders from Neo4j
  2. For each non-delivered order, check tracking via Yutori Scouting
  3. If delayed → run full orchestrator pipeline
  4. If action requires browsing → call Yutori Browsing API
  5. Emit WebSocket events throughout for live dashboard
"""
import threading
import time
from server.neo4j_db.queries import get_all_orders, update_order_status
from server.integrations.yutori import check_tracking, execute_shopify_action
from server.orchestrator.orchestrator import orchestrate
from server.websocket.events import (
    emit_activity,
    emit_delay_detected,
    emit_neo4j_context,
    emit_policy_lookup,
    emit_agent_decision,
    emit_browsing_step,
    emit_message_sent,
    emit_graph_updated,
    emit_order_update,
)

# Track which orders we've already processed to avoid re-running
_processed_orders = set()

# Controls whether the loop is running
_loop_active = False
_loop_thread = None

LOOP_INTERVAL_SECONDS = 60


def _run_loop():
    """Main loop body — called every LOOP_INTERVAL_SECONDS."""
    global _loop_active

    while _loop_active:
        try:
            emit_activity("system", "Agent loop running — checking all orders...")

            orders = get_all_orders()
            open_orders = [
                o for o in orders
                if o["status"] not in ("delivered", "resolved")
                and o["orderId"] not in _processed_orders
            ]

            if not open_orders:
                emit_activity("system", f"No new orders to check ({len(orders)} total, {len(_processed_orders)} already processed)")
            else:
                for order in open_orders:
                    _check_order(order)

        except Exception as e:
            emit_activity("system", f"Agent loop error: {str(e)}")
            print(f"[Agent Loop] Error: {e}")

        # Wait for next iteration
        time.sleep(LOOP_INTERVAL_SECONDS)


def _check_order(order: dict):
    """Check a single order for delays and handle if found."""
    order_id = order["orderId"]
    tracking_url = order.get("trackingUrl", "")
    customer_name = order["customerName"]
    carrier = order.get("carrier", "Unknown")

    # Step 1: Check tracking via Yutori Scouting
    tracking = check_tracking(tracking_url)

    if tracking["status"] == "delayed" and tracking["days_late"] > 0:
        days_late = tracking["days_late"]

        # Emit scouting detection
        emit_delay_detected(order_id, customer_name, carrier, days_late)

        # Step 2: Get context from Neo4j (orchestrator does this internally)
        emit_neo4j_context(
            customer_name,
            order.get("tier", "standard"),
            order.get("total", 0),
            0,  # prior issues count — orchestrator will get the real number
        )

        # Step 3: Policy lookup will happen inside orchestrator
        # We emit it here for the activity feed
        from server.integrations.senso import get_policy
        policy = get_policy(days_late, order.get("tier", "standard"))
        emit_policy_lookup(days_late, policy["credit"], order.get("tier", "standard"))

        # Step 4: Run orchestrator
        auto_message = (
            f"PROACTIVE ALERT: Carrier tracking shows Order {order_id} "
            f"({order.get('product', 'item')}) is {days_late} days late. "
            f"Customer {customer_name} is a {order.get('tier', 'standard')} customer."
        )

        result = orchestrate(
            customer_id=order["customerId"],
            customer_message=auto_message,
            delay_days=days_late,
            order_id=order_id,
        )

        # Emit decision
        emit_agent_decision(
            result.get("action", "unknown"),
            result.get("creditAmount", 0),
            result.get("reasoning", ""),
        )

        # Step 5: Execute browsing action if needed
        action = result.get("action", "")
        if action in ("apply_credit", "process_refund"):
            browsing_result = execute_shopify_action(
                action, order_id, result.get("creditAmount", 0)
            )
            for step in browsing_result.get("steps", []):
                emit_browsing_step(step)
                time.sleep(0.3)  # Slight delay for visual effect in dashboard

        # Step 6: Update order status
        update_order_status(order_id, "resolved")
        emit_order_update(order_id, "resolved")

        # Step 7: Emit message sent
        emit_message_sent(customer_name, result.get("message", ""))

        # Step 8: Notify graph update
        emit_graph_updated()

        # Mark as processed
        _processed_orders.add(order_id)

    else:
        emit_activity("scouting", f"Order {order_id}: {tracking['status']} — no action needed")


def start_agent_loop(socketio=None):
    """Start the autonomous agent loop in a background thread."""
    global _loop_active, _loop_thread

    _loop_active = True
    _loop_thread = threading.Thread(target=_run_loop, daemon=True)
    _loop_thread.start()
    print(f"[Agent Loop] Started — checking orders every {LOOP_INTERVAL_SECONDS}s")


def stop_agent_loop():
    """Stop the agent loop."""
    global _loop_active
    _loop_active = False
    print("[Agent Loop] Stopped")


def reset_processed():
    """Reset the processed orders set (useful for demo restarts)."""
    _processed_orders.clear()
    print("[Agent Loop] Reset processed orders")
