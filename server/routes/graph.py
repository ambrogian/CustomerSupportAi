"""
GET /api/graph — returns all Neo4j nodes and relationships for the
frontend graph visualization.
"""
from flask import Blueprint, jsonify, request
from server.neo4j_db.queries import get_graph_data, get_all_orders

graph_bp = Blueprint("graph", __name__)


_DEMO_GRAPH = {
    "nodes": [
        {"id": "customer-001", "_labels": ["Customer"], "name": "Sarah Chen", "tier": "vip"},
        {"id": "customer-002", "_labels": ["Customer"], "name": "Marcus Johnson", "tier": "standard"},
        {"id": "customer-003", "_labels": ["Customer"], "name": "Priya Patel", "tier": "vip"},
        {"id": "order-1042", "_labels": ["Order"], "product": "Nike Air Max 90"},
        {"id": "order-1043", "_labels": ["Order"], "product": "Adidas Ultraboost"},
        {"id": "order-1044", "_labels": ["Order"], "product": "New Balance 990v5"},
    ],
    "links": [
        {"source": "customer-001", "target": "order-1042", "type": "PLACED"},
        {"source": "customer-002", "target": "order-1043", "type": "PLACED"},
        {"source": "customer-003", "target": "order-1044", "type": "PLACED"},
    ],
}

_DEMO_ORDERS = [
    {"orderId": "order-1042", "customerId": "customer-001", "customerName": "Sarah Chen", "tier": "vip", "product": "Nike Air Max 90", "carrier": "FedEx", "total": 189.99, "status": "shipped", "trackingUrl": "", "estimatedDelivery": ""},
    {"orderId": "order-1043", "customerId": "customer-002", "customerName": "Marcus Johnson", "tier": "standard", "product": "Adidas Ultraboost", "carrier": "UPS", "total": 159.99, "status": "shipped", "trackingUrl": "", "estimatedDelivery": ""},
    {"orderId": "order-1044", "customerId": "customer-003", "customerName": "Priya Patel", "tier": "vip", "product": "New Balance 990v5", "carrier": "FedEx", "total": 199.99, "status": "shipped", "trackingUrl": "", "estimatedDelivery": ""},
]


@graph_bp.route("/api/graph", methods=["GET"])
def graph():
    """Return all nodes + relationships for react-force-graph."""
    customer_id = request.args.get("customerId")
    try:
        data = get_graph_data(customer_id)
        return jsonify(data), 200
    except Exception:
        return jsonify(_DEMO_GRAPH), 200


@graph_bp.route("/api/orders", methods=["GET"])
def orders():
    """Return all orders with customer info for the Live Orders panel."""
    try:
        data = get_all_orders()
        return jsonify(data), 200
    except Exception:
        return jsonify(_DEMO_ORDERS), 200
