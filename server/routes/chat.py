"""
POST /api/chat — customer chat endpoint.
Accepts { customerId, message } and runs the orchestrator.
Emits WebSocket events for the dashboard activity feed.
"""
from flask import Blueprint, request, jsonify
from server.orchestrator.orchestrator import orchestrate
from server.integrations.yutori import execute_shopify_action
from server.websocket.events import (
    emit_activity,
    emit_agent_decision,
    emit_message_sent,
    emit_graph_updated,
    emit_chat_message,
    emit_browsing_step,
)

chat_bp = Blueprint("chat", __name__)


@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    customer_id = data.get("customerId")
    message = data.get("message")

    if not customer_id or not message:
        return jsonify({"error": "customerId and message are required"}), 400

    order_id = data.get("orderId")

    # Emit incoming customer message to dashboard
    emit_activity("system", f"Customer chat received from {customer_id}")
    emit_chat_message("customer", customer_id, message)

    # Run orchestrator
    try:
        result = orchestrate(
            customer_id=customer_id,
            customer_message=message,
            order_id=order_id,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Get customer name from context
    customer_name = "Customer"
    if result.get("customer_context") and result["customer_context"].get("customer"):
        customer_name = result["customer_context"]["customer"].get("name", "Customer")

    # Emit decision
    emit_agent_decision(
        result.get("action", "unknown"),
        result.get("creditAmount", 0),
        result.get("reasoning", ""),
    )

    # Execute browsing action if needed
    action = result.get("action", "")
    if action in ("apply_credit", "process_refund"):
        browsing_result = execute_shopify_action(
            action, order_id or "unknown", result.get("creditAmount", 0)
        )
        for step in browsing_result.get("steps", []):
            emit_browsing_step(step)

    # Emit agent response as chat message to dashboard
    agent_msg = result.get("message", "")
    emit_chat_message("agent", customer_name, agent_msg, action, result.get("creditAmount", 0))
    emit_message_sent(customer_name, agent_msg)

    if order_id:
        emit_graph_updated()

    return jsonify(result), 200
