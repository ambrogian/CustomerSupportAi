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
    RETURN c, collect(DISTINCT o) AS orders,
           collect(DISTINCT i) AS issues,
           collect(DISTINCT r) AS resolutions
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
        }


def get_graph_context(customer_id: str) -> dict:
    """
    Run a multi-hop graph traversal to return aggregate stats for the Orchestrator prompt.
    """
    driver = get_driver()
    query = """
    MATCH (c:Customer {id: $customer_id})
    OPTIONAL MATCH (c)-[:PLACED]->(o:Order)
    OPTIONAL MATCH (o)-[:HAS_ISSUE]->(i:Issue)
    OPTIONAL MATCH (i)-[:RESOLVED_BY]->(r:Resolution)
    RETURN 
      c.name as name,
      c.tier as tier,
      c.ltv as ltv,
      count(DISTINCT o) as totalOrders,
      count(DISTINCT i) as totalIssues,
      sum(r.creditApplied) as totalCreditsGiven,
      collect(DISTINCT {
        issueType: i.type,
        resolution: r.action,
        credit: r.creditApplied,
        date: r.timestamp
      }) as issueHistory,
      collect(DISTINCT {
        orderId: o.id,
        status: o.status,
        total: o.total
      }) as orderHistory
    """
    with driver.session() as session:
        result = session.run(query, customer_id=customer_id)
        record = result.single()
        if not record:
            return None
        
        # Clean up nulls from OPTIONAL MATCH
        def clean_list(lst):
            return [x for x in lst if x and any(v is not None for v in x.values())]

        return {
            "name": record["name"],
            "tier": record["tier"],
            "ltv": record["ltv"],
            "totalOrders": record["totalOrders"],
            "totalIssues": record["totalIssues"],
            "totalCreditsGiven": record["totalCreditsGiven"] or 0,
            "issueHistory": clean_list(record["issueHistory"]),
            "orderHistory": clean_list(record["orderHistory"])
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


def check_existing_open_issue(order_id: str) -> bool:
    """
    Check if there is already an open Issue for this order.
    Returns True if an open issue exists, False otherwise.
    """
    driver = get_driver()
    query = """
    MATCH (o:Order {id: $order_id})-[:HAS_ISSUE]->(i:Issue {status: 'open'})
    RETURN count(i) > 0 AS has_issue
    """
    with driver.session() as session:
        result = session.run(query, order_id=order_id)
        record = result.single()
        return record["has_issue"] if record else False

def get_active_delay_days(order_id: str) -> int:
    """Check Yutori Scouting to get the current real-time delay days for an active chat order."""
    if not order_id:
        return 0
        
    driver = get_driver()
    query = """
    MATCH (o:Order {id: $order_id})
    RETURN o.trackingUrl AS url
    """
    with driver.session() as session:
        result = session.run(query, order_id=order_id)
        record = result.single()
        if not record or not record.get("url"):
            return 0
            
    from server.integrations.yutori import check_tracking
    tracking = check_tracking(record["url"])
    if tracking["status"] == "delayed":
        return tracking.get("days_late", 0)
    return 0

def get_graph_data(customer_id: str = None) -> dict:
    """
    Return all nodes and relationships for the frontend graph visualization.
    If customer_id is provided, only returns the subgraph for that customer.
    """
    driver = get_driver()

    if customer_id:
        nodes_query = """
        MATCH path = (c:Customer {id: $customer_id})-[*0..3]-()
        UNWIND nodes(path) AS n
        WITH DISTINCT n
        WHERE n:Customer OR n:Order OR n:Issue OR n:Resolution
        RETURN n, labels(n) AS labels
        """
        rels_query = """
        MATCH path = (c:Customer {id: $customer_id})-[*1..3]-()
        UNWIND relationships(path) AS r
        WITH DISTINCT r
        WHERE (startNode(r):Customer OR startNode(r):Order OR startNode(r):Issue OR startNode(r):Resolution)
          AND (endNode(r):Customer OR endNode(r):Order OR endNode(r):Issue OR endNode(r):Resolution)
        RETURN startNode(r).id AS source, type(r) AS type, endNode(r).id AS target
        """
        params = {"customer_id": customer_id}
    else:
        nodes_query = """
        MATCH (n)
        WHERE n:Customer OR n:Order OR n:Issue OR n:Resolution
        RETURN n, labels(n) AS labels
        """
        rels_query = """
        MATCH (a)-[r]->(b)
        WHERE (a:Customer OR a:Order OR a:Issue OR a:Resolution)
          AND (b:Customer OR b:Order OR b:Issue OR b:Resolution)
        RETURN a.id AS source, type(r) AS type, b.id AS target
        """
        params = {}

    with driver.session() as session:
        nodes = []
        for record in session.run(nodes_query, **params):
            node_data = dict(record["n"])
            node_data["_labels"] = record["labels"]
            nodes.append(node_data)

        links = []
        for record in session.run(rels_query, **params):
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
