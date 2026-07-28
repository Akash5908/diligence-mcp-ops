import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inmemory.js";
import { createMcpServer } from "./server.js";

async function runTests() {
  console.log("🧪 Running MCP Tool Verification Tests...\n");

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
    console.log("1. Testing get_order_details (Valid Order)...");
    const orderRes = await client.callTool({
      name: "get_order_details",
      arguments: { orderId: "ORD-1001" }
    });
    console.log("Result:", (orderRes.content[0] as { text: string }).text, "\n");

    // Test 2: Check Inventory
    console.log("2. Testing check_inventory...");
    const stockRes = await client.callTool({
      name: "check_inventory",
      arguments: { sku: "SKU-AUDIO-01" }
    });
    console.log("Result:", (stockRes.content[0] as { text: string }).text, "\n");

    // Test 3: Process Valid Refund
    console.log("3. Testing process_refund (Valid Amount)...");
    const refundRes = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        amount: 50.00,
        reason: "Item arrived with cosmetic damage.",
        idempotencyKey: "TXN-KEY-001"
      }
    });
    console.log("Result:", (refundRes.content[0] as { text: string }).text, "\n");

    // Test 4: Exceed Maximum Refund Guardrail
    console.log("4. Testing process_refund (Guardrail: Exceed Max Limit)...");
    const limitGuardrailRes = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        amount: 100.00, // Remaining balance is $70, so $100 will trigger guardrail
        reason: "Requesting full refund after partial.",
        idempotencyKey: "TXN-KEY-002"
      }
    });
    console.log("Result:", (limitGuardrailRes.content[0] as { text: string }).text, "\n");

    // Test 5: Idempotency Guardrail
    console.log("5. Testing process_refund (Guardrail: Duplicate Idempotency Key)...");
    const idempGuardrailRes = await client.callTool({
      name: "process_refund",
      arguments: {
        orderId: "ORD-1001",
        amount: 50.00,
        reason: "Duplicate submission attempt.",
        idempotencyKey: "TXN-KEY-001"
      }
    });
    console.log("Result:", (idempGuardrailRes.content[0] as { text: string }).text, "\n");

    // Test 6: Create Shipment (Valid — DAMAGED order)
    console.log("6. Testing create_shipment (Valid: DAMAGED order)...");
    const shipmentRes = await client.callTool({
      name: "create_shipment",
      arguments: {
        orderId: "ORD-1001",
        address: "123 Main St, San Francisco, CA 94105"
      }
    });
    console.log("Result:", (shipmentRes.content[0] as { text: string }).text, "\n");

    // Test 7: Create Shipment (Guardrail — DELIVERED order, not eligible for replacement)
    console.log("7. Testing create_shipment (Guardrail: DELIVERED order)...");
    const shipmentGuardrailRes = await client.callTool({
      name: "create_shipment",
      arguments: {
        orderId: "ORD-1003", // status = DELIVERED — not eligible for replacement
        address: "456 Elm St, New York, NY 10001"
      }
    });
    console.log("Result:", (shipmentGuardrailRes.content[0] as { text: string }).text, "\n");

    console.log("✅ All runtime verification tests executed successfully!");
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await client.close();
    await server.close();
  }
}

runTests();