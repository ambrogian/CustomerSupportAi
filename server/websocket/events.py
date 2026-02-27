"""
WebSocket event emitters — socket.io setup.
Used by the agent loop and routes to push real-time updates to the dashboard.
"""


def init_socketio(socketio):
    """Register socket.io event handlers."""

    @socketio.on("connect")
    def handle_connect():
        print("[WebSocket] Client connected")

    @socketio.on("disconnect")
    def handle_disconnect():
        print("[WebSocket] Client disconnected")


def emit_event(socketio, event_type: str, data: dict):
    """
    Emit a real-time event to all connected dashboard clients.

    Event types:
        - delay_detected: carrier delay found by scouting
        - agent_decision: orchestrator made a decision
        - action_executed: credit/refund applied via browsing API
        - message_sent: customer message drafted
        - graph_updated: Neo4j graph changed
    """
    socketio.emit(event_type, data)
    print(f"[WebSocket] Emitted '{event_type}'")
