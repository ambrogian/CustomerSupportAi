# Resolve — System Architecture

## How It Works

Resolve is an **autonomous agent loop** that continuously monitors orders, detects issues, and resolves them without human input. Here is the exact flow:

```
┌─────────────────────────────────────────────────────────┐
│                    AGENT LOOP (every 60s)                │
│                                                         │
│  1. Fetch all orders from Neo4j                         │
│  2. For each order → call Yutori Scouting API           │
│  3. If delay detected:                                  │
│     a. Load customer context from Neo4j                 │
│     b. Look up compensation policy from Senso           │
│     c. Send context + policy → LLM (Qwen3-32B)         │
│     d. LLM returns structured decision JSON             │
│     e. Execute action via Yutori Browsing API           │
│     f. Write Issue + Resolution nodes to Neo4j          │
│     g. Emit events to dashboard via WebSocket           │
│  4. If no delay → log "on_time" and move on             │
└─────────────────────────────────────────────────────────┘
```

The same pipeline runs for **customer chat messages** — a customer sends a message, and the orchestrator decides the best response autonomously.

---

## What's Real vs. What's Mocked

| Component | Status | Details |
|-----------|--------|---------|
| **Neo4j AuraDB** | ✅ REAL | Live graph database storing customers, orders, issues, resolutions. All CRUD operations are real Cypher queries. |
| **Fastino LLM (Qwen3-32B)** | ✅ REAL | Live API calls to Pioneer AI. The model receives full customer context, policy rules, and brand voice — returns structured JSON decisions. |
| **Senso Policy Engine** | 🟡 LOCAL MOCK | Uses a local JSON fallback with real compensation rules (delay tiers, VIP multiplier, refund thresholds, brand voice). Ready to swap for Senso API. |
| **Yutori Scouting API** | 🟡 MOCK | Returns `on_time` by default. The `/api/trigger-delay` endpoint overrides this to simulate delays. Interface is ready for real Yutori API. |
| **Yutori Browsing API** | 🟡 MOCK | Returns simulated step-by-step Shopify admin actions (navigate, search order, apply credit). Interface ready for real API. |
| **Tavily Web Search** | 🟡 MOCK | Returns empty results. Placeholder for real-time carrier news, weather disruptions. |
| **Modulate (Voice)** | ❌ NOT IMPLEMENTED | Optional — would add emotion/tone scoring from voice input. |
| **WebSocket Events** | ✅ REAL | All events are emitted live via Socket.IO. Dashboard updates in real time. |
| **Agent Loop** | ✅ REAL | Background thread running every 60 seconds, checking all orders. |

---

## How Web Agents Work

### Yutori Scouting API (Carrier Monitoring)
The Scouting API monitors carrier tracking URLs on a schedule. In production:
- Agent sends a tracking URL (e.g., FedEx/UPS tracking link)
- Scouting API navigates to the carrier website, extracts status
- Returns structured data: `{ status, days_late, estimated_delivery, carrier_message }`
- **Currently mocked**: Returns `on_time` by default. Delays are simulated via `/api/trigger-delay`.

### Yutori Browsing API (Autonomous Web Actions)
The Browsing API is a headless browser agent that navigates web pages and performs actions:
- Agent sends instructions: "Navigate to Shopify admin, find order X, apply $20 credit"
- Browsing API executes step-by-step, returning progress
- **Currently mocked**: Returns realistic step sequences visible in the Activity Feed.

### Tavily (External Context Search)
Tavily provides real-time web search for additional context:
- "Is FedEx experiencing nationwide delays?"
- "Weather disruptions in shipping region?"
- Results feed into the orchestrator as external context.
- **Currently mocked**: Returns empty results.

---

## How Conversations Work

### Customer-Initiated Chat
```
Customer → POST /api/chat → Orchestrator:
  1. Query Neo4j: full customer profile, order history, past issues
  2. Query Senso: applicable policy (if delay context exists)
  3. Build prompt with all context → send to LLM
  4. LLM returns: { action, message, creditAmount, reasoning }
  5. If action involves credits/refunds → call Browsing API
  6. Write Issue + Resolution to Neo4j
  7. Emit WebSocket events → dashboard updates live
  8. Return message to customer
```

### Proactive Agent (No Customer Message)
```
Agent Loop detects delay → creates synthetic alert message:
  "PROACTIVE ALERT: Order #1042 is 4 days late. Customer Sarah Chen is VIP."
  → Same orchestrator pipeline runs
  → Agent sends proactive message to customer
  → Dashboard shows the full autonomous resolution
```

---

## Orchestrator Tools

The orchestrator (LLM) has access to these tools through the pipeline:

| Tool | Source | What It Does |
|------|--------|-------------|
| `get_customer_context()` | Neo4j | Retrieves customer profile, all orders, prior issues, past resolutions |
| `get_policy()` | Senso | Looks up compensation rules based on delay severity and customer tier |
| `check_tracking()` | Yutori Scouting | Checks carrier tracking URL for delivery status |
| `execute_shopify_action()` | Yutori Browsing | Navigates Shopify admin to apply credits or process refunds |
| `search_web()` | Tavily | Searches for external context (carrier outages, weather) |
| `create_issue_node()` | Neo4j | Creates an Issue node linked to the Order and Customer |
| `create_resolution_node()` | Neo4j | Creates a Resolution node linked to the Issue |
| `update_order_status()` | Neo4j | Updates order status (shipped → delayed → resolved) |

---

## Orchestrator Decision States

The LLM outputs one of these structured decisions:

| Action | When | Effect |
|--------|------|--------|
| `send_message` | Customer inquiry, no compensation needed | Sends a personalized response only |
| `apply_credit` | Delay detected, within auto-approve threshold | Applies store credit via Browsing API + sends message |
| `process_refund` | Major delay (6+ days), high-value order | Processes refund via Browsing API + sends message |
| `escalate` | Refund > $150, unusual situation, or uncertain | Flags for human review, does NOT auto-execute |

### Decision Factors
- **Customer Tier**: VIP customers get 2× standard compensation
- **LTV (Lifetime Value)**: Higher LTV = more generous treatment
- **Delay Severity**: 1-2 days (apology), 3-5 days (credit), 6+ days (refund)
- **Prior Issues**: Repeat issues → more generous resolution
- **Refund Threshold**: Anything > $150 gets flagged for human review

### Brand Voice Rules
- Warm, direct, never robotic
- Use the customer's first name
- Never say "I apologize for the inconvenience"
- Explain credits/refunds in plain English

---

## Neo4j Data Model

```
(Customer)-[:PLACED]->(Order)
(Order)-[:HAS_ISSUE]->(Issue)
(Issue)-[:RESOLVED_BY]->(Resolution)
(Customer)-[:HAD_ISSUE]->(Issue)
```

**Node Properties:**
- **Customer**: id, name, email, ltv, tier ('standard' | 'vip')
- **Order**: id, product, status, carrier, trackingUrl, estimatedDelivery, total
- **Issue**: id, type, description, status ('open' | 'resolved'), createdAt
- **Resolution**: id, action, creditApplied, message, timestamp

---

## WebSocket Events (Activity Feed)

Each event is color-coded by source:

| Source | Color | Events |
|--------|-------|--------|
| 🔵 Scouting API | Blue | Delay detected, tracking status checks |
| 🟢 Neo4j | Green | Customer context loaded, graph updated |
| 🟣 Senso | Purple | Policy lookup results |
| 🟠 LLM | Orange | AI decision made |
| 🔵 Browsing API | Cyan | Shopify navigation steps |
| ⚪ System | Gray | Agent loop status, messages sent |
