"""
POST /api/trigger-delay — demo endpoint to simulate a delivery delay.
This manually triggers the autonomous flow for a specific order,
emitting WebSocket events at each step for the live activity feed.
"""
import time
from flask import Blueprint, request, jsonify
from server.orchestrator.orchestrator import orchestrate
from server.integrations.senso import get_policy
from server.integrations.yutori import execute_shopify_action
from server.neo4j_db.queries import get_all_orders, update_order_status
from server.websocket.events import (
    emit_delay_detected,
    emit_neo4j_context,
    emit_policy_lookup,
    emit_agent_decision,
    emit_browsing_step,
    emit_message_sent,
    emit_graph_updated,
    emit_order_update,
)

trigger_bp = Blueprint("trigger", __name__)


@trigger_bp.route("/api/trigger-delay", methods=["POST"])
def trigger_delay():
    """
    Body: { orderId: string, daysLate: number }
    Simulates a carrier delay and runs the full autonomous resolution flow.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    order_id = data.get("orderId")
    days_late = data.get("daysLate", 4)

    if not order_id:
        return jsonify({"error": "orderId is required"}), 400

    # Find the order and its customer
    try:
        all_orders = get_all_orders()
    except RuntimeError:
        # Neo4j unavailable — use demo seed data
        all_orders = [
            {"orderId": "order-1042", "customerId": "customer-001", "customerName": "Sarah Chen", "tier": "vip", "product": "Nike Air Max 90", "carrier": "FedEx", "total": 189.99, "status": "shipped"},
            {"orderId": "order-1043", "customerId": "customer-002", "customerName": "Marcus Johnson", "tier": "standard", "product": "Adidas Ultraboost", "carrier": "UPS", "total": 159.99, "status": "shipped"},
            {"orderId": "order-1044", "customerId": "customer-003", "customerName": "Priya Patel", "tier": "vip", "product": "New Balance 990v5", "carrier": "FedEx", "total": 199.99, "status": "shipped"},
        ]

    order = next((o for o in all_orders if o["orderId"] == order_id), None)

    if not order:
        return jsonify({"error": f"Order {order_id} not found"}), 404

    customer_name = order["customerName"]
    tier = order.get("tier", "standard")
    carrier = order.get("carrier", "Unknown")

    # ── Step 1: Emit delay detection ──────────────────────────
    emit_delay_detected(order_id, customer_name, carrier, days_late)

    # ── Step 2: Update order status in Neo4j ──────────────────
    try:
        update_order_status(order_id, "delayed")
    except RuntimeError:
        pass  # Neo4j unavailable — skip write
    emit_order_update(order_id, "delayed")

    # ── Step 3: Emit Neo4j context retrieval ──────────────────
    emit_neo4j_context(customer_name, tier, order.get("total", 0), 0)

    # ── Step 4: Emit policy lookup ────────────────────────────
    policy = get_policy(days_late, tier)
    emit_policy_lookup(days_late, policy["credit"], tier)

    # ── Step 5: Run orchestrator (calls LLM) ──────────────────
    auto_message = (
        f"PROACTIVE ALERT: Carrier tracking shows Order {order_id} "
        f"({order.get('product', 'item')}) is {days_late} days late. "
        f"Customer {customer_name} is a {tier} customer."
    )

    try:
        result = orchestrate(
            customer_id=order["customerId"],
            customer_message=auto_message,
            delay_days=days_late,
            order_id=order_id,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # ── Step 6: Emit LLM decision ─────────────────────────────
    emit_agent_decision(
        result.get("action", "unknown"),
        result.get("creditAmount", 0),
        result.get("reasoning", ""),
    )

    # ── Step 7: Execute browsing action if needed ─────────────
    action = result.get("action", "")
    if action in ("apply_credit", "process_refund"):
        browsing_result = execute_shopify_action(
            action, order_id, result.get("creditAmount", 0)
        )
        for step in browsing_result.get("steps", []):
            emit_browsing_step(step)

    # ── Step 8: Emit message sent + graph updated ─────────────
    emit_message_sent(customer_name, result.get("message", ""))
    emit_graph_updated()

    # Update order to resolved
    try:
        update_order_status(order_id, "resolved")
    except RuntimeError:
        pass  # Neo4j unavailable — skip write
    emit_order_update(order_id, "resolved")

    # Return full result for the API response
    result["orderId"] = order_id
    result["daysLate"] = days_late
    result["trigger"] = "manual_demo"

    return jsonify(result), 200
