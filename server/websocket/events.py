"""
WebSocket event emitters — socket.io setup.
Used by the agent loop and routes to push real-time updates to the dashboard.

Each event includes a timestamp and source tag for color-coding in the activity feed.
"""
from datetime import datetime, timezone

# Global socketio reference — set by app.py on startup
_socketio = None


def set_socketio(sio):
    """Store the socketio instance for use by all emitters."""
    global _socketio
    _socketio = sio


def get_socketio():
    return _socketio


def init_socketio(socketio):
    """Register socket.io event handlers."""
    set_socketio(socketio)

    @socketio.on("connect")
    def handle_connect():
        print("[WebSocket] Client connected")

    @socketio.on("disconnect")
    def handle_disconnect():
        print("[WebSocket] Client disconnected")


def _timestamp():
    return datetime.now(timezone.utc).isoformat()


def emit_activity(source: str, message: str, data: dict = None):
    """
    Emit a generic activity event to the dashboard feed.

    Sources (for color-coding):
        - scouting: Yutori Scouting API (blue)
        - neo4j: Database queries (green)
        - senso: Policy lookups (purple)
        - llm: LLM decisions (orange)
        - browsing: Yutori Browsing API (cyan)
        - system: General system events (gray)
    """
    if _socketio is None:
        print(f"[Activity] {source}: {message}")
        return

    event = {
        "timestamp": _timestamp(),
        "source": source,
        "message": message,
        "data": data or {},
    }
    _socketio.emit("activity", event)
    print(f"[Activity] {source}: {message}")


def emit_delay_detected(order_id: str, customer_name: str, carrier: str, days_late: int):
    """Emit when Scouting API detects a delivery delay."""
    emit_activity(
        "scouting",
        f"{carrier} delay detected on Order {order_id} — {days_late} day(s) late",
        {"orderId": order_id, "customerName": customer_name, "daysLate": days_late},
    )


def emit_neo4j_context(customer_name: str, tier: str, ltv: float, prior_issues: int):
    """Emit when Neo4j customer context is retrieved."""
    emit_activity(
        "neo4j",
        f"{customer_name} — {tier.upper()}, LTV ${ltv:,.0f}, {prior_issues} prior issue(s)",
        {"customerName": customer_name, "tier": tier, "ltv": ltv},
    )


def emit_policy_lookup(delay_days: int, credit: float, tier: str):
    """Emit when Senso policy is looked up."""
    mult_note = " × 2.0 VIP multiplier" if tier == "vip" else ""
    emit_activity(
        "senso",
        f"{delay_days}-day delay → ${credit:.0f} credit{mult_note}",
        {"delayDays": delay_days, "credit": credit, "tier": tier},
    )


def emit_agent_decision(action: str, credit_amount: float, reasoning: str):
    """Emit when LLM makes a decision."""
    credit_note = f" + ${credit_amount:.0f} credit" if credit_amount > 0 else ""
    emit_activity(
        "llm",
        f"Decision — {action}{credit_note}",
        {"action": action, "creditAmount": credit_amount, "reasoning": reasoning},
    )


def emit_browsing_step(step: str):
    """Emit individual Yutori Browsing API steps."""
    emit_activity("browsing", step)


def emit_message_sent(customer_name: str, message: str):
    """Emit when a customer message is sent."""
    emit_activity(
        "system",
        f"Message sent to {customer_name} ✓",
        {"customerName": customer_name, "message": message},
    )


def emit_graph_updated():
    """Emit when Neo4j graph data changes (new nodes/relationships)."""
    if _socketio:
        _socketio.emit("graph_updated", {"timestamp": _timestamp()})


def emit_order_update(order_id: str, status: str):
    """Emit when an order status changes."""
    if _socketio:
        _socketio.emit("order_updated", {
            "timestamp": _timestamp(),
            "orderId": order_id,
            "status": status,
        })


def emit_chat_message(role: str, customer_name: str, message: str, action: str = None, credit: float = 0):
    """
    Emit a chat message to the dashboard so it can show live conversations.
    role: 'customer' or 'agent'
    """
    if _socketio:
        _socketio.emit("chat_message", {
            "timestamp": _timestamp(),
            "role": role,
            "customerName": customer_name,
            "message": message,
            "action": action,
            "creditAmount": credit,
        })
