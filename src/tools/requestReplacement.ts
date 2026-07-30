import { z } from "zod";
import { executeTransaction } from "../db/index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";
import { randomUUID } from "crypto";

const InputSchema = z.object({
  orderId: z.string(),
  sku: z.string(),
  reason: z.string(),
  idempotencyKey: z.string(),
});

export const definition: ToolDefinition = {
  name: "request_replacement",
  description:
    "Request a replacement shipment for a damaged or lost item. This always routes to a manager for approval.",
  inputSchema: {
    type: "object",
    properties: {
      orderId: { type: "string", description: "The ID of the order" },
      sku: { type: "string", description: "The SKU to replace" },
      reason: { type: "string", description: "Reason for replacement" },
      idempotencyKey: { type: "string", description: "Unique key for idempotency" },
    },
    required: ["orderId", "sku", "reason", "idempotencyKey"],
  },
};

export const handler: ToolHandler = async (args) => {
  const { orderId, sku, reason, idempotencyKey } = InputSchema.parse(args);

  return await executeTransaction(async (client) => {
    try {
      const orderCheck = await client.query('SELECT status FROM orders WHERE id = $1', [orderId]);
      if (orderCheck.rows.length === 0) {
        return { content: [{ type: "text", text: `Error: Order ${orderId} not found.` }], isError: true };
      }
      
      const itemCheck = await client.query('SELECT 1 FROM order_items WHERE order_id = $1 AND sku = $2', [orderId, sku]);
      if (itemCheck.rows.length === 0) {
         return { content: [{ type: "text", text: `Error: SKU ${sku} not found on Order ${orderId}.` }], isError: true };
      }

      // Replacements ALWAYS go to escalation queue as per requirements
      const action = 'replacement_request';
      const type = 'REPLACEMENT_APPROVAL';
      
      try {
        const escId = `ESC-${randomUUID()}`;
        await client.query('SAVEPOINT try_esc');
        await client.query(`
          INSERT INTO escalations (id, order_id, sku, type, action, amount, reason, idempotency_key)
          VALUES ($1, $2, $3, $4, $5, NULL, $6, $7)
        `, [escId, orderId, sku, type, action, reason, idempotencyKey]);
        
        await client.query(`
          INSERT INTO audit_logs (entity_type, entity_id, actor, action, new_state)
          VALUES ('escalation', $1, 'mcp-agent', 'escalation_created', $2)
        `, [escId, JSON.stringify({ type, reason })]);

        await client.query('RELEASE SAVEPOINT try_esc');
        return { content: [{ type: "text", text: `Replacement requested and escalated to manager. Escalation ID: ${escId}` }] };
      } catch (err: any) {
        if (err.code === '23505') {
          await client.query('ROLLBACK TO SAVEPOINT try_esc');
          // Stable Intent Hit (Using COALESCE(amount, -1) constraint for NULL amount)
          const existing = await client.query('SELECT * FROM escalations WHERE order_id = $1 AND sku = $2 AND action = $3 AND amount IS NULL', [orderId, sku, action]);
          return { content: [{ type: "text", text: `[Idempotent Return] Replacement request already exists: ${existing.rows[0].id} (Status: ${existing.rows[0].status})` }] };
        }
        throw err;
      }
    } catch (e) {
      return { content: [{ type: "text", text: `Transaction failed: ${(e as Error).message}` }], isError: true };
    }
  });
};
