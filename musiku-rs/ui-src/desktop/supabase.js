// Klien Supabase untuk autentikasi akun dan sinkronisasi pustaka cloud.
import { createClient } from "@supabase/supabase-js";

export const SUPABASE_URL = "https://kadtpcwwmkrdkvdnbvvr.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ewdI3TfAJ2I7QStk39LAug_DA5t43ON";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storageKey: "musiku.supabase.auth",
      },
    })
  : null;
