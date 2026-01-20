import { neon, NeonQueryFunction } from '@neondatabase/serverless';

// Lazy-load the SQL client to avoid build-time errors
let _sql: NeonQueryFunction<false, false> | null = null;

export function getSql() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}

// For backwards compatibility - use getSql() for new code
export const sql = {
  query: async (...args: Parameters<NeonQueryFunction<false, false>>) => {
    return getSql()(...args);
  }
};

// Helper for transactions using unpooled connection
export function getUnpooledConnection() {
  if (!process.env.DATABASE_URL_UNPOOLED) {
    throw new Error('DATABASE_URL_UNPOOLED environment variable is not set');
  }
  return neon(process.env.DATABASE_URL_UNPOOLED);
}
