# Commerce Ops MCP Server

An **AI-native, remotely hosted MCP server** written in TypeScript that empowers operations teams and AI agents to investigate and resolve e-commerce order exceptions — damaged items, lost shipments, refunds, and replacement dispatches — safely and autonomously.

---

## 🎯 Problem & Justification

**User:** An operations agent (human or AI) handling post-delivery exceptions in an online commerce business.

**Problem:** When an order is damaged or lost, the ops agent must:
1. Investigate the order and understand what happened (Read)
2. Check if a replacement item is available in inventory (Read)
3. Process a partial or full refund safely (Write)
4. Escalate for a replacement shipment if appropriate (Write)

**Justification:** Resolving post-delivery exceptions (damaged/lost items) touches the three most critical domains of commerce ops (Order Management, Inventory, and Payment). It provides a complete, measurable operational outcome while remaining safely constrainable via programmatic guardrails (e.g., refund limits, idempotency).

## 🏢 Systems Modeled (Strict PostgreSQL Architecture)

To support this workflow, the server connects to a **PostgreSQL Database** modeling three source systems with strict relational integrity:
1. **OMS (Order Management System):** Stores order history, items, and status.
2. **WMS (Warehouse Management System):** Stores WMS inventory and Carrier shipments.
3. **Payment Gateway:** Records processed refunds and enforces ledger protection (`CHECK (amount_refunded <= amount_paid)`).

## 🛡️ Read vs. Write Boundary

The workflow goes beyond lookup to safely bounded actions.
- **Read Boundary:** Unrestricted lookup of order details and inventory availability.
- **Write Boundary (Atomic):** Actions (Refunds, Replacements) are executed via single atomic `BEGIN/COMMIT` transactions.
  - **Guardrails:** A refund cannot exceed $150, the order must be <30 days old, risk score <70, and carrier exception verified. Failures route automatically to manager review via the `escalations` table.
  - **Idempotency:** Stable-intent idempotency is enforced purely at the database level using `UNIQUE` indexes on `(order_id, sku, action, amount)`. Duplicate requests are caught and gracefully returned without duplicating mutations.
  - **Replacements:** Are never created automatically. They are always routed to `escalations` for human approval.

---

## 🛠️ MCP Tools

| Tool | Description | Inputs | Guardrails |
|---|---|---|---|
| `get_order_details` | Fetch order status, items, tracking, refund history | `orderId` | Returns error if not found |
| `check_inventory` | Check available stock for a SKU | `sku` | Returns error if SKU not found |
| `process_refund` | Apply a partial or full refund atomically | `orderId`, `sku`, `amount`, `action`, `idempotencyKey` | 6 strict guardrails (amount cap, risk, age). Stable-intent idempotency catches duplicates. |
| `request_replacement` | Escalate a request for a replacement item | `orderId`, `sku`, `reason`, `idempotencyKey` | Always escalates to manager. Enforces stable-intent idempotency on retries. |

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
├── db/
│   ├── index.ts      # PostgreSQL connection pool and executeTransaction logic
│   ├── schema.sql    # DDL for all 9 tables and UNIQUE constraints
│   └── seed.ts       # Database seeding script for testing
└── tools/
    ├── index.ts      # Tool registry barrel
    ├── getOrder.ts   # get_order_details tool
    ├── checkStock.ts # check_inventory tool
    ├── processRefund.ts  # process_refund tool
    └── requestReplacement.ts # request_replacement tool
```

---

## 🧪 Local Setup & Verification

```bash
# Install dependencies
npm install

# Setup your local PostgreSQL and provide a .env file
# DATABASE_URL=postgresql://localhost:5432/diligence_mcp_test

# Run automated runtime verification (Testing all DB Constraints & Idempotency)
npm run test
```

Expected test output:
```
🧪 Running MCP Tool Verification Tests...
1. Testing get_order_details...                      ✅
2. Testing process_refund (Valid Amount)...          ✅
3. Testing process_refund (Stable Intent - Idempotency)... ✅
4. Testing process_refund (Distinct Legitimate Intent)... ✅
5. Testing process_refund (Guardrail: Exceed Balance)... ✅
6. Testing request_replacement...                    ✅
7. Testing request_replacement (Stable Intent)...    ✅
✅ All PostgreSQL verification tests executed successfully!
```

---

## 📐 Product Decisions & Scope

### What's in scope
- Order investigation and status lookup using PostgreSQL JOINs.
- Safe refund processing with strict atomic transactions.
- Hardened database idempotency rules using PostgreSQL `SAVEPOINT`.
- Automated manager escalations for replacements and denied refunds.

### What's intentionally out of scope
- **Authentication / user management** — a production version would use API keys or OAuth
- **Frontend / UI** — the MCP is consumed by AI agents (Claude, Cursor) directly