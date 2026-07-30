import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inmemory.js";
import { createMcpServer } from "./server.js";
import { seedDatabase } from "./db/seed.js";
import { pool } from "./db/index.js";

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
    console.log("Result:", (orderRes.content[0] as { text: string }).text, "\n");

    // Test 2: Process Valid Refund
    console.log("2. Testing process_refund (Valid Amount)...");
    const refundRes = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        amount: 50.00,
        action: "damaged_item",
        idempotencyKey: "KEY-1"
      }
    });
    console.log("Result:", (refundRes.content[0] as { text: string }).text, "\n");

    // Test 3: Idempotency - Exact Same Refund Intent
    console.log("3. Testing process_refund (Stable Intent - Idempotency)...");
    const refundResDuplicate = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        amount: 50.00,
        action: "damaged_item",
        idempotencyKey: "KEY-2" // Even with a new key, should return original
      }
    });
    console.log("Result:", (refundResDuplicate.content[0] as { text: string }).text, "\n");

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
    console.log("Result:", (refundResDistinct.content[0] as { text: string }).text, "\n");

    // Test 5: Guardrail - Exceed Ledger Balance (Routes to Escalation)
    console.log("5. Testing process_refund (Guardrail: Exceed Balance)...");
    const refundResExceed = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        sku: "SKU-AUDIO-01",
        amount: 100.00, // Remaining balance is 120 - 50 - 10 = 60
        action: "second_damage",
        idempotencyKey: "KEY-4"
      }
    });
    console.log("Result:", (refundResExceed.content[0] as { text: string }).text, "\n");

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
    console.log("Result:", (replacementRes.content[0] as { text: string }).text, "\n");

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
    console.log("Result:", (replacementResDup.content[0] as { text: string }).text, "\n");

    console.log("✅ All PostgreSQL verification tests executed successfully!");
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await client.close();
    await server.close();
    await pool.end();
  }
}

runTests();