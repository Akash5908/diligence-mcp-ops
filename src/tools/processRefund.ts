import { z } from "zod";
import { executeTransaction } from "../db/index.js";
import type { ToolDefinition, ToolHandler } from "./index.js";
import { randomUUID } from "crypto";

const InputSchema = z.object({
  orderId: z.string(),
  sku: z.string(),
  amount: z.number().positive(),
  action: z.string().min(3),
  idempotencyKey: z.string(),
});

export const definition: ToolDefinition = {
  name: "process_refund",
  description:
    "Safely process a refund. Strict eligibility limits apply. Ineligible requests will be routed to escalations.",
  inputSchema: {
    type: "object",
    properties: {
      orderId: { type: "string", description: "The ID of the order" },
      sku: { type: "string", description: "The SKU to refund" },
      amount: { type: "number", description: "The amount to refund" },
      action: { type: "string", description: "e.g. damaged_item, late_shipping" },
      idempotencyKey: { type: "string", description: "Unique key for idempotency" },
    },
    required: ["orderId", "sku", "amount", "action", "idempotencyKey"],
  },
};

export const handler: ToolHandler = async (args) => {
  const { orderId, sku, amount, action, idempotencyKey } = InputSchema.parse(args);

  return await executeTransaction(async (client) => {
    try {
      // 1. Fetch comprehensive order context and lock payment ledger
      const contextRes = await client.query(`
        SELECT 
          o.created_at, 
          p.amount_paid, 
          p.amount_refunded, 
          c.risk_score, 
          s.carrier_exception_verified,
          oi.sku as valid_sku
        FROM orders o
        JOIN customers c ON o.customer_id = c.id
        JOIN payments p ON o.id = p.order_id
        LEFT JOIN shipments s ON o.id = s.order_id
        LEFT JOIN order_items oi ON o.id = oi.order_id AND oi.sku = $2
        WHERE o.id = $1
        FOR UPDATE OF p
      `, [orderId, sku]);

      if (contextRes.rows.length === 0) {
        return { content: [{ type: "text", text: `Error: Order ${orderId} not found.` }], isError: true };
      }

      const ctx = contextRes.rows[0];
      if (!ctx.valid_sku) {
         return { content: [{ type: "text", text: `Error: SKU ${sku} not found on Order ${orderId}.` }], isError: true };
      }

      // 2. Evaluate Eligibility (All must pass)
      const reasons: string[] = [];
      if (amount > 150) reasons.push("Amount exceeds $150 limit.");
      if (amount > (Number(ctx.amount_paid) - Number(ctx.amount_refunded))) reasons.push("Amount exceeds remaining ledger balance.");
      
      const orderAgeDays = (Date.now() - new Date(ctx.created_at).getTime()) / (1000 * 60 * 60 * 24);
      if (orderAgeDays > 30) reasons.push("Order is older than 30 days.");
      
      if (ctx.risk_score >= 70) reasons.push("Customer risk score is too high.");
      if (!ctx.carrier_exception_verified) reasons.push("Carrier exception is not verified.");

      if (reasons.length > 0) {
        // FAIL: Route to escalation
        try {
          const escId = `ESC-${randomUUID()}`;
          await client.query('SAVEPOINT try_esc');
          await client.query(`
            INSERT INTO escalations (id, order_id, sku, type, action, amount, reason, idempotency_key)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [escId, orderId, sku, 'REFUND_APPROVAL', action, amount, reasons.join(' '), idempotencyKey]);
          
          await client.query(`
            INSERT INTO audit_logs (entity_type, entity_id, actor, action, new_state)
            VALUES ('escalation', $1, 'mcp-agent', 'escalation_created', $2)
          `, [escId, JSON.stringify({ type: 'REFUND_APPROVAL', reasons })]);

          await client.query('RELEASE SAVEPOINT try_esc');
          return { content: [{ type: "text", text: `Refund ineligible. Escalated to manager: ${reasons.join(' ')}` }] };
        } catch (err: any) {
          if (err.code === '23505') {
            await client.query('ROLLBACK TO SAVEPOINT try_esc');
            // Stable Intent Hit
            const existing = await client.query('SELECT * FROM escalations WHERE order_id = $1 AND sku = $2 AND action = $3 AND amount = $4', [orderId, sku, action, amount]);
            return { content: [{ type: "text", text: `[Idempotent Return] Escalation already exists: ${existing.rows[0].id} (Status: ${existing.rows[0].status})` }] };
          }
          throw err;
        }
      }

      // PASS: Execute Refund
      try {
        const refId = `REF-${randomUUID()}`;
        await client.query('SAVEPOINT try_ref');
        await client.query(`
          INSERT INTO refunds (id, order_id, sku, action, amount, idempotency_key)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [refId, orderId, sku, action, amount, idempotencyKey]);
        
        await client.query(`
          UPDATE payments SET amount_refunded = amount_refunded + $1 WHERE order_id = $2
        `, [amount, orderId]);

        await client.query(`
          INSERT INTO audit_logs (entity_type, entity_id, actor, action, new_state)
          VALUES ('refund', $1, 'mcp-agent', 'refund_processed', $2)
        `, [refId, JSON.stringify({ amount, action })]);

        await client.query('RELEASE SAVEPOINT try_ref');
        return { content: [{ type: "text", text: `Successfully processed refund of $${amount} for ${orderId} (${sku}). Refund ID: ${refId}` }] };
      } catch (err: any) {
        if (err.code === '23505') {
          await client.query('ROLLBACK TO SAVEPOINT try_ref');
          // Stable Intent Hit
          const existing = await client.query('SELECT * FROM refunds WHERE order_id = $1 AND sku = $2 AND action = $3 AND amount = $4', [orderId, sku, action, amount]);
          return { content: [{ type: "text", text: `[Idempotent Return] Refund already processed: ${existing.rows[0].id}` }] };
        }
        throw err;
      }
    } catch (e) {
       return { content: [{ type: "text", text: `Transaction failed: ${(e as Error).message}` }], isError: true };
    }
  });
};
