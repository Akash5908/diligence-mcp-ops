import { z } from "zod";
import { mockOrders } from "../db/mockData.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

const InputSchema = z.object({
  orderId: z.string(),
});

// ─── Tool Definition (shown in ListTools) ────────────────────────────────────

export const definition: ToolDefinition = {
  name: "get_order_details",
  description:
    "Retrieve order status, items, tracking info, and refund history for a given order ID.",
  inputSchema: {
    type: "object",
    properties: {
      orderId: {
        type: "string",
        description: "The unique order identifier (e.g. ORD-1001)",
      },
    },
    required: ["orderId"],
  },
};

// ─── Handler (executed in CallTool) ──────────────────────────────────────────

export const handler: ToolHandler = async (args) => {
  const { orderId } = InputSchema.parse(args);
  const order = mockOrders.get(orderId);

  if (!order) {
    return {
      content: [{ type: "text", text: `Error: Order ${orderId} not found.` }],
      isError: true,
    };
  }

  return {
    content: [{ type: "text", text: JSON.stringify(order, null, 2) }],
  };
};
