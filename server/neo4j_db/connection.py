"""
Neo4j connection manager — singleton driver from env vars.
"""
import os
from neo4j import GraphDatabase

_driver = None


def get_driver():
    """Return a cached Neo4j driver instance."""
    global _driver
    if _driver is None:
        uri = os.getenv("NEO4J_URI")
        username = os.getenv("NEO4J_USERNAME", "neo4j")
        password = os.getenv("NEO4J_PASSWORD")

        if not uri or not password:
            raise RuntimeError(
                "NEO4J_URI and NEO4J_PASSWORD must be set in .env"
            )

        _driver = GraphDatabase.driver(uri, auth=(username, password))
        # Verify connectivity on first use
        _driver.verify_connectivity()
        print("[Neo4j] Connected successfully")

    return _driver


def close_driver():
    """Gracefully close the Neo4j driver."""
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None
        print("[Neo4j] Driver closed")
