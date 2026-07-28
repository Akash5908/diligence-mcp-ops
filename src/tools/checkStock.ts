import { z } from "zod";
import { mockInventory } from "../db/mockData.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

// ─── Schema ───────────────────────────────────────────────────────────────────

const InputSchema = z.object({
  sku: z.string(),
});

// ─── Tool Definition (shown in ListTools) ────────────────────────────────────

export const definition: ToolDefinition = {
  name: "check_inventory",
  description: "Check stock availability for a replacement item by SKU.",
  inputSchema: {
    type: "object",
    properties: {
      sku: {
        type: "string",
        description: "Product SKU identifier (e.g. SKU-AUDIO-01)",
      },
    },
    required: ["sku"],
  },
};

// ─── Handler (executed in CallTool) ──────────────────────────────────────────

export const handler: ToolHandler = async (args) => {
  const { sku } = InputSchema.parse(args);
  const item = mockInventory.get(sku);

  if (!item) {
    return {
      content: [{ type: "text", text: `Error: SKU ${sku} not found.` }],
      isError: true,
    };
  }

  const availableStock = item.stockQuantity - item.reservedQuantity;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { ...item, availableStock, isAvailable: availableStock > 0 },
          null,
          2
        ),
      },
    ],
  };
};
