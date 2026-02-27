"""
Agent loop placeholder — the autonomous 60-second background loop.
Will be fully implemented in Phase 2.
"""


def start_agent_loop(socketio):
    """
    Start the autonomous agent loop that runs every 60 seconds.

    Phase 2 will implement:
    - Iterate over all open orders
    - Call Yutori Scouting API to check tracking
    - If delay detected, run orchestrator
    - Emit WebSocket events for dashboard
    """
    print("[Agent Loop] Placeholder — will be activated in Phase 2")
    # Phase 2: use threading.Timer or APScheduler for 60s interval
