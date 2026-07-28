import { z } from "zod";
import { mockOrders, mockShipments } from "../db/mockData.js";
import type { ShipmentRecord } from "../types/index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

const InputSchema = z.object({
  orderId: z.string(),
  address: z.string().min(5),
});

// ─── Tool Definition (shown in ListTools) ────────────────────────────────────

export const definition: ToolDefinition = {
  name: "create_shipment",
  description:
    "Create a replacement shipment for a damaged or lost order to a specified delivery address.",
  inputSchema: {
    type: "object",
    properties: {
      orderId: {
        type: "string",
        description: "The order ID that requires a replacement shipment (e.g. ORD-1001)",
      },
      address: {
        type: "string",
        description: "The full delivery address for the replacement item",
      },
    },
    required: ["orderId", "address"],
  },
};

// ─── Handler (executed in CallTool) ──────────────────────────────────────────

export const handler: ToolHandler = async (args) => {
  const { orderId, address } = InputSchema.parse(args);

  const order = mockOrders.get(orderId);
  if (!order) {
    return {
      content: [{ type: "text", text: `Error: Order ${orderId} not found.` }],
      isError: true,
    };
  }

  // Guardrail: only allow shipment for eligible statuses
  if (order.status !== "DAMAGED" && order.status !== "LOST") {
    return {
      content: [
        {
          type: "text",
          text: `[Guardrail Triggered] Replacement shipments are only allowed for DAMAGED or LOST orders. Current status: ${order.status}`,
        },
      ],
      isError: true,
    };
  }

  const shipment: ShipmentRecord = {
    id: `SHIP-${Date.now()}`,
    orderId,
    address,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };
  mockShipments.push(shipment);

  return {
    content: [
      {
        type: "text",
        text: `Replacement shipment created for ${orderId}.\nShipment Details: ${JSON.stringify(shipment, null, 2)}`,
      },
    ],
  };
};
