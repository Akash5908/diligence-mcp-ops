import fs from 'fs';
import path from 'path';
import { pool } from './index.js';

export async function seedDatabase() {
  const client = await pool.connect();
  try {
    // 1. Apply Schema
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Dropping and recreating schema...');
    await client.query(schemaSql);

    // 2. Insert Seed Data
    console.log('Seeding initial data...');

    // Customers
    await client.query(`
      INSERT INTO customers (id, name, email, risk_score) VALUES
      ('CUST-001', 'Alex Rivera', 'alex@example.com', 20),
      ('CUST-002', 'Sam Patel', 'sam@example.com', 85), -- High risk score
      ('CUST-003', 'Jordan Lee', 'jordan@example.com', 10)
    `);

    // Orders
    await client.query(`
      INSERT INTO orders (id, customer_id, total_amount, status, tracking_number) VALUES
      ('ORD-1001', 'CUST-001', 120.00, 'DAMAGED', 'TRK-987654321'),
      ('ORD-1002', 'CUST-002', 85.50, 'LOST', 'TRK-123456789'),
      ('ORD-1003', 'CUST-003', 49.99, 'DELIVERED', 'TRK-555000111')
    `);

    // Order Items
    await client.query(`
      INSERT INTO order_items (order_id, sku, name, quantity, price_paid) VALUES
      ('ORD-1001', 'SKU-AUDIO-01', 'Wireless Headphones', 1, 120.00),
      ('ORD-1002', 'SKU-WEAR-02', 'Smart Fitness Watch', 1, 85.50),
      ('ORD-1003', 'SKU-BOOK-03', 'TypeScript Handbook', 1, 49.99)
    `);

    // Payments
    await client.query(`
      INSERT INTO payments (id, order_id, amount_paid, amount_refunded) VALUES
      ('PAY-1001', 'ORD-1001', 120.00, 0.00),
      ('PAY-1002', 'ORD-1002', 85.50, 0.00),
      ('PAY-1003', 'ORD-1003', 49.99, 0.00)
    `);

    // Shipments (Carrier integration mock)
    await client.query(`
      INSERT INTO shipments (id, order_id, carrier_status, carrier_exception_verified) VALUES
      ('SHP-1001', 'ORD-1001', 'DAMAGED_IN_TRANSIT', true),
      ('SHP-1002', 'ORD-1002', 'LOST_IN_TRANSIT', true),
      ('SHP-1003', 'ORD-1003', 'DELIVERED', false)
    `);

    // Inventory
    await client.query(`
      INSERT INTO inventory (sku, name, stock_quantity, reserved_quantity) VALUES
      ('SKU-AUDIO-01', 'Wireless Headphones', 15, 2),
      ('SKU-WEAR-02', 'Smart Fitness Watch', 0, 0),
      ('SKU-BOOK-03', 'TypeScript Handbook', 50, 5)
    `);

    console.log('Database seeded successfully!');
  } catch (err) {
    console.error('Error seeding database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Allow running directly
if (require.main === module) {
  seedDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}
