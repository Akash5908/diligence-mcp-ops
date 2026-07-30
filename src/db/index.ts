import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

// Connect to the database
// In tests this will use DATABASE_URL if provided, else default to local diligence_mcp_test
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/diligence_mcp_test',
});

// Helper for simple queries
export const query = (text: string, params?: any[]) => pool.query(text, params);

// Helper for transaction execution with retries or specific error handling
export const executeTransaction = async <T>(
  callback: (client: pkg.PoolClient) => Promise<T>
): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
