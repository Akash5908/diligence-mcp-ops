import { z } from "zod";
import { query } from "../db/index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

const InputSchema = z.object({
  sku: z.string(),
});

export const definition: ToolDefinition = {
  name: "check_inventory",
  description: "Check warehouse inventory stock levels for a specific SKU.",
  inputSchema: {
    type: "object",
    properties: {
      sku: {
        type: "string",
        description: "The product SKU to check (e.g. SKU-AUDIO-01)",
      },
    },
    required: ["sku"],
  },
};

export const handler: ToolHandler = async (args) => {
  const { sku } = InputSchema.parse(args);

  const result = await query(`
    SELECT sku, name, stock_quantity, reserved_quantity 
    FROM inventory 
    WHERE sku = $1
  `, [sku]);

  if (result.rows.length === 0) {
    return {
      content: [{ type: "text", text: `Error: SKU ${sku} not found in warehouse.` }],
      isError: true,
    };
  }

  const item = result.rows[0];
  const available = item.stock_quantity - item.reserved_quantity;

  const summary = {
    ...item,
    availableQuantity: available,
    isAvailableForReplacement: available > 0,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
  };
};
