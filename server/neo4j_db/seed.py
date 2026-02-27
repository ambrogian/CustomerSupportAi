"""
Idempotent seed script — creates demo customers, orders, issues, and resolutions.
Uses MERGE so it can be safely re-run without duplicating data.
"""
from server.neo4j_db.connection import get_driver


SEED_CYPHER = """
// ── Customer 1: Sarah Chen (VIP) ──────────────────────────────
MERGE (c1:Customer {id: 'customer-001'})
SET c1.name = 'Sarah Chen',
    c1.email = 'sarah.chen@example.com',
    c1.ltv = 2400,
    c1.tier = 'vip'

MERGE (o1:Order {id: 'order-1042'})
SET o1.product = 'Nike Air Max',
    o1.status = 'shipped',
    o1.carrier = 'FedEx',
    o1.trackingUrl = 'https://tracking.example.com/demo-tracking-001',
    o1.estimatedDelivery = '2026-03-03',
    o1.total = 189.99

MERGE (c1)-[:PLACED]->(o1)

// ── Customer 2: Marcus Williams (Standard) ────────────────────
MERGE (c2:Customer {id: 'customer-002'})
SET c2.name = 'Marcus Williams',
    c2.email = 'marcus.w@example.com',
    c2.ltv = 180,
    c2.tier = 'standard'

MERGE (o2:Order {id: 'order-1043'})
SET o2.product = 'Adidas Ultraboost',
    o2.status = 'shipped',
    o2.carrier = 'UPS',
    o2.trackingUrl = 'https://tracking.example.com/demo-tracking-002',
    o2.estimatedDelivery = '2026-03-04',
    o2.total = 159.99

MERGE (c2)-[:PLACED]->(o2)

// Marcus's prior issue (late delivery 3 months ago)
MERGE (pi:Issue {id: 'issue-past-001'})
SET pi.type = 'late_delivery',
    pi.description = 'Package arrived 3 days late',
    pi.status = 'resolved',
    pi.createdAt = '2025-11-27T10:00:00Z'

MERGE (o2)-[:HAS_ISSUE]->(pi)
MERGE (c2)-[:HAD_ISSUE]->(pi)

MERGE (pr:Resolution {id: 'resolution-past-001'})
SET pr.action = 'apply_credit',
    pr.creditApplied = 10,
    pr.message = 'Hi Marcus, we\\'re sorry about the delay. We\\'ve applied a $10 credit to your account.',
    pr.timestamp = '2025-11-27T10:05:00Z'

MERGE (pi)-[:RESOLVED_BY]->(pr)

// ── Customer 3: Priya Patel (VIP) ─────────────────────────────
MERGE (c3:Customer {id: 'customer-003'})
SET c3.name = 'Priya Patel',
    c3.email = 'priya.patel@example.com',
    c3.ltv = 5100,
    c3.tier = 'vip'

MERGE (o3:Order {id: 'order-1044'})
SET o3.product = 'New Balance 990',
    o3.status = 'shipped',
    o3.carrier = 'FedEx',
    o3.trackingUrl = 'https://tracking.example.com/demo-tracking-003',
    o3.estimatedDelivery = '2026-03-05',
    o3.total = 199.99

MERGE (c3)-[:PLACED]->(o3)
"""


def seed_database():
    """Run the idempotent seed script against Neo4j."""
    driver = get_driver()
    with driver.session() as session:
        session.run(SEED_CYPHER)
    print("[Neo4j] Seed data loaded (3 customers, 3 orders, 1 prior issue)")


if __name__ == "__main__":
    import dotenv, os, sys
    # Load .env from project root
    dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
    # Allow running as standalone script
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
    seed_database()
