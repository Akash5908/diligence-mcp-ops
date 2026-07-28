import { z } from "zod";
import { mockOrders, mockRefunds } from "../db/mockData.js";
import type { RefundRecord } from "../types/index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

const InputSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  reason: z.string().min(5),
  idempotencyKey: z.string(),
});

// ─── Tool Definition (shown in ListTools) ────────────────────────────────────

export const definition: ToolDefinition = {
  name: "process_refund",
  description:
    "Safely process a full or partial refund with strict guardrails (amount limits & idempotency).",
  inputSchema: {
    type: "object",
    properties: {
      orderId: { type: "string", description: "Order ID to refund" },
      amount: { type: "number", description: "Refund amount in USD" },
      reason: { type: "string", description: "Reason for the refund" },
      idempotencyKey: {
        type: "string",
        description: "Unique key to prevent duplicate refunds",
      },
    },
    required: ["orderId", "amount", "reason", "idempotencyKey"],
  },
};

// ─── Handler (executed in CallTool) ──────────────────────────────────────────

export const handler: ToolHandler = async (args) => {
  const { orderId, amount, reason, idempotencyKey } = InputSchema.parse(args);

  // Guardrail 1: Idempotency — reject duplicate transaction keys
  const existingRefund = mockRefunds.find((r) => r.idempotencyKey === idempotencyKey);
  if (existingRefund) {
    return {
      content: [
        {
          type: "text",
          text: `[Guardrail Triggered] Duplicate transaction prevented. Already processed: ${JSON.stringify(existingRefund)}`,
        },
      ],
    };
  }

  const order = mockOrders.get(orderId);
  if (!order) {
    return {
      content: [{ type: "text", text: `Error: Order ${orderId} not found.` }],
      isError: true,
    };
  }

  // Guardrail 2: Refund limit — cannot exceed remaining refundable amount
  const remainingRefundable = order.totalAmount - order.refundedAmount;
  if (amount > remainingRefundable) {
    return {
      content: [
        {
          type: "text",
          text: `[Guardrail Triggered] Requested refund ($${amount}) exceeds remaining refundable amount ($${remainingRefundable}). Maximum allowed: $${remainingRefundable}`,
        },
      ],
      isError: true,
    };
  }

  // Apply the refund
  order.refundedAmount += amount;
  const record: RefundRecord = {
    id: `REF-${Date.now()}`,
    orderId,
    amount,
    reason,
    idempotencyKey,
    timestamp: new Date().toISOString(),
  };
  mockRefunds.push(record);

  return {
    content: [
      {
        type: "text",
        text: `Successfully processed refund of $${amount} for ${orderId}.\nRefund Details: ${JSON.stringify(record, null, 2)}`,
      },
    ],
  };
};
