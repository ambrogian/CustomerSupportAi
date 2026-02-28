# Resolve — Architecture Flow Chart

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              RESOLVE                                         │
│                   Autonomous Customer Support Agent                          │
│                                                                              │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  │
│  │  Customer    │   │  NexusCore   │   │  Agent Loop  │   │  Voice Call   │  │
│  │  Chat Page   │   │  Dashboard   │   │  (60s cycle) │   │  (WebRTC)    │  │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘  │
│         │                  │                   │                  │           │
│         └──────────────────┴───────────────────┴──────────────────┘           │
│                                    │                                          │
│                          ┌─────────▼──────────┐                              │
│                          │    ORCHESTRATOR     │                              │
│                          │  (Decision Engine)  │                              │
│                          └─────────┬──────────┘                              │
│                                    │                                          │
│         ┌──────────┬───────────────┼───────────────┬──────────┐              │
│         ▼          ▼               ▼               ▼          ▼              │
│    ┌─────────┐ ┌────────┐   ┌──────────┐   ┌─────────┐ ┌─────────┐         │
│    │  Neo4j  │ │ Senso  │   │ Fastino  │   │ Tavily  │ │ Yutori  │         │
│    │ (Graph) │ │ (KB)   │   │  (LLM)   │   │ (Search)│ │(Track)  │         │
│    └─────────┘ └────────┘   └──────────┘   └─────────┘ └─────────┘         │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow — Three Paths

### Path 1: Reactive (Customer Chat)

```
Customer types message
        │
        ▼
  POST /api/chat
  { customerId, message, orderId? }
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR PIPELINE                    │
│                                                            │
│  ① Neo4j ──→ Customer context (profile, orders, issues)   │
│       │                                                    │
│  ② Senso ──→ Compensation policy (tier-based)              │
│       │                                                    │
│  ③ Tavily ─→ Web context (carrier delays, weather)         │
│       │                                                    │
│  ④ Prompt ──→ Assemble system + user messages              │
│       │       ┌─────────────────────────────────────┐      │
│       │       │ Customer: Sarah Chen (VIP, $2400)   │      │
│       │       │ Order: #1042 — 4 days late          │      │
│       │       │ History: 1 prior issue, $30 credits │      │
│       │       │ Policy: $10 base x 2 VIP = $20     │      │
│       │       │ Message: "Where is my order?"       │      │
│       │       └─────────────────────────────────────┘      │
│       │                                                    │
│  ⑤ Fastino LLM (Qwen3-32B)                                │
│       │       ┌─────────────────────────────────────┐      │
│       │       │ { action: "apply_credit",           │      │
│       │       │   message: "Hi Sarah, we've...",    │      │
│       │       │   creditAmount: 20,                 │      │
│       │       │   requiresHumanReview: false,       │      │
│       │       │   reasoning: "VIP, 4-day delay" }   │      │
│       │       └─────────────────────────────────────┘      │
│       │                                                    │
│  ⑥ Neo4j ──→ Create Issue + Resolution nodes               │
│       │                                                    │
│  ⑦ Execute action (Shopify credit / refund / claim)        │
└───────┼────────────────────────────────────────────────────┘
        │
        ▼
  WebSocket events ──→ Dashboard updates in real-time
  JSON response    ──→ Customer sees agent reply
```

### Path 2: Proactive (Agent Loop)

```
  ┌─────────────────────────────┐
  │  Agent Loop (every 60s)     │
  │  daemon thread              │
  └─────────────┬───────────────┘
                │
                ▼
  ┌─────────────────────────────┐
  │  For each active order:     │
  │                             │
  │  Yutori Scouting API        │
  │  → Check tracking URL       │
  │  → Returns delay status     │
  └─────────────┬───────────────┘
                │
          delayed?
          /     \
        yes      no ──→ skip
        │
        ▼
  ┌─────────────────────────────┐
  │  Check Neo4j for existing   │
  │  open issue (dedup)         │
  └─────────────┬───────────────┘
                │
          exists?
          /     \
        yes      no
        │        │
        ▼        ▼
      skip    ORCHESTRATOR
              (same pipeline as Path 1)
                │
                ▼
        Execute action:
        ├── apply_credit  ──→ Shopify gift card API
        ├── process_refund ──→ Shopify refund API
        ├── file_carrier_claim ──→ Yutori Browsing API
        │                         (navigates carrier website)
        └── escalate ──→ Flag for human review
                │
                ▼
        Update order status → "resolved"
        Emit WebSocket events → Dashboard
```

