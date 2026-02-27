"""
Resolve — Flask application entry point.

Starts the server with:
  1. Neo4j connection + seed data
  2. Route registration
  3. WebSocket (socket.io)
  4. Agent loop (60-second autonomous background thread)
"""
import os
import sys

from dotenv import load_dotenv

# Load .env from project root
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

# Add project root to path so imports work
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO

from server.neo4j_db.connection import get_driver, close_driver
from server.neo4j_db.seed import seed_database
from server.routes.chat import chat_bp
from server.routes.trigger import trigger_bp
from server.routes.graph import graph_bp
from server.websocket.events import init_socketio
from server.agent_loop.loop import start_agent_loop

# ── Create Flask app ───────────────────────────────────────────
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# ── Register blueprints ───────────────────────────────────────
app.register_blueprint(chat_bp)
app.register_blueprint(trigger_bp)
app.register_blueprint(graph_bp)


# ── Health check ───────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health():
    return {"status": "ok", "service": "resolve"}, 200


# ── Startup ────────────────────────────────────────────────────
def startup():
    """Run on server start: connect to Neo4j, seed data, start agent loop."""
    print("=" * 60)
    print("  RESOLVE — Autonomous Customer Service Agent")
    print("=" * 60)

    # Connect to Neo4j and seed demo data
    try:
        get_driver()
        seed_database()
        print("[Startup] Neo4j connected and seeded ✓")
    except Exception as e:
        print(f"[Startup] WARNING: Neo4j not available — {e}")
        print("[Startup] Server will start but Neo4j features won't work.")
        print("[Startup] Set NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD in .env")

    # Initialize WebSocket and start agent loop
    init_socketio(socketio)
    start_agent_loop(socketio)


# ── Main ───────────────────────────────────────────────────────
if __name__ == "__main__":
    startup()
    port = int(os.getenv("PORT", 3001))
    print(f"[Server] Starting on port {port}")
    socketio.run(app, host="0.0.0.0", port=port, debug=True, use_reloader=False, allow_unsafe_werkzeug=True)
