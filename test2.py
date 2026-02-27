import os
from dotenv import load_dotenv
load_dotenv()
from server.neo4j_db.connection import get_driver
from server.orchestrator.orchestrator import orchestrate

def run_test():
    # 1. Insert mock data
    driver = get_driver()
    query = """
    MATCH (c:Customer {id: 'customer-001'})
    CREATE (i:Issue {id: 'test-issue-99', type: 'late_delivery', status: 'resolved', createdAt: datetime()})
    CREATE (r:Resolution {id: 'test-res-99', action: 'apply_credit', creditApplied: 85, timestamp: datetime()})
    CREATE (c)-[:HAD_ISSUE]->(i)
    CREATE (i)-[:RESOLVED_BY]->(r)
    """
    try:
        with driver.session() as session:
            session.run(query)
            print("Successfully inserted test issue & resolution.")
    except Exception as e:
        print("Neo4j error:", e)

    # 2. Trigger orchestrator directly
    print("\nCalling orchestrate...")
    result = orchestrate(
        customer_id="customer-001",
        customer_message="PROACTIVE ALERT: Carrier tracking shows Order order-1042 (Nike Air Max 90) is 4 days late. Customer Sarah Chen is a vip customer.",
        delay_days=4,
        order_id="order-1042"
    )

    with open("test2_result.txt", "w", encoding="utf-8") as f:
        f.write(f"Action: {result.get('action')}\n")
        f.write(f"Credit Amount: {result.get('creditAmount')}\n")
        f.write(f"Reasoning: {result.get('reasoning')}\n")

if __name__ == "__main__":
    run_test()
