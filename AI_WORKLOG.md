# AI Worklog — Commerce Ops MCP Challenge

---

## 1. AI Tools & Models Used

| Tool / Model | Used For |
|---|---|
| **Claude Sonnet (via Antigravity IDE)** | Architecture planning, MCP design decisions, guardrail logic review, README writing, worklog structuring |
| **Claude Code / Cursor (Codex)** | Inline boilerplate generation — Express routes, Zod schemas, TypeScript interfaces |
| **Claude Sonnet (thinking mode)** | Evaluating tradeoffs (e.g., SSE vs stdio transport, in-memory vs persistent state) |

### Why these models for these tasks

- **Planning & architecture (Claude Sonnet thinking):** Complex tradeoff reasoning benefits from extended thinking — e.g. "should `process_refund` be atomic or not given in-memory state?" — where a single response that explores the problem deeply is more valuable than speed.
- **Boilerplate / scaffolding (Cursor / Codex):** Fast inline completions are ideal for repetitive patterns like Zod schemas and `setRequestHandler` calls — no deep reasoning needed.
- **Review & critique (Claude Sonnet):** Used to review generated code for correctness, edge cases, and SDK encapsulation violations before committing.

---

## 2. How AI Was Used to Plan & Break Down Work

1. **Problem framing:** Prompted Claude with the assignment brief and asked it to identify the single most coherent commerce-ops workflow to focus on. Output: "damaged/lost order exception resolution" — order lookup → inventory check → refund → replacement.
2. **Tool design:** Asked Claude to propose MCP tool names, input schemas, and which guardrails were necessary for safe autonomous operation. Reviewed and pruned the list (removed a `cancel_order` tool as out of scope).
3. **Modularization:** After the monolithic `server.ts` was working, used Claude to propose a clean module structure and reviewed the barrel export pattern for `tools/index.ts`.
4. **Gap analysis:** Used Claude to compare the project against the assignment requirements and produce a prioritized action list.

---

## 3. Division of Responsibility

| Responsibility | Developer | AI |
|---|---|---|
| Problem selection & user definition | ✅ | — |
| Guardrail design (what rules, what thresholds) | ✅ | Suggested drafts |
| MCP transport architecture (SSE + Express) | ✅ | — |
| Zod input schema generation | Review & approve | ✅ Generated |
| Synthetic dataset structure | Defined shape | ✅ Generated content |
| Test assertion logic | Designed scenarios | ✅ Scaffolded code |
| Modular refactor plan | Approved | ✅ Proposed |
| README & worklog writing | Reviewed & edited | ✅ Drafted |

---

## 4. Important Prompts & Context Supplied

- **Context supplied to AI at start:** Full assignment brief + existing `server.ts` monolith + folder structure. This let Claude reason about what already existed vs. what needed building.
- **Key prompt for tool design:** _"Given this workflow, what are the minimum MCP tools needed and what guardrails are safety-critical vs. nice-to-have?"_
- **Key prompt for modularization:** _"The tool files exist but are empty. Based on the server.ts monolith, refactor into the existing folder structure so each tool is independently testable."_
- **Key prompt for gap analysis:** _"Compare this project against the assignment requirements and give me a prioritized list of what's missing."_

---

## 5. AI Suggestion Corrected / Rejected

### Rejection 1 — Private SDK property access in tests
**AI suggestion:** Access `server._requestHandlers.get(...)` directly to invoke tools in `testLocal.ts` without setting up a transport pair.

**Why rejected:** This violated SDK encapsulation, accessed a private/internal map not exposed in the type definitions, and threw `TypeError: server._requestHandlers.get(...) is not a function` at runtime. The correct approach is the official `InMemoryTransport.createLinkedPair()` pattern which runs the full MCP request/response cycle end-to-end.

### Rejection 2 — Suggested a `cancel_order` tool
**AI suggestion:** Add a `cancel_order` MCP tool to the registry.

**Why rejected:** Order cancellation has broader downstream consequences (payment provider integrations, warehouse notifications) that are out of scope for a 3–4 hour assignment. Including a stub that doesn't represent real behavior would mislead reviewers. Documented as a "next step" in the README instead.

---

## 6. How AI-Generated Work Was Verified

- **All tool handlers:** Verified by running `npm run test` — 7 end-to-end tests covering happy paths and all guardrail branches.
- **TypeScript correctness:** Verified by running `npm run build` — zero type errors with `strict: true`.
- **Zod schemas:** Manually reviewed each schema against the tool's `inputSchema` JSON definition to confirm field names and types matched.
- **Modular refactor:** Ran full test suite after refactor to confirm identical outputs — no regressions.
- **README accuracy:** Each code snippet in the README was cross-checked against the actual source files.

---

## 7. Remaining Risks & Unfinished Work

| Risk / Gap | Severity | Notes |
|---|---|---|
| In-memory state resets on restart | Medium | Acceptable for demo; persistent DB needed for production |
| Render free tier cold starts (~30s) | Medium | Warn reviewers in README; hit `/health` first |
| Single SSE transport instance | Medium | Multiple concurrent AI agents would conflict; session-keyed map needed |
| No authentication on endpoints | Low | By design for assessment; API key middleware is the obvious next step |
| `create_shipment` doesn't update order status | Low | A production version would mark the order as "REPLACEMENT_DISPATCHED" |
| No rate limiting | Low | An AI agent in a loop could spam refunds; rate limiting + per-order refund count cap needed |