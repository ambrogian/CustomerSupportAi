"""
Cypher query helpers for reading and writing customer/order/issue/resolution data.
"""
import uuid
from datetime import datetime, timezone
from server.neo4j_db.connection import get_driver


# ─── Read helpers ──────────────────────────────────────────────

def get_customer_context(customer_id: str) -> dict:
    """
    Return full context for a customer: profile, orders, issues, resolutions.
    This is the primary input to the orchestrator.
    """
    driver = get_driver()
    query = """
    MATCH (c:Customer {id: $customer_id})
    OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
    OPTIONAL MATCH (o)-[:HAS_ISSUE]->(i:Issue)
    OPTIONAL MATCH (i)-[:RESOLVED_BY]->(r:Resolution)
    OPTIONAL MATCH (c)-[:HAD_CALL]->(call:CallSession)-[:HAS_TRANSCRIPT]->(t:Transcript)
    RETURN c, collect(DISTINCT o) AS orders,
           collect(DISTINCT i) AS issues,
           collect(DISTINCT r) AS resolutions,
           collect(DISTINCT call) AS calls,
           collect(DISTINCT t) AS transcripts
    """
    with driver.session() as session:
        result = session.run(query, customer_id=customer_id)
        record = result.single()
        if record is None:
            return None

        customer_node = record["c"]
        return {
            "customer": dict(customer_node),
            "orders": [dict(o) for o in record["orders"]],
            "issues": [dict(i) for i in record["issues"]],
            "resolutions": [dict(r) for r in record["resolutions"]],
            "calls": [dict(c) for c in record["calls"]],
            "transcripts": [dict(t) for t in record["transcripts"]],
        }


def get_all_orders() -> list:
    """Return all orders with their customer info (for the agent loop)."""
    driver = get_driver()
    query = """
    MATCH (c:Customer)-[:PLACED]->(o:Order)
    RETURN c.id AS customerId, c.name AS customerName, c.tier AS tier,
           o.id AS orderId, o.status AS status, o.carrier AS carrier,
           o.trackingUrl AS trackingUrl, o.estimatedDelivery AS estimatedDelivery,
           o.product AS product, o.total AS total
    """
    with driver.session() as session:
        result = session.run(query)
        return [dict(record) for record in result]


def get_graph_data() -> dict:
    """
    Return all nodes and relationships for the frontend graph visualization.
    """
    driver = get_driver()

    nodes_query = """
    MATCH (n)
    WHERE n:Customer OR n:Order OR n:Issue OR n:Resolution OR n:CallSession OR n:Transcript
    RETURN n, labels(n) AS labels
    """
    rels_query = """
    MATCH (a)-[r]->(b)
    WHERE (a:Customer OR a:Order OR a:Issue OR a:Resolution OR a:CallSession OR a:Transcript)
      AND (b:Customer OR b:Order OR b:Issue OR b:Resolution OR b:CallSession OR b:Transcript)
    RETURN a.id AS source, type(r) AS type, b.id AS target
    """

    with driver.session() as session:
        nodes = []
        for record in session.run(nodes_query):
            node_data = dict(record["n"])
            node_data["_labels"] = record["labels"]
            nodes.append(node_data)

        links = []
        for record in session.run(rels_query):
            links.append({
                "source": record["source"],
                "type": record["type"],
                "target": record["target"],
            })

    return {"nodes": nodes, "links": links}


# ─── Write helpers ─────────────────────────────────────────────

def create_issue_node(order_id: str, issue_data: dict) -> str:
    """
    Create an Issue node and link it to the Order and the Order's Customer.
    Returns the generated issue ID.
    """
    driver = get_driver()
    issue_id = f"issue-{uuid.uuid4().hex[:8]}"
    query = """
    MATCH (c:Customer)-[:PLACED]->(o:Order {id: $order_id})
    CREATE (i:Issue {
        id: $issue_id,
        type: $issue_type,
        description: $description,
        status: 'open',
        createdAt: $created_at
    })
    CREATE (o)-[:HAS_ISSUE]->(i)
    CREATE (c)-[:HAD_ISSUE]->(i)
    RETURN i.id AS issueId
    """
    with driver.session() as session:
        session.run(
            query,
            order_id=order_id,
            issue_id=issue_id,
            issue_type=issue_data.get("type", "unknown"),
            description=issue_data.get("description", ""),
            created_at=datetime.now(timezone.utc).isoformat(),
        )
    return issue_id


