# Commerce Ops MCP Server

An **AI-native, remotely hosted MCP server** written in TypeScript that empowers operations teams and AI agents to investigate and resolve e-commerce order exceptions — damaged items, lost shipments, refunds, and replacement dispatches — safely and autonomously.

---

## 🎯 Problem & User

**User:** An operations agent (human or AI) handling post-delivery exceptions in an online commerce business.

**Problem:** When an order is damaged or lost, the ops agent must:
1. Investigate the order and understand what happened
2. Check if a replacement item is available in inventory
3. Process a partial or full refund safely (without overpaying or duplicating)
4. Create a replacement shipment if appropriate

Today this requires jumping between systems. This MCP server gives a single, safe interface for the full workflow.

---

## 🔄 End-to-End Workflow

```
AI Agent receives: "Customer Alex's order ORD-1001 arrived damaged"
         │
         ▼
[get_order_details]  ──→  Order: DAMAGED, $120 total, 0 refunded
         │
         ▼
[check_inventory]    ──→  SKU-AUDIO-01: 13 units available
         │
         ▼
[process_refund]     ──→  $50 partial refund applied
  ├─ Guardrail ①: Rejects if amount > remaining balance
  └─ Guardrail ②: Rejects duplicate idempotency key
         │
         ▼
[create_shipment]    ──→  Replacement shipment PENDING
  └─ Guardrail ③: Only allowed for DAMAGED or LOST orders
```

---

## 🛠️ MCP Tools

| Tool | Description | Inputs | Guardrails |
|---|---|---|---|
| `get_order_details` | Fetch order status, items, tracking, refund history | `orderId` | Returns error if not found |
| `check_inventory` | Check available stock for a SKU | `sku` | Returns error if SKU not found |
| `process_refund` | Apply a partial or full refund | `orderId`, `amount`, `reason`, `idempotencyKey` | ① Amount cap (≤ remaining balance) ② Idempotency (rejects duplicate keys) |
| `create_shipment` | Dispatch a replacement item | `orderId`, `address` | ③ Status check (DAMAGED or LOST orders only) |

---

## 🚀 Live Hosted URL

- **MCP SSE Endpoint:** `https://diligence-mcp-ops.onrender.com/sse`
- **Health Check:** `https://diligence-mcp-ops.onrender.com/health`

> **Note:** The Render free tier spins down after 15 min of inactivity. Hit the health check URL first to warm it up.

---

## 🏗️ Architecture

```
src/
├── index.ts          # Express server — SSE + health endpoints
├── server.ts         # MCP server factory — reads tool registry, dispatches
├── types/
│   └── index.ts      # Shared domain interfaces
├── db/
│   └── mockData.ts   # Synthetic in-memory data (orders, inventory, refunds)
└── tools/
    ├── index.ts      # Tool registry barrel (toolRegistry[], toolHandlerMap)
    ├── getOrder.ts   # get_order_details tool
    ├── checkStock.ts # check_inventory tool
    ├── processRefund.ts  # process_refund tool
    └── createShipment.ts # create_shipment tool
```

Each tool exports a `definition` (JSON schema for ListTools) and a `handler` (async function for CallTool). Adding a new tool requires touching only one file (`tools/index.ts`).

---

## 🧪 Local Setup & Verification

```bash
# Install dependencies
npm install

# Run automated runtime verification (7 tests)
npm run test

# Start local dev server
npm run dev

# Build for production
npm run build
```

Expected test output:
```
🧪 Running MCP Tool Verification Tests...
1. Testing get_order_details (Valid Order)...      ✅
2. Testing check_inventory...                      ✅
3. Testing process_refund (Valid Amount)...        ✅
4. Testing process_refund (Guardrail: Exceed Max Limit)... ✅
5. Testing process_refund (Guardrail: Duplicate Key)...    ✅
6. Testing create_shipment (Valid: DAMAGED order)...       ✅
7. Testing create_shipment (Guardrail: DELIVERED order)... ✅
✅ All runtime verification tests executed successfully!
```

---

## 📐 Product Decisions & Scope

### What's in scope
- Order investigation and status lookup
- Inventory availability checks for replacements
- Safe refund processing with two guardrails
- Replacement shipment creation with eligibility enforcement
- End-to-end verification via in-memory MCP transport

### What's intentionally out of scope
- **Authentication / user management** — not required for the assignment; a production version would use API keys or OAuth
- **Persistent storage** — in-memory state is sufficient for demo purposes; production would use a database
- **Frontend / UI** — the MCP is consumed by AI agents (Claude, Cursor) directly
- **Real payment gateway / inventory system** — synthetic data used throughout
- **CI/CD pipeline** — single-step Render deploy is sufficient

---

## 🔒 Assumptions

1. All data is synthetic — no real customer data or production credentials
2. State is in-memory and resets on server restart (by design for demo)
3. The `idempotencyKey` is provided by the calling agent; no server-side key generation
4. A single active SSE connection is assumed (transport is not multiplexed)

---

## ⚠️ Known Limitations & Next Steps

| Limitation | Next Step |
|---|---|
| In-memory state — resets on restart | Add a lightweight DB (SQLite / Postgres) |
| No auth on SSE endpoint | Add API key middleware |
| Single SSE transport instance | Use session-keyed transport map |
| Render free tier cold starts (~30s) | Upgrade to paid or use Railway |
| No pagination on order history | Add cursor-based pagination to `get_order_details` |