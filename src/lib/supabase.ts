/**
 * Supabase Client Initialization
 * CashFlow Intelligence — Phase 2: Database Schema & Financial Foundation
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let browserClient: SupabaseClient<Database> | null = null;

/**
 * Returns the browser/client-side Supabase client using the public anonymous key.
 * Adheres to RLS policies based on the authenticated user's session JWT.
 */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return browserClient;
}

/**
 * Returns a privileged server-side Supabase admin client using the service role key.
 * MUST only be invoked from backend/server handlers, never exposed to browser client.
 */
export function getSupabaseAdminClient(): SupabaseClient<Database> | null {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
