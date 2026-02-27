# 🤖 Resolve — Autonomous Customer Service Agent

> Built for hackathon demo — an AI agent that autonomously detects shipping delays, decides compensation, and resolves customer issues in real-time.

![Dashboard](https://img.shields.io/badge/Dashboard-React-61DAFB?logo=react) ![Backend](https://img.shields.io/badge/Backend-Flask-000000?logo=flask) ![Database](https://img.shields.io/badge/Database-Neo4j-008CC1?logo=neo4j) ![AI](https://img.shields.io/badge/AI-Qwen3--32B-orange)

---

## What It Does

Resolve is a **fully autonomous customer service agent** that:

1. **Monitors** shipping carriers for delays every 60 seconds (with deduplication to prevent double-messaging).
2. **Retrieves** full, multi-hop customer history and lifetime value from a Neo4j knowledge graph.
3. **Consults** company policy to determine appropriate compensation based on VIP status and past issues.
4. **Researches** live carrier delays and weather outages via the Tavily Web Search API.
5. **Decides** the best action (apologize, credit, refund, escalate, or file carrier claim).
6. **Executes** financial actions via Direct Shopify REST APIs, or automated web browsing for FedEx claims.
7. **Messages** the customer with a personalized, context-aware (Proactive vs Reactive) brand response.

All of this happens **without human intervention** — the Business Dashboard shows the agent working in real-time, while Customers interact in a separate chat UI.

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- Neo4j AuraDB account (free tier works)
- Fastino API key (Pioneer AI)

### Setup

```bash
# Clone
git clone https://github.com/ambrogian/CustomerSupportAi.git
cd CustomerSupportAi

# Backend
python -m venv resolve
resolve\Scripts\activate        # Windows
# source resolve/bin/activate   # macOS/Linux
pip install -r requirements.txt

# Copy env template and fill in your keys
cp .env.example .env
# Edit .env with your NEO4J_URI, NEO4J_PASSWORD, FASTINO_API_KEY

# Frontend
cd client
npm install
cd ..
```

### Run

```bash
# Terminal 1: Backend (port 3001)
resolve\Scripts\python.exe server\app.py

# Terminal 2: Frontend (port 5173)
cd client && npm run dev
```

Open **http://localhost:5173** for the Business Dashboard.
Open **http://localhost:5173/chat** in a separate tab for the Customer Chat widget.
---

1. **Setup the split view**: Open the **Business Dashboard** (`http://localhost:5173`) in one browser window, and the **Customer Chat** (`http://localhost:5173/chat`) in another.
2. **Watch the Agent Loop**: The background agent runs every 60 seconds, checking all orders. You will see these background checks populate the "Activity Feed" panel.
3. **Observe Neo4j Data**: The Neo4j graph panel shows the visual representation of Customers, Orders, Issues, and Resolutions.
4. **Trigger a Proactive Delay**: 
   - On the Business Dashboard, click the "Trigger Delay" button for Sarah's order.
   - Watch the Activity Feed light up: Demux tracking → Load Neo4j context (noting her past issues and LTV) → Retrieve Senso Policy → Perform Tavily search for weather/carrier news → Send prompt to LLM.
   - The LLM will autonomously decide to apply a credit and send her an SMS-style proactive apology.
   - Watch the new `Issue` and `Resolution` nodes instantly wire onto the graph.
5. **Trigger a Reactive Chat**:
   - Go to the **Customer Chat** tab. Type a message like: *"Hey my order 1045 is taking forever!"*
   - Switch back to the Business Dashboard. You will see the agent orchestrate a completely different "Reactive" pipeline, matching the customer's frustration, applying credits directly via Shopify REST API, and returning a real-time response to the chat widget.
6. **Test Escalation & Rules**:
   - Manually trigger enough delays/messages for one customer so their total credits exceed $100.
   - The Neo4j graph prompt will alert the LLM of "credit abuse," and the LLM will automatically switch from `apply_credit` to `escalate` -> requiring human review!

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Backend | Flask + flask-socketio | API + WebSocket server |
| Frontend | React + Vite + Tailwind | Real-time dashboard |
| Database | Neo4j AuraDB | Graph of customers, orders, issues, resolutions |
| AI Model | Qwen3-32B via Fastino | Autonomous decision-making |
| Policy Engine | Senso (local fallback) | Compensation rules + brand voice |
| Carrier Monitoring | Yutori Scouting API | Track shipment delays |
| Web Actions (Shopify) | Shopify REST API | Direct execution of credits and refunds |
| Web Actions (FedEx) | Yutori Browsing API | Navigates FedEx autonomously to file lost package claims |
| Web Search | Tavily API | Real-time external context extraction (weather, shipping news) |
| Realtime | Socket.IO | Live dashboard updates |

---

## Project Structure

```
├── server/
│   ├── app.py                    # Flask entry point
│   ├── neo4j_db/                 # Connection, seed data, Cypher queries
│   ├── orchestrator/             # AI brain: prompt + decision pipeline
│   ├── integrations/             # Fastino, Senso, Yutori, Tavily clients
│   ├── agent_loop/               # 60-second autonomous background loop
│   ├── routes/                   # REST API endpoints
│   └── websocket/                # Socket.IO event emitters
├── client/
│   ├── src/
│   │   ├── App.tsx               # Main dashboard layout
│   │   ├── components/           # 5 dashboard panels
│   │   └── hooks/useSocket.ts    # WebSocket connection hook
│   └── vite.config.ts
├── requirements.txt
├── .env.example
└── ARCHITECTURE.md               # Detailed system architecture
```

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/chat` | Customer message → orchestrator → AI response |
| `POST` | `/api/trigger-delay` | Simulate a delivery delay for demo |
| `GET` | `/api/graph` | Neo4j graph data for visualization |
| `GET` | `/api/orders` | All orders with customer info |
| `GET` | `/api/health` | Health check |

---

## Environment Variables

```bash
NEO4J_URI=neo4j+s://xxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your-password
FASTINO_API_KEY=your-key
YUTORI_API_KEY=your-key     # optional, uses mock
SENSO_API_KEY=your-key       # optional, uses local JSON
TAVILY_API_KEY=your-key      # optional, uses mock
```

---

## Team

Built in 24 hours for the hackathon.
