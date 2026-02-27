"""
GET /api/graph — returns all Neo4j nodes and relationships for the
frontend graph visualization.
"""
from flask import Blueprint, jsonify
from server.neo4j_db.queries import get_graph_data, get_all_orders

graph_bp = Blueprint("graph", __name__)


@graph_bp.route("/api/graph", methods=["GET"])
def graph():
    """Return all nodes + relationships for react-force-graph."""
    try:
        data = get_graph_data()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@graph_bp.route("/api/orders", methods=["GET"])
def orders():
    """Return all orders with customer info for the Live Orders panel."""
    try:
        data = get_all_orders()
        return jsonify(data), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
