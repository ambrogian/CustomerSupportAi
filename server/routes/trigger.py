"""
POST /api/trigger-delay — demo endpoint to simulate a delivery delay.
This manually triggers the autonomous flow for a specific order.
"""
from flask import Blueprint, request, jsonify
from server.orchestrator.orchestrator import orchestrate
from server.integrations.senso import get_policy
from server.neo4j_db.queries import get_all_orders, update_order_status

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
    all_orders = get_all_orders()
    order = next((o for o in all_orders if o["orderId"] == order_id), None)

    if not order:
        return jsonify({"error": f"Order {order_id} not found"}), 404

    # Update order status in Neo4j
    update_order_status(order_id, "delayed")

    # Build a proactive message as if the agent detected the delay
    auto_message = (
        f"PROACTIVE ALERT: Carrier tracking shows Order {order_id} "
        f"({order['product']}) is {days_late} days late. "
        f"Customer {order['customerName']} is a {order['tier']} customer."
    )

    # Run orchestrator
    try:
        result = orchestrate(
            customer_id=order["customerId"],
            customer_message=auto_message,
            delay_days=days_late,
            order_id=order_id,
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    # Emit WebSocket events (will be wired up in Phase 2)
    # For now, include all the info the dashboard needs
    result["orderId"] = order_id
    result["daysLate"] = days_late
    result["trigger"] = "manual_demo"

    return jsonify(result), 200
