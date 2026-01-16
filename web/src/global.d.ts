import type { createClient } from "@supabase/supabase-js";

declare global {
  var __PBW_SUPABASE__: ReturnType<typeof createClient> | undefined;
}

export {};


