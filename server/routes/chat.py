"""
POST /api/chat — customer chat endpoint.
Accepts { customerId, message } and runs the orchestrator.
Emits WebSocket events for the dashboard activity feed.
"""
from flask import Blueprint, request, jsonify
from server.orchestrator.orchestrator import orchestrate
from server.websocket.events import (
    emit_activity,
    emit_agent_decision,
    emit_message_sent,
    emit_graph_updated,
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

    # Emit incoming chat event
    emit_activity("system", f"Customer chat received from {customer_id}: \"{message[:60]}...\"")

    # Run orchestrator
    try:
        result = orchestrate(
            customer_id=customer_id,
            customer_message=message,
            order_id=order_id,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Emit decision and message events
    emit_agent_decision(
        result.get("action", "unknown"),
        result.get("creditAmount", 0),
        result.get("reasoning", ""),
    )

    customer_name = "Customer"
    if result.get("customer_context") and result["customer_context"].get("customer"):
        customer_name = result["customer_context"]["customer"].get("name", "Customer")

    emit_message_sent(customer_name, result.get("message", ""))

    if order_id:
        emit_graph_updated()

    return jsonify(result), 200
