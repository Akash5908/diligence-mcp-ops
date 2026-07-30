import { z } from "zod";
import { query } from "../db/index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";

const InputSchema = z.object({
  orderId: z.string(),
});

export const definition: ToolDefinition = {
  name: "get_order_details",
  description:
    "Retrieve order status, items, tracking info, financial ledger, and carrier exceptions for a given order ID.",
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

export const handler: ToolHandler = async (args) => {
  const { orderId } = InputSchema.parse(args);

  // 1. Fetch Core Order & Customer & Payment details
  const orderResult = await query(`
    SELECT o.id, o.status, o.total_amount, o.tracking_number, o.created_at,
           c.name as customer_name, c.email, c.risk_score,
           p.amount_paid, p.amount_refunded
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    LEFT JOIN payments p ON o.id = p.order_id
    WHERE o.id = $1
  `, [orderId]);

  if (orderResult.rows.length === 0) {
    return {
      content: [{ type: "text", text: `Error: Order ${orderId} not found.` }],
      isError: true,
    };
  }

  const orderData = orderResult.rows[0];

  // 2. Fetch Items
  const itemsResult = await query(`
    SELECT sku, name, quantity, price_paid 
    FROM order_items 
    WHERE order_id = $1
  `, [orderId]);

  // 3. Fetch Shipments / Exceptions
  const shipmentsResult = await query(`
    SELECT id as shipment_id, carrier_status, carrier_exception_verified 
    FROM shipments 
    WHERE order_id = $1
  `, [orderId]);

  // Combine into single summary object
  const summary = {
    ...orderData,
    items: itemsResult.rows,
    shipments: shipmentsResult.rows
  };

  return {
    content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
  };
};