### Path 3: Voice Call (WebRTC + Transcription)

```
  Agent clicks Call          Customer receives
  (or vice versa)            incoming call alert
        │                           │
        ▼                           ▼
  socket: call_initiate ──→ socket: call_incoming
                                    │
                              Accept / Reject
                                    │
                              ┌─────▼─────┐
                              │  ACCEPT    │
                              └─────┬─────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                    WebRTC Setup                        │
        │                                                        │
        │  1. getUserMedia({ audio: true })  — both sides        │
        │  2. RTCPeerConnection (STUN: stun.l.google.com)        │
        │  3. SDP Offer / Answer exchange via Socket.IO           │
        │  4. ICE Candidate exchange via Socket.IO                │
        │  5. Peer-to-peer audio stream established               │
        └───────────────────────────┬───────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │               Audio Capture & Transcription            │
        │                                                        │
        │  Browser:                                              │
        │  AudioContext (16kHz) → ScriptProcessor (4096 samples) │
        │       │                                                │
        │       ▼                                                │
        │  socket: audio_chunk (PCM Int16)                       │
        │       │                                                │
        │  Server:                                               │
        │       ▼                                                │
        │  Modulate WebSocket API                                │
        │  (or mock: phrase every 10 chunks)                     │
        │       │                                                │
        │       ▼                                                │
        │  socket: transcript_chunk ──→ Both browsers            │
        │  { text, isFinal, chunkIndex }   see live transcript   │
        └───────────────────────────┬───────────────────────────┘
                                    │
                              Call Ends
                                    │
        ┌───────────────────────────▼───────────────────────────┐
        │                Post-Call Processing                    │
        │                (background thread)                     │
        │                                                        │
        │  1. Create CallSession node in Neo4j                   │
        │  2. Create Transcript node with full text               │
        │  3. Run orchestrator on transcript                      │
        │     "Analyze this call, determine follow-up actions"   │
        │  4. Update Transcript.summary with LLM reasoning        │
        │  5. Emit graph_updated + activity events                │
        └───────────────────────────────────────────────────────┘
```

---

## Neo4j Graph Schema

```
                            ┌──────────────┐
                     ┌──────│   CUSTOMER    │──────┐
                     │      │              │      │
                     │      │ id           │      │
                     │      │ name         │      │
                     │      │ email        │      │
                     │      │ tier (vip/std)│      │
                     │      │ ltv          │      │
                     │      └──────────────┘      │
                     │              │              │
                [:PLACED]     [:HAD_ISSUE]    [:HAD_CALL]
                     │              │              │
                     ▼              │              ▼
              ┌──────────────┐     │      ┌──────────────┐
              │    ORDER     │     │      │ CALL SESSION │
              │              │     │      │              │
              │ id           │     │      │ id           │
              │ product      │     │      │ startedAt    │
              │ status       │     │      │ endedAt      │
              │ carrier      │     │      │ duration     │
              │ trackingUrl  │     │      │ initiatedBy  │
              │ estDelivery  │     │      │ status       │
              │ total        │     │      └──────┬───────┘
              └──────┬───────┘     │             │
                     │             │      [:HAS_TRANSCRIPT]
                [:HAS_ISSUE]       │             │
                     │             │             ▼
                     ▼             │      ┌──────────────┐
              ┌──────────────┐     │      │  TRANSCRIPT  │
              │    ISSUE     │◄────┘      │              │
              │              │            │ id           │
              │ id           │            │ callId       │
              │ type         │            │ fullText     │
              │ description  │            │ summary      │
              │ status       │            │ source       │
              │ createdAt    │            └──────────────┘
              └──────┬───────┘
                     │
               [:RESOLVED_BY]
                     │
                     ▼
              ┌──────────────┐
              │  RESOLUTION  │
              │              │
              │ id           │
              │ action       │
              │ creditApplied│
              │ message      │
              │ timestamp    │
              └──────────────┘
```

