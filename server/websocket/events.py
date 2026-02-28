"""
WebSocket event emitters — socket.io setup.
Used by the agent loop and routes to push real-time updates to the dashboard.

Each event includes a timestamp and source tag for color-coding in the activity feed.
"""
import uuid
import threading
from datetime import datetime, timezone
from flask import request as flask_request

# Global socketio reference — set by app.py on startup
_socketio = None

# In-flight voice calls keyed by callId
_active_calls = {}


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
        role = flask_request.args.get("role", "dashboard")
        customer_id = flask_request.args.get("customerId")
        sid = flask_request.sid

        # Join appropriate rooms for call routing
        if role == "customer" and customer_id:
            socketio.server.enter_room(sid, f"customer:{customer_id}", namespace="/")
            print(f"[WebSocket] Customer {customer_id} connected (sid={sid})")
        elif role == "agent":
            socketio.server.enter_room(sid, "agent", namespace="/")
            print(f"[WebSocket] Agent connected (sid={sid})")
        else:
            print(f"[WebSocket] Dashboard client connected (sid={sid})")

    @socketio.on("disconnect")
    def handle_disconnect():
        print("[WebSocket] Client disconnected")

    # ── Room join (for agent dashboard that connects without query params) ──
    @socketio.on("join")
    def handle_join(data):
        role = data.get("role", "dashboard")
        sid = flask_request.sid
        if role == "agent":
            socketio.server.enter_room(sid, "agent", namespace="/")
            print(f"[WebSocket] Agent joined room (sid={sid})")
        elif role == "customer":
            customer_id = data.get("customerId")
            if customer_id:
                socketio.server.enter_room(sid, f"customer:{customer_id}", namespace="/")
                print(f"[WebSocket] Customer {customer_id} joined room (sid={sid})")

    # ── Call signaling handlers ──────────────────────────────────

    @socketio.on("call_initiate")
    def handle_call_initiate(data):
        """Customer or agent starts a call."""
        call_id = f"call-{uuid.uuid4().hex[:8]}"
        target_customer_id = data.get("targetCustomerId")
        sid = flask_request.sid

        # Determine initiator role by checking rooms
        rooms = socketio.server.rooms(sid, namespace="/")
        is_agent = "agent" in rooms
        initiator_role = "agent" if is_agent else "customer"

        _active_calls[call_id] = {
            "callId": call_id,
            "customerId": target_customer_id,
            "initiatedBy": initiator_role,
            "startedAt": _timestamp(),
            "status": "ringing",
            "transcription": None,
            "fullTranscript": "",
        }

        # Route to the other side
        if is_agent:
            # Agent calling customer
            socketio.emit("call_incoming", {
                "callId": call_id,
                "from": "agent",
            }, room=f"customer:{target_customer_id}")
        else:
            # Customer calling agent
            socketio.emit("call_incoming", {
                "callId": call_id,
                "from": "customer",
                "customerName": target_customer_id,
            }, room="agent")

        emit_call_activity("initiated", target_customer_id or "unknown", call_id)
        print(f"[Call] {initiator_role} initiated call {call_id}")

    @socketio.on("call_accept")
    def handle_call_accept(data):
        """Callee accepts the incoming call."""
        call_id = data.get("callId")
        call = _active_calls.get(call_id)
        if not call:
            return

        call["status"] = "connected"
        customer_id = call.get("customerId")

        # Notify both sides
        socketio.emit("call_started", {"callId": call_id}, room="agent")
        if customer_id:
            socketio.emit("call_started", {"callId": call_id}, room=f"customer:{customer_id}")

        # Start transcription session
        try:
            from server.integrations.modulate import start_transcription_session

            def on_transcript_chunk(chunk):
                # Accumulate full text
                text = chunk.get("text", "")
                if text:
                    call["fullTranscript"] += text + " "
                # Emit to both rooms
                socketio.emit("transcript_chunk", chunk, room="agent")
                if customer_id:
                    socketio.emit("transcript_chunk", chunk, room=f"customer:{customer_id}")

            session = start_transcription_session(call_id, on_transcript_chunk)
            call["transcription"] = session
        except Exception as e:
            print(f"[Call] Failed to start transcription: {e}")

        emit_call_activity("connected", customer_id or "unknown", call_id)
        print(f"[Call] Call {call_id} accepted")

    @socketio.on("call_reject")
    def handle_call_reject(data):
        """Callee rejects the incoming call."""
        call_id = data.get("callId")
        call = _active_calls.pop(call_id, None)
        if not call:
            return

        customer_id = call.get("customerId")
        socketio.emit("call_rejected", {"callId": call_id}, room="agent")
        if customer_id:
            socketio.emit("call_rejected", {"callId": call_id}, room=f"customer:{customer_id}")

        emit_call_activity("rejected", customer_id or "unknown", call_id)
        print(f"[Call] Call {call_id} rejected")

    @socketio.on("call_offer")
    def handle_call_offer(data):
        """Relay SDP offer to the other peer."""
        call_id = _current_call_id(flask_request.sid)
        if not call_id:
            return
        call = _active_calls.get(call_id)
        if not call:
            return
        customer_id = call.get("customerId")
        # Relay to the other side
        rooms = socketio.server.rooms(flask_request.sid, namespace="/")
        if "agent" in rooms and customer_id:
            socketio.emit("call_offer", {"sdp": data.get("sdp")}, room=f"customer:{customer_id}")
        else:
            socketio.emit("call_offer", {"sdp": data.get("sdp")}, room="agent")

    @socketio.on("call_answer")
    def handle_call_answer(data):
        """Relay SDP answer to the other peer."""
        call_id = _current_call_id(flask_request.sid)
        if not call_id:
            return
        call = _active_calls.get(call_id)
        if not call:
            return
        customer_id = call.get("customerId")
        rooms = socketio.server.rooms(flask_request.sid, namespace="/")
        if "agent" in rooms and customer_id:
            socketio.emit("call_answer", {"sdp": data.get("sdp")}, room=f"customer:{customer_id}")
        else:
            socketio.emit("call_answer", {"sdp": data.get("sdp")}, room="agent")

    @socketio.on("call_ice")
    def handle_call_ice(data):
        """Relay ICE candidate to the other peer."""
        call_id = _current_call_id(flask_request.sid)
        if not call_id:
            return
        call = _active_calls.get(call_id)
        if not call:
            return
        customer_id = call.get("customerId")
        rooms = socketio.server.rooms(flask_request.sid, namespace="/")
        if "agent" in rooms and customer_id:
            socketio.emit("call_ice", {"candidate": data.get("candidate")}, room=f"customer:{customer_id}")
        else:
            socketio.emit("call_ice", {"candidate": data.get("candidate")}, room="agent")

    @socketio.on("call_end")
    def handle_call_end(data):
        """Either side ends the call."""
        call_id = data.get("callId")
        call = _active_calls.pop(call_id, None)
        if not call:
            return

        customer_id = call.get("customerId")
        ended_at = _timestamp()

        # Close transcription session
        transcription = call.get("transcription")
        if transcription:
            try:
                transcription.close()
            except Exception:
                pass

        # Compute duration
        started_at = call.get("startedAt", ended_at)
        try:
            start_dt = datetime.fromisoformat(started_at)
            end_dt = datetime.fromisoformat(ended_at)
            duration_secs = int((end_dt - start_dt).total_seconds())
        except Exception:
            duration_secs = 0

        # Notify both sides
        socketio.emit("call_ended", {"callId": call_id, "duration": duration_secs}, room="agent")
        if customer_id:
            socketio.emit("call_ended", {"callId": call_id, "duration": duration_secs}, room=f"customer:{customer_id}")

        emit_call_activity("ended", customer_id or "unknown", call_id)

        # Persist to Neo4j and trigger post-call analysis in background
        full_transcript = call.get("fullTranscript", "").strip()
        call_data = {
            "callId": call_id,
            "customerId": customer_id,
            "startedAt": started_at,
            "endedAt": ended_at,
            "duration": duration_secs,
            "initiatedBy": call.get("initiatedBy", "unknown"),
            "status": "completed",
        }

        def _post_call_processing():
            _persist_and_analyze_call(call_data, full_transcript)

        thread = threading.Thread(target=_post_call_processing, daemon=True)
        thread.start()

        print(f"[Call] Call {call_id} ended (duration={duration_secs}s)")

    @socketio.on("audio_chunk")
    def handle_audio_chunk(data):
        """Receive audio chunk from client and forward to transcription."""
        call_id = _current_call_id(flask_request.sid)
        if not call_id:
            return
        call = _active_calls.get(call_id)
        if not call:
            return
        transcription = call.get("transcription")
        if transcription:
            chunk = data if isinstance(data, bytes) else bytes(data)
            transcription.send_audio(chunk)


