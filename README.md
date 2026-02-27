# 🤖 Resolve — Autonomous Customer Service Agent

> Built for hackathon demo — an AI agent that autonomously detects shipping delays, decides compensation, and resolves customer issues in real-time.

![Dashboard](https://img.shields.io/badge/Dashboard-React-61DAFB?logo=react) ![Backend](https://img.shields.io/badge/Backend-Flask-000000?logo=flask) ![Database](https://img.shields.io/badge/Database-Neo4j-008CC1?logo=neo4j) ![AI](https://img.shields.io/badge/AI-Qwen3--32B-orange)

---

## What It Does

Resolve is a **fully autonomous customer service agent** that:

1. **Monitors** shipping carriers for delays every 60 seconds
2. **Retrieves** full customer history and lifetime value from a graph database
3. **Consults** company policy to determine appropriate compensation
4. **Decides** the best action (apologize, credit, refund, or escalate)
5. **Executes** the action via Shopify admin (browsing automation)
6. **Messages** the customer with a personalized, on-brand response

All of this happens **without human intervention** — the dashboard shows the agent working in real-time.

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

Open **http://localhost:5173** — the dashboard connects automatically.

---

## Demo Flow

1. **On startup**: Neo4j is seeded with 3 demo customers and orders
2. **Agent loop starts**: Checks all orders every 60 seconds (visible in Activity Feed)
3. **Trigger a delay**: Click a demo button → watch the full autonomous pipeline fire:
   - Scouting detects delay → Neo4j context loaded → Policy consulted → AI decides → Shopify action executed → Customer notified
4. **Customer chat**: Open the customer chat tab to simulate a real conversation
5. **Knowledge Graph**: Watch new Issue and Resolution nodes appear in real-time

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
| Web Actions | Yutori Browsing API | Navigate Shopify admin autonomously |
| Web Search | Tavily | Real-time external context |
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