---

## LLM Decision Logic

```
                    ┌─────────────────────────────┐
                    │     Fastino LLM Decides      │
                    └─────────────┬───────────────┘
                                  │
          ┌───────────┬───────────┼───────────┬──────────────┐
          ▼           ▼           ▼           ▼              ▼
    send_message  apply_credit  process_   escalate    file_carrier_
                                refund                     _claim
          │           │           │           │              │
          ▼           ▼           ▼           ▼              ▼
      Reply only   Shopify     Shopify     Flag for      Yutori
      to customer  gift card   refund API  human         Browsing API
                   API                     review        (navigate &
                                                        submit form)

  ┌───────────────────────────────────────────────────────────────┐
  │                     Decision Rules                             │
  │                                                                │
  │  Delay 1-2 days  ──→  $0 credit (message only)                │
  │  Delay 3-5 days  ──→  $10 credit                              │
  │  Delay 6+ days   ──→  $25 credit                              │
  │  VIP customer    ──→  x 2.0 multiplier                        │
  │  Credits > $100  ──→  escalate (human review)                  │
  │  Delay 10+ days  ──→  file_carrier_claim                      │
  │  2+ prior issues ──→  acknowledge repeat problem               │
  │  First issue     ──→  extra warm tone                          │
  │  Prior refund    ──→  offer replacement, not another refund    │
  └───────────────────────────────────────────────────────────────┘
```

---

## Integration Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INTEGRATIONS                                 │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │  Fastino LLM │   │  Senso KB    │   │  Yutori                  │ │
│  │              │   │              │   │                          │ │
│  │  Qwen3-32B   │   │  Policy      │   │  Scouting: Track orders  │ │
│  │  via Pioneer  │   │  lookup      │   │  Browsing: File claims   │ │
│  │  AI API       │   │  + fallback  │   │  + mock fallback         │ │
│  └──────────────┘   └──────────────┘   └──────────────────────────┘ │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │  Tavily      │   │  Shopify     │   │  Modulate                │ │
│  │              │   │              │   │                          │ │
│  │  Web search   │   │  Gift cards  │   │  Real-time speech-to-   │ │
│  │  for carrier  │   │  Refunds     │   │  text via WebSocket     │ │
│  │  delay context│   │  + mock      │   │  + mock fallback        │ │
│  └──────────────┘   └──────────────┘   └──────────────────────────┘ │
│                                                                      │
│  All integrations follow the same pattern:                           │
│  1. Try real API (if API key set)                                    │
│  2. Fall back to mock/local data (for development)                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## What's Real vs. What's Mocked

| Component | Status | Details |
|-----------|--------|---------|
| **Neo4j AuraDB** | REAL | Live graph database storing customers, orders, issues, resolutions, calls, transcripts |
| **Fastino LLM (Qwen3-32B)** | REAL | Live API calls to Pioneer AI. Returns structured JSON decisions |
| **Senso Policy Engine** | LOCAL MOCK | Local JSON fallback with real compensation rules. Ready to swap for Senso API |
| **Yutori Scouting API** | MOCK | Returns `on_time` by default. `/api/trigger-delay` simulates delays |
| **Yutori Browsing API** | MOCK | Files FedEx claims autonomously. Returns realistic step sequences |
| **Shopify REST API** | REAL | Applies store credits and processes refunds against Shopify backend |
| **Tavily Web Search** | REAL | Returns real-time news about carrier outages and weather disruptions |
| **Modulate Transcription** | MOCK + REAL | Real WebSocket API if reachable; falls back to mock transcript chunks |
| **WebSocket Events** | REAL | All events emitted live via Socket.IO |
| **WebRTC Voice Calls** | REAL | Browser-to-browser peer-to-peer audio via RTCPeerConnection |
| **Agent Loop** | REAL | Background thread running every 60 seconds |

