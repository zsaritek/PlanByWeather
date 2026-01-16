import { createClient } from "@supabase/supabase-js";

export function getSupabaseClient(url: string, anonKey: string) {
  // In dev, React StrictMode + HMR can re-run module/component init.
  // Keeping a single client instance avoids "Multiple GoTrueClient instances" warnings.
  if (globalThis.__PBW_SUPABASE__) return globalThis.__PBW_SUPABASE__;

  globalThis.__PBW_SUPABASE__ = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return globalThis.__PBW_SUPABASE__;
}


