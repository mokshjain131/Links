import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase env vars not set. Auth will not work. " +
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env"
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder"
);

/**
 * Get the current access token (JWT) for API calls.
 */
export async function getAccessToken() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Listen for auth state changes.
 */
export function onAuthChange(callback) {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return subscription;
}
