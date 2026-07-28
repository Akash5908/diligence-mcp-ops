// ─── Shared Domain Types ────────────────────────────────────────────────────

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface Order {
  id: string;
  customerName: string;
  email: string;
  status: "DELIVERED" | "IN_TRANSIT" | "DAMAGED" | "LOST";
  totalAmount: number;
  refundedAmount: number;
  items: OrderItem[];
  trackingNumber: string;
  createdAt: string;
}

export interface InventoryItem {
  sku: string;
  name: string;
  stockQuantity: number;
  reservedQuantity: number;
}

export interface RefundRecord {
  id: string;
  orderId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  timestamp: string;
}

export interface ShipmentRecord {
  id: string;
  orderId: string;
  address: string;
  status: "PENDING" | "DISPATCHED";
  createdAt: string;
}