def create_resolution_node(issue_id: str, resolution_data: dict) -> str:
    """
    Create a Resolution node and link it to the Issue. Also marks Issue as resolved.
    Returns the generated resolution ID.
    """
    driver = get_driver()
    resolution_id = f"resolution-{uuid.uuid4().hex[:8]}"
    query = """
    MATCH (i:Issue {id: $issue_id})
    SET i.status = 'resolved'
    CREATE (r:Resolution {
        id: $resolution_id,
        action: $action,
        creditApplied: $credit_applied,
        message: $message,
        timestamp: $timestamp
    })
    CREATE (i)-[:RESOLVED_BY]->(r)
    RETURN r.id AS resolutionId
    """
    with driver.session() as session:
        session.run(
            query,
            issue_id=issue_id,
            resolution_id=resolution_id,
            action=resolution_data.get("action", "send_message"),
            credit_applied=resolution_data.get("creditAmount", 0),
            message=resolution_data.get("message", ""),
            timestamp=datetime.now(timezone.utc).isoformat(),
        )
    return resolution_id


def update_order_status(order_id: str, status: str):
    """Update the status field of an order."""
    driver = get_driver()
    query = """
    MATCH (o:Order {id: $order_id})
    SET o.status = $status
    """
    with driver.session() as session:
        session.run(query, order_id=order_id, status=status)


# ─── Call / Transcript helpers ────────────────────────────────

def create_call_session_node(customer_id: str, call_data: dict) -> str:
    """
    Create a CallSession node and link it to the Customer via [:HAD_CALL].
    Returns the callId.
    """
    driver = get_driver()
    call_id = call_data.get("callId", f"call-{uuid.uuid4().hex[:8]}")
    query = """
    MATCH (c:Customer {id: $customer_id})
    CREATE (cs:CallSession {
        id: $call_id,
        customerId: $customer_id,
        startedAt: $started_at,
        endedAt: $ended_at,
        duration: $duration,
        initiatedBy: $initiated_by,
        status: $status
    })
    CREATE (c)-[:HAD_CALL]->(cs)
    RETURN cs.id AS callId
    """
    with driver.session() as session:
        session.run(
            query,
            customer_id=customer_id,
            call_id=call_id,
            started_at=call_data.get("startedAt", datetime.now(timezone.utc).isoformat()),
            ended_at=call_data.get("endedAt", datetime.now(timezone.utc).isoformat()),
            duration=call_data.get("duration", 0),
            initiated_by=call_data.get("initiatedBy", "unknown"),
            status=call_data.get("status", "completed"),
        )
    return call_id


def create_transcript_node(call_id: str, transcript_data: dict) -> str:
    """
    Create a Transcript node and link it to the CallSession via [:HAS_TRANSCRIPT].
    Returns the generated transcript ID.
    """
    driver = get_driver()
    transcript_id = f"transcript-{uuid.uuid4().hex[:8]}"
    query = """
    MATCH (cs:CallSession {id: $call_id})
    CREATE (t:Transcript {
        id: $transcript_id,
        callId: $call_id,
        fullText: $full_text,
        summary: '',
        createdAt: $created_at,
        source: $source
    })
    CREATE (cs)-[:HAS_TRANSCRIPT]->(t)
    RETURN t.id AS transcriptId
    """
    with driver.session() as session:
        session.run(
            query,
            call_id=call_id,
            transcript_id=transcript_id,
            full_text=transcript_data.get("fullText", ""),
            created_at=datetime.now(timezone.utc).isoformat(),
            source=transcript_data.get("source", "modulate"),
        )
    return transcript_id


def get_customer_call_history(customer_id: str) -> list:
    """Return recent calls + transcripts for a customer."""
    driver = get_driver()
    query = """
    MATCH (c:Customer {id: $customer_id})-[:HAD_CALL]->(cs:CallSession)
    OPTIONAL MATCH (cs)-[:HAS_TRANSCRIPT]->(t:Transcript)
    RETURN cs, t
    ORDER BY cs.startedAt DESC
    LIMIT 10
    """
    with driver.session() as session:
        result = session.run(query, customer_id=customer_id)
        calls = []
        for record in result:
            call = dict(record["cs"])
            if record["t"]:
                call["transcript"] = dict(record["t"])
            calls.append(call)
        return calls


def update_transcript_summary(transcript_id: str, summary: str):
    """Update the summary field of a Transcript node after post-call analysis."""
    driver = get_driver()
    query = """
    MATCH (t:Transcript {id: $transcript_id})
    SET t.summary = $summary
    """
    with driver.session() as session:
        session.run(query, transcript_id=transcript_id, summary=summary)
