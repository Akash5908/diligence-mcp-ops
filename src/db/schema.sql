-- Drops (for local dev resets)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS escalations CASCADE;
DROP TABLE IF EXISTS refunds CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS shipments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;

-- Customers
CREATE TABLE customers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  risk_score INT NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100)
);

-- Orders
CREATE TABLE orders (
  id VARCHAR(50) PRIMARY KEY,
  customer_id VARCHAR(50) NOT NULL REFERENCES customers(id),
  total_amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL, -- DELIVERED, DAMAGED, LOST, PENDING
  tracking_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order Items (Composite PK)
CREATE TABLE order_items (
  order_id VARCHAR(50) NOT NULL REFERENCES orders(id),
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  quantity INT NOT NULL,
  price_paid NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (order_id, sku)
);

-- Shipments (Carrier integration mock)
CREATE TABLE shipments (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL REFERENCES orders(id),
  carrier_status VARCHAR(50) NOT NULL,
  carrier_exception_verified BOOLEAN NOT NULL DEFAULT FALSE
);

-- Payments (Ledger)
CREATE TABLE payments (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL REFERENCES orders(id),
  amount_paid NUMERIC(10,2) NOT NULL,
  amount_refunded NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  -- Crucial Ledger Protection Constraint
  CONSTRAINT check_refund_limit CHECK (amount_refunded <= amount_paid)
);

-- Refunds
CREATE TABLE refunds (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PROCESSED',
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Composite FK to ensure SKU belongs to Order
  FOREIGN KEY (order_id, sku) REFERENCES order_items(order_id, sku)
);

-- Stable-Intent Idempotency Constraint for Refunds
CREATE UNIQUE INDEX unique_refund_intent ON refunds (order_id, sku, action, amount);

-- Escalations (Human Review Queue)
CREATE TABLE escalations (
  id VARCHAR(50) PRIMARY KEY,
  order_id VARCHAR(50) NOT NULL,
  sku VARCHAR(100) NOT NULL,
  type VARCHAR(50) NOT NULL, -- REFUND_APPROVAL, REPLACEMENT_APPROVAL
  action VARCHAR(100) NOT NULL,
  amount NUMERIC(10,2), -- Can be null for replacements
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'OPEN', -- OPEN, APPROVED, DENIED
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Composite FK
  FOREIGN KEY (order_id, sku) REFERENCES order_items(order_id, sku)
);

-- Stable-Intent Protection for Escalations
-- Use COALESCE to handle NULL amounts safely in Postgres 14
CREATE UNIQUE INDEX unique_escalation_intent ON escalations (order_id, sku, action, COALESCE(amount, -1));

-- Audit Logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100) NOT NULL,
  actor VARCHAR(100) NOT NULL,
  action VARCHAR(100) NOT NULL,
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inventory (WMS mock)
CREATE TABLE inventory (
  sku VARCHAR(100) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  stock_quantity INT NOT NULL,
  reserved_quantity INT NOT NULL DEFAULT 0
);
