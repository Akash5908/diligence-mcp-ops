import type { Order, InventoryItem, RefundRecord, ShipmentRecord } from "../types/index.js";

// ─── Synthetic Order Database ────────────────────────────────────────────────

export const mockOrders: Map<string, Order> = new Map([
  [
    "ORD-1001",
    {
      id: "ORD-1001",
      customerName: "Alex Rivera",
      email: "alex@example.com",
      status: "DAMAGED",
      totalAmount: 120.0,
      refundedAmount: 0.0,
      items: [
        { sku: "SKU-AUDIO-01", name: "Wireless Headphones", quantity: 1, unitPrice: 120.0 },
      ],
      trackingNumber: "TRK-987654321",
      createdAt: "2026-07-20T10:00:00Z",
    },
  ],
  [
    "ORD-1002",
    {
      id: "ORD-1002",
      customerName: "Sam Patel",
      email: "sam@example.com",
      status: "LOST",
      totalAmount: 85.5,
      refundedAmount: 0.0,
      items: [
        { sku: "SKU-WEAR-02", name: "Smart Fitness Watch", quantity: 1, unitPrice: 85.5 },
      ],
      trackingNumber: "TRK-123456789",
      createdAt: "2026-07-22T14:30:00Z",
    },
  ],
  [
    "ORD-1003",
    {
      id: "ORD-1003",
      customerName: "Jordan Lee",
      email: "jordan@example.com",
      status: "DELIVERED",
      totalAmount: 49.99,
      refundedAmount: 0.0,
      items: [
        { sku: "SKU-BOOK-03", name: "TypeScript Handbook", quantity: 1, unitPrice: 49.99 },
      ],
      trackingNumber: "TRK-555000111",
      createdAt: "2026-07-25T09:15:00Z",
    },
  ],
]);

// ─── Synthetic Inventory Database ────────────────────────────────────────────

export const mockInventory: Map<string, InventoryItem> = new Map([
  [
    "SKU-AUDIO-01",
    { sku: "SKU-AUDIO-01", name: "Wireless Headphones", stockQuantity: 15, reservedQuantity: 2 },
  ],
  [
    "SKU-WEAR-02",
    { sku: "SKU-WEAR-02", name: "Smart Fitness Watch", stockQuantity: 0, reservedQuantity: 0 },
  ],
]);

// ─── In-Memory Refund Log ─────────────────────────────────────────────────────

export const mockRefunds: RefundRecord[] = [];

// ─── In-Memory Shipment Log ───────────────────────────────────────────────────

export const mockShipments: ShipmentRecord[] = [];