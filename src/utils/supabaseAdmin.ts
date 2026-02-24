// Re-export Turso admin client with Supabase-compatible interface
// This allows existing code to continue working without changes
import { tursoAdmin, getTursoAdmin } from './tursoAdmin';
import { execSql } from '@/lib/turso';

export const supabaseAdmin = tursoAdmin;
export const getSupabaseAdmin = getTursoAdmin;
export { execSql as getSql };
