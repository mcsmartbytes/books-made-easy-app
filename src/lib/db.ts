import { neon } from '@neondatabase/serverless';

// Create a SQL client using the pooled connection
const sql = neon(process.env.DATABASE_URL!);

export { sql };

// Helper for transactions using unpooled connection
export function getUnpooledConnection() {
  return neon(process.env.DATABASE_URL_UNPOOLED!);
}