def _current_call_id(sid):
    """Find the active call ID for a given socket session."""
    for call_id, call in _active_calls.items():
        if call.get("status") == "connected":
            return call_id
    return None


def _persist_and_analyze_call(call_data: dict, full_transcript: str):
    """Background: save CallSession + Transcript to Neo4j, run orchestrator analysis."""
    customer_id = call_data.get("customerId")
    call_id = call_data.get("callId")

    if not customer_id:
        return

    # Step 1: Save to Neo4j
    try:
        from server.neo4j_db.queries import (
            create_call_session_node,
            create_transcript_node,
            update_transcript_summary,
        )

        create_call_session_node(customer_id, call_data)

        transcript_id = None
        if full_transcript:
            transcript_id = create_transcript_node(call_id, {
                "fullText": full_transcript,
                "source": "modulate",
            })

        emit_graph_updated()
        emit_call_activity("saved", customer_id, call_id)

    except Exception as e:
        print(f"[Call] Neo4j persistence failed: {e}")
        transcript_id = None

    # Step 2: Post-call orchestrator analysis
    if full_transcript:
        try:
            from server.orchestrator.orchestrator import orchestrate

            analysis_message = (
                "CALL TRANSCRIPT ANALYSIS: The following is a transcript of a voice call "
                "with the customer. Analyze and determine if follow-up actions are needed.\n"
                "--- TRANSCRIPT ---\n"
                f"{full_transcript}\n"
                "--- END TRANSCRIPT ---"
            )

            decision = orchestrate(
                customer_id=customer_id,
                customer_message=analysis_message,
            )

            # Update transcript summary with LLM reasoning
            if transcript_id and decision.get("reasoning"):
                try:
                    from server.neo4j_db.queries import update_transcript_summary
                    update_transcript_summary(transcript_id, decision["reasoning"])
                except Exception:
                    pass

            emit_activity(
                "llm",
                f"Post-call analysis complete for call {call_id}",
                {"action": decision.get("action"), "reasoning": decision.get("reasoning", "")},
            )
            emit_graph_updated()

        except Exception as e:
            print(f"[Call] Post-call analysis failed: {e}")


