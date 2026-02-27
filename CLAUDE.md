# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Resolve** — An autonomous customer support agent for DTC sneaker brands. Uses a Flask backend with Neo4j graph database, Fastino LLM (Qwen3-32B), and multiple external integrations to handle customer issues like delivery delays with tier-based compensation.

## Running the Application

```bash
# Start the server (runs on port 3001 with eventlet async)
python -m server.app

# Environment variables loaded from .env (see .env.example for required keys)
```

No test suite exists yet. No build step required.

## Architecture

```
Routes (HTTP API)  →  Orchestrator (Decision Engine)  →  Neo4j (Graph DB)
                            ↓                                ↓
                     Fastino LLM (Qwen3-32B)          Customer/Order/Issue/Resolution nodes
                     Senso (Policy KB)
                     Yutori (Carrier tracking, Shopify) — mocked
                     Tavily (Web search) — mocked
```

**Core pipeline** (`server/orchestrator/orchestrator.py`):
1. Query Neo4j for customer context (profile, orders, issues, resolutions)
2. Fetch applicable policy from Senso (with local fallback)
3. Build prompt combining context + customer message + policy
4. Call Fastino LLM → get structured JSON decision (action, message, credit, escalation flag)
5. Write Issue + Resolution nodes to Neo4j
6. Return decision

**Entry point:** `server/app.py` — initializes Neo4j connection, seeds demo data, starts agent loop, listens on `0.0.0.0:3001`.

## Key Modules

| Module | Purpose |
|--------|---------|
| `server/orchestrator/` | Decision engine + LLM prompt construction |
| `server/neo4j_db/` | Neo4j connection, Cypher queries, seed data |
| `server/integrations/` | External API clients (Fastino, Senso, Yutori, Tavily) |
| `server/routes/` | HTTP endpoints: `/api/chat`, `/api/trigger-delay`, `/api/graph`, `/api/orders` |
| `server/websocket/` | Socket.io real-time events (Phase 2) |
| `server/agent_loop/` | Autonomous background loop every 60s (Phase 2 placeholder) |

## LLM Integration

Uses Fastino (Pioneer AI) via OpenAI-compatible REST API at `https://api.fastino.ai/v1/chat/completions` with model `Qwen/Qwen3-32B`. The client is in `server/integrations/openai_client.py`. LLM returns structured JSON with: `action`, `message`, `creditAmount`, `requiresHumanReview`, `reasoning`.

## Neo4j Data Model

- `Customer` → `[:PLACED]` → `Order` → `[:HAS_ISSUE]` → `Issue` → `[:RESOLVED_BY]` → `Resolution`
- `Customer` → `[:HAD_ISSUE]` → `Issue`
- Customer tiers (vip/standard) drive policy-based compensation logic

## Phase Status

- **Phase 1 (Foundation):** Complete — Flask, Neo4j, Fastino, orchestrator, API routes
- **Phase 2 (Agent Loop):** Placeholder — autonomous order monitoring, WebSocket events
- **Phase 3 (Frontend):** Future — React dashboard with graph visualization
