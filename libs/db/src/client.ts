import { createClient, SupabaseClient } from '@supabase/supabase-js';
import ws from 'ws';

function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    _supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws as any },
    });
  }
  return _supabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as any)[prop];
  },
});

export function createUserClient(token: string): SupabaseClient {
  return createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { autoRefreshToken: false, persistSession: false },
    realtime: { transport: ws as any },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}