---

## Real-Time Event System

```
  Server emits                Socket.IO                Dashboard receives
  ────────────               ──────────               ──────────────────

  emit_activity()     ──→    "activity"        ──→    TicketStream feed
  (color-coded)                                       ┌─────────────────────────┐
                                                      │  scouting: delay detect │
                                                      │  neo4j: context loaded  │
                                                      │  senso: policy lookup   │
                                                      │  llm: decision made     │
                                                      │  call: voice event      │
                                                      │  tavily: web search     │
                                                      │  browsing: automation   │
                                                      │  system: general        │
                                                      └─────────────────────────┘

  emit_chat_message() ──→    "chat_message"    ──→    LiveChatWindow

  emit_graph_updated()──→    "graph_updated"   ──→    GraphPanel re-fetches

  emit_order_update() ──→    "order_updated"   ──→    Order status badge

  (call signaling)    ──→    "call_incoming"   ──→    CallControls UI
                             "call_started"           (ring / accept / end)
                             "call_ended"
                             "transcript_chunk" ──→   Live transcript panel
```

---

## Frontend Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        React App (Vite)                          │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  HOOKS (shared state)                                      │  │
│  │                                                            │  │
│  │  useSocket ──→ Socket.IO connection, activities,           │  │
│  │               chatMessages, incomingCall, graphVersion     │  │
│  │                                                            │  │
│  │  useWebRTC ──→ RTCPeerConnection, callState, audio        │  │
│  │               capture, transcript chunks                   │  │
│  └────────────────────────┬───────────────────────────────────┘  │
│                           │                                      │
│  ┌────────────────────────▼───────────────────────────────────┐  │
│  │  PAGES                                                     │  │
│  │                                                            │  │
│  │  / (Dashboard — NexusCore)         /chat (Customer Chat)   │  │
│  │  ┌──────┬──────────┬────────┐     ┌────────────────────┐  │  │
│  │  │Ticket│ Graph    │Readiness│     │ Customer selector  │  │  │
│  │  │Stream│ Panel    │Panel   │     │ Chat messages      │  │  │
│  │  │      │(force    │        │     │ Call controls      │  │  │
│  │  │      │ graph)   │Anomaly │     │ Live transcript    │  │  │
│  │  │      │          │Panel   │     │ Quick replies      │  │  │
│  │  └──────┴──────────┴────────┘     └────────────────────┘  │  │
│  │                                                            │  │
│  │  ┌─────────────────────────────┐                          │  │
│  │  │  LiveChatWindow (floating)  │                          │  │
│  │  │  Chat messages + CallCtrl   │                          │  │
│  │  │  Auto-opens on new message  │                          │  │
│  │  │  or incoming call           │                          │  │
│  │  └─────────────────────────────┘                          │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
CustomerSupportAi/
├── server/
│   ├── app.py                          # Entry point — Flask + Socket.IO
│   ├── orchestrator/
│   │   ├── orchestrator.py             # Decision pipeline (6 steps)
│   │   └── prompt.py                   # System/user prompt construction
│   ├── neo4j_db/
│   │   ├── connection.py               # Neo4j driver singleton
│   │   ├── queries.py                  # All Cypher queries
│   │   └── seed.py                     # Demo data (3 customers, 3 orders)
│   ├── integrations/
│   │   ├── openai_client.py            # Fastino LLM (OpenAI-compatible)
│   │   ├── senso.py                    # Policy knowledge base
│   │   ├── yutori.py                   # Scouting (tracking) + Browsing (claims)
│   │   ├── tavily.py                   # Web search
│   │   ├── shopify.py                  # Gift cards + refunds
│   │   └── modulate.py                 # Speech-to-text transcription
│   ├── routes/
│   │   └── api.py                      # HTTP endpoints
│   ├── websocket/
│   │   └── events.py                   # Socket.IO handlers + call signaling
│   └── agent_loop/
│       └── loop.py                     # Autonomous 60s background loop
│
├── client/                             # React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx                     # Dashboard (NexusCore 3-column)
│   │   ├── pages/
│   │   │   └── CustomerChat.tsx        # Customer chat page (/chat)
│   │   ├── hooks/
│   │   │   ├── useSocket.ts            # Socket.IO state management
│   │   │   └── useWebRTC.ts            # WebRTC call management
│   │   └── components/
│   │       ├── GraphPanel.tsx           # Neo4j force-graph visualization
│   │       ├── TicketStream.tsx         # Activity feed
│   │       ├── ReadinessPanel.tsx       # Accuracy + confidence metrics
│   │       ├── AnomaliesPanel.tsx       # Escalation alerts
│   │       ├── TriggerControls.tsx      # Demo controls
│   │       ├── LiveChatWindow.tsx       # Floating chat overlay
│   │       └── CallControls.tsx         # Voice call UI
│   └── vite.config.ts                  # Proxy: /api + /socket.io → :3001
│
└── .env                                # API keys (not committed)
```

---

## HTTP API Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Health check |
| `/api/chat` | POST | Customer sends message → orchestrator pipeline |
| `/api/chat/agent` | POST | Human agent replies via dashboard |
| `/api/trigger-delay` | POST | Demo: simulate shipping delay |
| `/api/graph` | GET | Neo4j graph data for visualization |
| `/api/orders` | GET | All orders with customer info |

---

## Frequently Asked Questions

**What does the agent actually do and how does it orchestrate?**
The core of Resolve is the `Orchestrator` (`server/orchestrator/orchestrator.py`). It is a pipeline triggered either every 60 seconds by the background agent loop or manually via a customer chat message.
1. It gathers context from **Neo4j** (customer tier, LTV, past issues).
2. It gathers policy rules from **Senso** (refund thresholds, credit amounts).
3. It gathers external context from **Tavily/Yutori** (weather delays, carrier status).
4. It sends all this data to the **Fastino LLM** (Qwen3-32B) to make a decision.
5. If the LLM decides to apply a credit or refund, the Orchestrator calls the **Shopify API** to execute the action.
6. Finally, it records the entire interaction back into **Neo4j** as an `Issue` and `Resolution`.

**What are the web agents trying to find?**
- **Tavily Web Search**: Searches the live web for news affecting shipping, such as "FedEx weather delays" to understand the *cause* of an issue.
- **Yutori Scouting API**: Monitors carrier tracking pages to find the exact delivery status and days late of a specific package.
- **Yutori Browsing API**: Acts as an autonomous web navigator. It navigates to carrier websites (like FedEx) to automatically file lost package claims without human intervention.

**What can a customer chat with the bot about?**
The bot is a general-purpose LLM restricted to acting as a customer service agent for the DTC sneaker brand. It autonomously resolves order-related support tickets. Customers can ask about order status, complain about delays, or request compensation. The bot independently decides to grant credits, process refunds, or escalate based on company policy.

**Does the Neo4j graph update with conversation memory?**
Yes. When an issue is handled (proactively or reactively), the backend creates `Issue` and `Resolution` nodes in Neo4j. The `Resolution` node stores the action taken, the amount, and the message sent. This acts as permanent support ticket memory, preventing duplicate credits on repeat contact. Voice call transcripts are also persisted as `CallSession` and `Transcript` nodes.

**How do voice calls work?**
Either side (customer or agent) can initiate a call. The call uses browser-to-browser WebRTC for peer-to-peer audio. During the call, audio is captured at 16kHz and streamed to the Modulate transcription API (or a mock) for real-time speech-to-text. After the call ends, the full transcript is saved to Neo4j and the orchestrator analyzes it for follow-up actions.
