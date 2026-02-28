"""
POST /api/chat — customer chat endpoint.
Accepts { customerId, message } and runs the orchestrator.
Emits WebSocket events for the dashboard activity feed.
"""
from flask import Blueprint, request, jsonify
from server.orchestrator.orchestrator import orchestrate
from server.integrations.shopify import apply_store_credit, process_refund
from server.websocket.events import (
    emit_activity,
    emit_agent_decision,
    emit_message_sent,
    emit_graph_updated,
    emit_chat_message,
    emit_browsing_step,
)
from server.neo4j_db.queries import get_active_delay_days

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

    # Look up live delay if they reference an order
    delay_days = 0
    if order_id:
        try:
            delay_days = get_active_delay_days(order_id)
        except Exception as e:
            print(f"Warning: Could not fetch active delay for order {order_id}: {e}")

    # Run orchestrator
    try:
        result = orchestrate(
            customer_id=customer_id,
            customer_message=message,
            order_id=order_id,
            delay_days=delay_days,
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

    # Emit agent response as chat message to dashboard
    action = result.get("action", "")
    agent_msg = result.get("message", "")
    emit_chat_message("agent", customer_id, agent_msg, action, result.get("creditAmount", 0))
    emit_message_sent(customer_name, agent_msg)

    # Execute action — send follow-up status messages to the customer
    if action == "apply_credit":
        credit = result.get("creditAmount", 0)
        emit_chat_message("agent", customer_id, f"Hang on — I'm applying a ${credit:.0f} store credit to your account now...")
        api_result = apply_store_credit(
            order_id or "unknown", credit, customer_id
        )
        for step in api_result.get("steps", []):
            emit_activity("system", step)
        emit_chat_message("agent", customer_id, f"Done! A ${credit:.0f} credit has been added to your account. You can use it on your next order.")
    elif action == "process_refund":
        emit_chat_message("agent", customer_id, "Hang on — I'm processing your refund now...")
        api_result = process_refund(
            order_id or "unknown", result.get("creditAmount", 0), "Requested via chat"
        )
        for step in api_result.get("steps", []):
            emit_activity("system", step)
        emit_chat_message("agent", customer_id, "Your refund has been processed. You should see it back in your account within 3-5 business days.")
    elif action == "file_carrier_claim":
        from server.integrations.yutori import file_carrier_claim
        emit_chat_message("agent", customer_id, "Hang on — I'm filing a complaint with the carrier right now...")
        api_result = file_carrier_claim(
            tracking_number=order_id or "unknown",
            order_total=0,
            brand_name="Resolve Sneaker Co.",
            session_id=order_id or "unknown"
        )
        for step in api_result.get("steps", []):
            emit_browsing_step(step)
        emit_chat_message("agent", customer_id, "Done! I've filed a claim with the carrier. I'll keep you updated as soon as we hear back.")

    if order_id:
        emit_graph_updated()

    return jsonify(result), 200

@chat_bp.route("/api/chat/agent", methods=["POST"])
def agent_reply():
    """Endpoint for human agent replies from the business dashboard."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    customer_id = data.get("customerId")
    message = data.get("message")

    if not customer_id or not message:
        return jsonify({"error": "customerId and message are required"}), 400

    # For the agent reply, we don't trigger the orchestrator.
    # We simply emit it via WebSocket so both views can see it.
    # We could also insert a Resolution node in Neo4j if we wanted persistent record.
    customer_name = "Resolve Agent"
    
    emit_activity("system", f"Agent sent a manual reply to {customer_id}")
    emit_chat_message("agent", customer_name, message, "send_message", 0)

    return jsonify({"success": True}), 200
