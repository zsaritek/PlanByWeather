function readViteSupabaseUrl(): string | null {
  const v = import.meta.env.VITE_SUPABASE_URL;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function readViteSupabaseAnonKey(): string | null {
  const v = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function readPublicEnv():
  | { ok: true; supabaseUrl: string; supabaseAnonKey: string }
  | { ok: false; message: string } {
  const supabaseUrl = readViteSupabaseUrl();
  const supabaseAnonKey = readViteSupabaseAnonKey();

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      message:
        "Missing env: create web/.env.local and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. (Vite only exposes VITE_* variables to the browser.)",
    };
  }

  if (!isValidHttpUrl(supabaseUrl)) {
    return {
      ok: false,
      message:
        `Invalid VITE_SUPABASE_URL. It must be a full http(s) URL, e.g. http://localhost:54321 (got: "${supabaseUrl}").`,
    };
  }

  return { ok: true, supabaseUrl, supabaseAnonKey };
}


