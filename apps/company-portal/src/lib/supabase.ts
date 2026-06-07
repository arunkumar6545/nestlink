import { createClient } from "@supabase/supabase-js";

const env = (import.meta as unknown as { env: Record<string, string> }).env;

export const supabaseUrl = env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";
export const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
