import sys
import os
import requests
from dotenv import load_dotenv
load_dotenv()
from server.neo4j_db.connection import get_driver

def get_issues():
    driver = get_driver()
    query = "MATCH (o:Order {id: 'order-1042'})-[r:HAS_ISSUE]->(i:Issue) RETURN count(r) as issueCount"
    with driver.session() as session:
        result = session.run(query)
        for record in result:
            return record['issueCount']
    return 0

print('Initial issues: ', get_issues())

print('Running trigger 1...')
res = requests.post('http://localhost:3001/api/trigger-delay', json={'orderId': 'order-1042', 'daysLate': 4})
print('Trigger 1 status:', res.status_code)
print('Issues after trigger 1: ', get_issues())

print('Running trigger 2...')
res2 = requests.post('http://localhost:3001/api/trigger-delay', json={'orderId': 'order-1042', 'daysLate': 4})
print('Trigger 2 status:', res2.status_code)
print('Issues after trigger 2: ', get_issues())
