import { createClient } from "@supabase/supabase-js";

const env = (import.meta as unknown as { env: Record<string, string> }).env;

export const supabaseUrl: string =
  env.VITE_SUPABASE_URL || "http://127.0.0.1:54321";

export const supabaseAnonKey: string =
  env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRFA0NiK7UFDpLC9jcX-4XzKzFUEhYqalIJBDP9KaFQ";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

/** True when we're using the built-in local fallback URL and local Supabase may not be running */
export const isLocalFallback = !env.VITE_SUPABASE_URL;

export type SupabaseClient = typeof supabase;
