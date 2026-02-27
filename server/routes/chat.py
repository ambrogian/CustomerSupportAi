"""
POST /api/chat — customer chat endpoint.
Accepts { customerId, message } and runs the orchestrator.
"""
from flask import Blueprint, request, jsonify
from server.orchestrator.orchestrator import orchestrate

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

    # Determine order_id if provided (optional)
    order_id = data.get("orderId")

    # Run orchestrator
    try:
        result = orchestrate(
            customer_id=customer_id,
            customer_message=message,
            order_id=order_id,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify(result), 200