# ── Helpers ──────────────────────────────────────────────────

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
        - tavily: Web Search (yellow)
        - call: Voice call events (rose)
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


def emit_call_activity(action: str, customer_name: str, call_id: str):
    """Emit a call-related activity event (rose colored in the feed)."""
    emit_activity(
        "call",
        f"Call {action} — {customer_name} ({call_id})",
        {"callId": call_id, "customerName": customer_name, "action": action},
    )


def emit_delay_detected(order_id: str, customer_name: str, carrier: str, days_late: int):
    """Emit when Scouting API detects a delivery delay."""
    emit_activity(
        "scouting",
        f"{carrier} delay detected on Order {order_id} — {days_late} day(s) late",
        {"orderId": order_id, "customerName": customer_name, "daysLate": days_late},
    )


def emit_neo4j_context(customer_name: str, orders: int, prior_issues: int, total_credits: float):
    """Emit when Neo4j graph context is retrieved."""
    emit_activity(
        "neo4j",
        f"[Neo4j Graph] {customer_name}: {orders} orders, {prior_issues} prior issues, ${total_credits:,.0f} credits given",
        {"customerName": customer_name},
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


def emit_tavily_search(query: str):
    """Emit when a web search is performed."""
    emit_activity("tavily", f"Searching web for: '{query}'")


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
