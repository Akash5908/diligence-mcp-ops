import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inmemory.js";
import { createMcpServer } from "./server.js";
import { seedDatabase } from "./db/seed.js";
import { pool } from "./db/index.js";
import assert from "node:assert";

async function runTests() {
  console.log("🧪 Running MCP Tool Verification Tests...\n");

  // 0. Seed the database
  await seedDatabase();
  console.log("\n");

  // 1. Create client and server transports
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  const server = createMcpServer();
  const client = new Client(
    { name: "test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  // 2. Connect client and server
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport)
  ]);

  try {
    // Test 1: Get Order Details
    console.log("1. Testing get_order_details...");
    const orderRes = await client.callTool({
      name: "get_order_details",
      arguments: { orderId: "ORD-1001" }
    });
    assert.strictEqual(orderRes.isError, undefined, "get_order_details should not return error");
    const orderText = (orderRes.content[0] as { text: string }).text;
    assert.ok(orderText.includes("DAMAGED"), "Order 1001 should be DAMAGED");
    console.log("✅ get_order_details passed");

    // Test 2: Process Valid Refund
    console.log("2. Testing process_refund (Valid Amount)...");
    const refundRes = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        amount: 80.00,
        action: "damaged_item",
        idempotencyKey: "KEY-1"
      }
    });
    assert.strictEqual(refundRes.isError, undefined, "Valid refund should not return error");
    
    // Verify Database Side Effects
    const refundCountRes = await pool.query("SELECT COUNT(*) FROM refunds WHERE order_id = 'ORD-1001'");
    assert.strictEqual(Number(refundCountRes.rows[0].count), 1, "Exactly 1 refund should exist");
    
    const paymentRes = await pool.query("SELECT amount_refunded FROM payments WHERE order_id = 'ORD-1001'");
    assert.strictEqual(Number(paymentRes.rows[0].amount_refunded), 80.00, "Ledger should reflect $80.00 refunded");
    console.log("✅ process_refund (Valid Amount) passed and verified in DB");

    // Test 3: Idempotency - Exact Same Refund Intent
    console.log("3. Testing process_refund (Stable Intent - Idempotency)...");
    const refundResDuplicate = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        amount: 80.00,
        action: "damaged_item",
        idempotencyKey: "KEY-2" // Even with a new key, should return original
      }
    });
    assert.strictEqual(refundResDuplicate.isError, undefined, "Idempotent refund should not return error");
    assert.ok((refundResDuplicate.content[0] as { text: string }).text.includes("Idempotent Return"), "Response should indicate idempotent return");
    
    // Verify Database Side Effects (NO mutations occurred)
    const refundCountAfterDup = await pool.query("SELECT COUNT(*) FROM refunds WHERE order_id = 'ORD-1001'");
    assert.strictEqual(Number(refundCountAfterDup.rows[0].count), 1, "Duplicate refund intent should NOT create a new row");
    console.log("✅ process_refund (Idempotency) passed and verified in DB");

    // Test 4: Distinct Legitimate Refund (Same item, different reason/amount)
    console.log("4. Testing process_refund (Distinct Legitimate Intent)...");
    const refundResDistinct = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        amount: 10.00,
        action: "late_shipping",
        idempotencyKey: "KEY-3"
      }
    });
    assert.strictEqual(refundResDistinct.isError, undefined, "Distinct refund should not return error");
    
    // Verify Database Side Effects (New mutation occurred)
    const refundCountAfterDistinct = await pool.query("SELECT COUNT(*) FROM refunds WHERE order_id = 'ORD-1001'");
    assert.strictEqual(Number(refundCountAfterDistinct.rows[0].count), 2, "Distinct refund intent should create a new row");
    
    const paymentResDistinct = await pool.query("SELECT amount_refunded FROM payments WHERE order_id = 'ORD-1001'");
    assert.strictEqual(Number(paymentResDistinct.rows[0].amount_refunded), 90.00, "Ledger should reflect $90.00 total refunded");
    console.log("✅ process_refund (Distinct Intent) passed and verified in DB");

    // Test 5: Guardrail - Exceed Ledger Balance (Routes to Escalation)
    console.log("5. Testing process_refund (Guardrail: Exceed Balance)...");
    const refundResExceed = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        amount: 100.00, // Remaining balance is 120 - 90 = 30
        action: "second_damage",
        idempotencyKey: "KEY-4"
      }
    });
    // Escalations don't return an error block natively, they just textually confirm escalation.
    assert.strictEqual(refundResExceed.isError, undefined, "Escalations return successfully to agent");
    assert.ok((refundResExceed.content[0] as { text: string }).text.includes("Escalated to manager"), "Response should mention escalation");
    
    // Verify Database Side Effects
    const escRes = await pool.query("SELECT COUNT(*) FROM escalations WHERE type = 'REFUND_APPROVAL'");
    assert.strictEqual(Number(escRes.rows[0].count), 1, "Refund escalation should be created in DB");
    console.log("✅ process_refund (Guardrail) passed and escalation verified in DB");

    // Test 6: Request Replacement (Always Escalates)
    console.log("6. Testing request_replacement...");
    const replacementRes = await client.callTool({
      name: "request_replacement",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        reason: "Customer wants a new one",
        idempotencyKey: "KEY-5"
      }
    });
    assert.strictEqual(replacementRes.isError, undefined, "Request replacement should succeed");
    
    // Verify Database Side Effects
    const replaceEscRes = await pool.query("SELECT COUNT(*) FROM escalations WHERE type = 'REPLACEMENT_APPROVAL'");
    assert.strictEqual(Number(replaceEscRes.rows[0].count), 1, "Replacement escalation should be created in DB");
    console.log("✅ request_replacement passed and escalation verified in DB");

    // Test 7: Request Replacement Duplicate (Idempotent)
    console.log("7. Testing request_replacement (Stable Intent - Idempotency)...");
    const replacementResDup = await client.callTool({
      name: "request_replacement",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        reason: "Customer wants a new one", // Same action intent
        idempotencyKey: "KEY-6" // New key
      }
    });
    assert.strictEqual(replacementResDup.isError, undefined);
    assert.ok((replacementResDup.content[0] as { text: string }).text.includes("Idempotent Return"), "Should indicate idempotent return");
    
    // Verify Database Side Effects (No new mutation)
    const replaceEscDupRes = await pool.query("SELECT COUNT(*) FROM escalations WHERE type = 'REPLACEMENT_APPROVAL'");
    assert.strictEqual(Number(replaceEscDupRes.rows[0].count), 1, "Duplicate replacement should NOT create a new escalation");
    console.log("✅ request_replacement (Idempotency) passed and verified in DB");

    // Test 8: Stable-Intent Retry After State Change (Client requirement)
    console.log("8. Testing process_refund (Stable-Intent Lookup Before Reevaluation)...");
    const refundResStateChange = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        amount: 80.00, // Same intent as Test 2
        action: "damaged_item",
        idempotencyKey: "KEY-7"
      }
    });
    // At this point, the ledger only has $30 remaining. If the logic checked current eligibility FIRST, 
    // it would fail the $80 ledger check and escalate. Since we fixed the lookup, it should bypass 
    // eligibility and immediately return the original success from Test 2.
    assert.strictEqual(refundResStateChange.isError, undefined, "Idempotent state-change retry should not return error");
    assert.ok((refundResStateChange.content[0] as { text: string }).text.includes("Idempotent Return"), "Response should indicate idempotent return");
    
    // Verify Database Side Effects (NO mutations occurred)
    const refundCountAfterStateChange = await pool.query("SELECT COUNT(*) FROM refunds WHERE order_id = 'ORD-1001'");
    assert.strictEqual(Number(refundCountAfterStateChange.rows[0].count), 2, "State-change retry should NOT create a new refund row");
    
    const escCountAfterStateChange = await pool.query("SELECT COUNT(*) FROM escalations WHERE type = 'REFUND_APPROVAL'");
    assert.strictEqual(Number(escCountAfterStateChange.rows[0].count), 1, "State-change retry should NOT create a new escalation");
    console.log("✅ process_refund (State-Change Idempotency) passed and verified in DB");

    console.log("\n🎉 All PostgreSQL verification tests and assertions passed perfectly!");
  } catch (err) {
    console.error("❌ Test failed with assertion error:", err);
    process.exit(1);
  } finally {
    await client.close();
    await server.close();
    await pool.end();
  }
}

runTests();