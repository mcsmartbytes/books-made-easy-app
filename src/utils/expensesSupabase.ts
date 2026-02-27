// Client-side expenses utility - wraps API calls for expenses features
// This maintains compatibility with existing code while using Neon backend

import { supabase } from './supabase';

// Re-export the supabase client for expenses
// Both use the same client-side API wrapper
export const expensesSupabase = supabase;

// Default export for compatibility
export default expensesSupabase;
